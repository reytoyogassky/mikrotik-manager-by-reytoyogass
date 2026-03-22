/**
 * RouterOS API Client — TypeScript/Node.js
 *
 * Implementasi protokol RouterOS API (TCP Binary) berdasarkan
 * RouterOS PHP API class v1.6 yang dipakai oleh Mikhmon.
 */
import * as net from "net";
import { createHash } from "crypto";

export type RouterOSRow = Record<string, string>;
export type RouterOSResponse = RouterOSRow[];

// ─── Length encoding ─────────────────────────────────────────────────────────

function encodeLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) {
    const v = len | 0x8000;
    return Buffer.from([(v >> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x200000) {
    const v = len | 0xc00000;
    return Buffer.from([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  }
  if (len < 0x10000000) {
    const v = len | 0xe0000000;
    return Buffer.from([(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  }
  return Buffer.from([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
}

function decodeLen(buf: Buffer, i: number): [number, number] {
  const b = buf[i];
  if ((b & 0x80) === 0) return [b, 1];
  if ((b & 0xc0) === 0x80) return [((b & 0x3f) << 8) | buf[i + 1], 2];
  if ((b & 0xe0) === 0xc0) return [((b & 0x1f) << 16) | (buf[i + 1] << 8) | buf[i + 2], 3];
  if ((b & 0xf0) === 0xe0)
    return [((b & 0x0f) << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3], 4];
  return [(buf[i + 1] << 24) | (buf[i + 2] << 16) | (buf[i + 3] << 8) | buf[i + 4], 5];
}

// ─── Sentence encode ─────────────────────────────────────────────────────────

function encodeSentence(words: string[]): Buffer {
  const parts: Buffer[] = [];
  for (const w of words) {
    const wb = Buffer.from(w, "utf-8");
    parts.push(encodeLen(wb.length));
    parts.push(wb);
  }
  parts.push(Buffer.from([0x00]));
  return Buffer.concat(parts);
}

// ─── parseBuffer — FIX ROOT CAUSE double data ─────────────────────────────
//
// BUG SEBELUMNYA: rxBuf di-parse ulang dari byte 0 setiap kali chunk baru
// datang → semua !re sentence di-push berkali-kali.
//
// FIX: kembalikan { sentences, consumed } di mana consumed = jumlah byte
// yang sudah membentuk kalimat lengkap. rxBuf dipotong sebesar consumed
// setelah tiap chunk, sehingga sentence hanya diproses SEKALI.

function parseBuffer(buf: Buffer): { sentences: string[][]; consumed: number } {
  const sentences: string[][] = [];
  let cur: string[] = [];
  let i = 0;
  let lastBoundary = 0; // byte offset setelah sentence terakhir yang lengkap

  while (i < buf.length) {
    // 0x00 = zero-length word = akhir sentence
    if (buf[i] === 0x00) {
      if (cur.length > 0) {
        sentences.push(cur);
        cur = [];
      }
      i++;
      lastBoundary = i; // sentence ini sudah lengkap
      continue;
    }

    // Pastikan masih ada byte untuk header
    if (i >= buf.length) break;

    const [wordLen, hdrLen] = decodeLen(buf, i);
    i += hdrLen;

    // Kata belum lengkap — tunggu chunk berikutnya
    if (i + wordLen > buf.length) break;

    cur.push(buf.slice(i, i + wordLen).toString("utf-8"));
    i += wordLen;
  }

  // cur yang tersisa adalah kata parsial — tidak di-push, tetap di buffer

  return { sentences, consumed: lastBoundary };
}

// ─── MD5 challenge-response (RouterOS < v6.43) ───────────────────────────────

function md5Challenge(password: string, hexChallenge: string): string {
  const challenge = Buffer.from(hexChallenge, "hex");
  const pass      = Buffer.from(password, "utf-8");
  return createHash("md5")
    .update(Buffer.concat([Buffer.from([0x00]), pass, challenge]))
    .digest("hex");
}

// ─── Sentence → plain object ─────────────────────────────────────────────────

function sentenceToRow(words: string[]): RouterOSRow {
  const row: RouterOSRow = {};
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w.startsWith("=")) {
      const eq2 = w.indexOf("=", 1);
      if (eq2 !== -1) row[w.slice(1, eq2)] = w.slice(eq2 + 1);
    }
  }
  return row;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class RouterOSClient {
  private readonly host:    string;
  private readonly port:    number;
  private readonly timeout: number;

  constructor(host: string, port = 8728, timeout = 8000) {
    this.host    = host;
    this.port    = port;
    this.timeout = timeout;
  }

  async comm(
    username: string,
    password: string,
    command:  string,
    params:   Record<string, string> = {}
  ): Promise<RouterOSResponse> {
    const words: string[] = [command];
    for (const [k, v] of Object.entries(params)) {
      if (k === "count-only") {
        words.push("=count-only=");
      } else if (k.startsWith("?")) {
        words.push(`${k}=${v}`);
      } else {
        words.push(`=${k}=${v}`);
      }
    }
    return this._execute(username, password, words);
  }

  private _execute(
    username: string,
    password: string,
    cmdWords: string[]
  ): Promise<RouterOSResponse> {
    return new Promise((resolve, reject) => {
      const sock = new net.Socket();
      sock.setTimeout(this.timeout);

      let rxBuf    = Buffer.alloc(0);
      let phase: "login" | "challenge" | "command" = "login";
      let settled  = false;
      const rows: RouterOSResponse = [];

      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        sock.destroy();
        err ? reject(err) : resolve(rows);
      };

      sock.on("timeout", () => done(new Error("Connection timeout ke " + this.host)));
      sock.on("error",   (e) => done(e));
      sock.on("close",   ()  => done());

      sock.on("data", (chunk: Buffer) => {
        // Tambahkan chunk ke buffer
        rxBuf = Buffer.concat([rxBuf, chunk]);

        // ── FIX: parse HANYA byte baru, potong yang sudah dikonsumsi ──
        const { sentences, consumed } = parseBuffer(rxBuf);
        rxBuf = rxBuf.slice(consumed); // ← hapus byte yang sudah jadi sentence lengkap

        for (const sentence of sentences) {
          if (settled || !sentence.length) continue;
          const type = sentence[0];

          // ── Phase LOGIN (v6.43+: plain-text) ────────────────────────
          if (phase === "login") {
            if (type === "!done") {
              phase = "command";
              rxBuf = Buffer.alloc(0);
              sock.write(encodeSentence(cmdWords));
              return;
            }
            if (type === "!trap") {
              return done(new Error("Login gagal: username/password salah"));
            }
            // RouterOS < v6.43: challenge-response
            const retWord = sentence.find((w) => w.startsWith("=ret="));
            if (retWord) {
              const challenge = retWord.slice("=ret=".length);
              const resp      = md5Challenge(password, challenge);
              phase           = "challenge";
              rxBuf           = Buffer.alloc(0);
              sock.write(encodeSentence(["/login", `=name=${username}`, `=response=00${resp}`]));
            }
            return;
          }

          // ── Phase CHALLENGE (v6.42 ke bawah) ────────────────────────
          if (phase === "challenge") {
            if (type === "!done") {
              phase = "command";
              rxBuf = Buffer.alloc(0);
              sock.write(encodeSentence(cmdWords));
              return;
            }
            if (type === "!trap") return done(new Error("Login gagal (challenge)"));
            return;
          }

          // ── Phase COMMAND — kumpulkan rows ───────────────────────────
          if (phase === "command") {
            if (type === "!re") {
              rows.push(sentenceToRow(sentence));

            } else if (type === "!done") {
              // count-only hasilkan =ret=N di dalam !done
              const retWord = sentence.find((w) => w.startsWith("=ret="));
              if (retWord) rows.push({ count: retWord.slice("=ret=".length) });
              return done();

            } else if (type === "!trap") {
              const msg = sentence.find((w) => w.startsWith("=message="));
              return done(new Error(msg ? msg.slice("=message=".length) : "RouterOS error"));

            } else if (type === "!fatal") {
              const msg = sentence.find((w) => w.startsWith("=message="));
              return done(new Error(msg ? msg.slice("=message=".length) : "RouterOS fatal"));
            }
          }
        }
      });

      sock.connect(this.port, this.host, () => {
        sock.write(encodeSentence(["/login", `=name=${username}`, `=password=${password}`]));
      });
    });
  }
}

export function createClient(host: string, port?: number): RouterOSClient {
  return new RouterOSClient(host, port ?? 8728, 8000);
}
