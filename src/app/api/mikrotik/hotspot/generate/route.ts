import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/routeros";

// ─── Random string generators (sama persis dengan logika Mikhmon) ─────────────

const LOWER  = "abcdefghjkmnpqrstuvwxyz";   // huruf kecil tanpa ambigu
const UPPER  = "ABCDEFGHJKMNPQRSTUVWXYZ";
const NUMS   = "23456789";                   // angka tanpa ambigu (0,1 dihilangkan)

function pick(pool: string, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += pool[Math.floor(Math.random() * pool.length)];
  return s;
}

function shuffle(str: string): string {
  return str.split("").sort(() => Math.random() - 0.5).join("");
}

/** Hasilkan satu random string sesuai opsi char mode Mikhmon */
function randStr(len: number, char: string): string {
  switch (char) {
    case "lower":   return pick(LOWER, len);
    case "upper":   return pick(UPPER, len);
    case "upplow":  return pick(LOWER + UPPER, len);
    case "mix":     return shuffle(pick(LOWER, Math.ceil(len * 0.6)) + pick(NUMS, Math.floor(len * 0.4)));
    case "mix1":    return shuffle(pick(UPPER, Math.ceil(len * 0.6)) + pick(NUMS, Math.floor(len * 0.4)));
    case "mix2":    return shuffle(pick(LOWER + UPPER, Math.ceil(len * 0.6)) + pick(NUMS, Math.floor(len * 0.4)));
    case "num":     return pick(NUMS, len);
    default:        return pick(LOWER + NUMS, len);
  }
}

/** Pastikan tidak ada duplikat dalam satu batch */
function generateUnique(
  qty: number,
  len: number,
  char: string,
  prefix: string,
  mode: "up" | "vc"
): { username: string; password: string }[] {
  const seen = new Set<string>();
  const result: { username: string; password: string }[] = [];
  let attempts = 0;

  while (result.length < qty && attempts < qty * 20) {
    attempts++;

    if (mode === "vc") {
      // voucher: username = password (mirip Mikhmon mode "vc")
      const code = prefix + randStr(len, char);
      if (seen.has(code)) continue;
      seen.add(code);
      result.push({ username: code, password: code });
    } else {
      // user-pass: username random huruf, password random angka
      const username = prefix + randStr(len, char);
      if (seen.has(username)) continue;
      seen.add(username);
      const password = pick(NUMS, len);
      result.push({ username, password });
    }
  }

  return result;
}

// ─── POST: generate & langsung push ke MikroTik ──────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isConnected || !session.host)
    return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const client = createClient(session.host, session.port);
  const u = session.username!;
  const p = session.password!;

  try {
    const body = await req.json();
    const {
      qty       = 1,
      server    = "all",
      mode      = "vc",   // "vc" = voucher, "up" = user-pass berbeda
      len       = 6,
      char      = "mix",
      prefix    = "",
      profile   = "default",
      timelimit = "",
      datalimit = "0",
      mbgb      = "1048576",
      comment   = "",
    } = body;

    const qtyNum = Math.min(Math.max(parseInt(qty) || 1, 1), 500);
    const lenNum = Math.min(Math.max(parseInt(len) || 6, 3), 12);

    // Buat tag unik batch: mirip Mikhmon "mode-code-date"
    const batchTag = `${mode}-${Date.now().toString(36)}-${new Date()
      .toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" })
      .replace(/\//g, ".")}${comment ? "-" + comment : ""}`;

    const finalData =
      !datalimit || datalimit === "0"
        ? "0"
        : String(parseInt(datalimit) * parseInt(mbgb));

    // Generate credentials unik
    const credentials = generateUnique(qtyNum, lenNum, char, prefix, mode as "up" | "vc");

    // Push ke MikroTik satu per satu
    const added: { username: string; password: string }[] = [];
    const errors: string[] = [];

    for (const cred of credentials) {
      try {
        await client.comm(u, p, "/ip/hotspot/user/add", {
          server,
          name:                cred.username,
          password:            cred.password,
          profile,
          disabled:            "no",
          "limit-uptime":      timelimit || "0",
          "limit-bytes-total": finalData,
          comment:             batchTag,
        });
        added.push(cred);
      } catch (e: any) {
        errors.push(`${cred.username}: ${e.message}`);
      }
    }

    return NextResponse.json({
      ok:       true,
      added,
      errors,
      batchTag,
      profile,
      timelimit: timelimit || "0",
      datalimit: finalData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
