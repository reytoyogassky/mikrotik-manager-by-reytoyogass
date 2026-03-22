"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

interface Profile {
  ".id": string;
  name: string;
}

interface GeneratedUser {
  username: string;
  password: string;
}

interface BatchResult {
  added:     GeneratedUser[];
  errors:    string[];
  batchTag:  string;
  profile:   string;
  timelimit: string;
  datalimit: string;
}

function dedup<T>(arr: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const CHAR_OPTIONS = [
  { value: "lower",  label: "Huruf kecil  (abcd)" },
  { value: "upper",  label: "Huruf besar  (ABCD)" },
  { value: "upplow", label: "Huruf campur (aBcD)" },
  { value: "mix",    label: "Huruf+angka kecil  (5ab2c)" },
  { value: "mix1",   label: "Huruf+angka besar  (5AB2C)" },
  { value: "mix2",   label: "Huruf+angka campur (5aB2C)" },
  { value: "num",    label: "Angka saja  (12345)" },
];

function bytes(b: string) {
  const n = parseInt(b || "0");
  if (!n) return "Unlimited";
  if (n >= 1073741824) return (n / 1073741824).toFixed(1) + " GB";
  if (n >= 1048576)    return (n / 1048576).toFixed(1) + " MB";
  return n + " B";
}

/** Buat CSV string dari hasil generate */
function buildCSV(
  rows: GeneratedUser[],
  meta: { profile: string; timelimit: string; datalimit: string; batchTag: string }
): string {
  const header = ["No", "Username", "Password", "Profile", "Time Limit", "Data Limit", "Batch"].join(",");
  const lines  = rows.map((r, i) =>
    [
      i + 1,
      `"${r.username}"`,
      `"${r.password}"`,
      `"${meta.profile}"`,
      `"${meta.timelimit || "0"}"`,
      `"${bytes(meta.datalimit)}"`,
      `"${meta.batchTag}"`,
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM agar Excel baca dengan benar
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VoucherPage() {
  const { toast } = useToast();

  // Form state
  const [profiles,  setProfiles]  = useState<Profile[]>([]);
  const [form, setForm] = useState({
    qty:       "10",
    server:    "all",
    mode:      "vc",   // "vc" = voucher (user=pass), "up" = user-pass beda
    len:       "6",
    char:      "mix",
    prefix:    "",
    profile:   "default",
    timelimit: "",
    datalimit: "0",
    mbgb:      "1048576",
    comment:   "",
  });

  // Result state
  const [result,    setResult]    = useState<BatchResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState("");

  // Load profiles on mount
  const loadProfiles = useCallback(async () => {
    try {
      const res  = await fetch("/api/mikrotik/hotspot/profiles");
      const data = await res.json();
      const list: Profile[] = dedup<Profile>(data.profiles ?? [], ".id");
      setProfiles(list);
      if (list.length > 0)
        setForm((f) => ({ ...f, profile: list[0].name }));
    } catch {
      toast("Gagal memuat profiles", "error");
    }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // Generate
  const handleGenerate = async () => {
    const qty = parseInt(form.qty);
    if (!qty || qty < 1) { toast("Jumlah minimal 1", "error"); return; }
    if (qty > 500)        { toast("Maksimal 500 voucher per batch", "error"); return; }

    setLoading(true);
    setResult(null);

    try {
      const res  = await fetch("/api/mikrotik/hotspot/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResult(data);

      if (data.errors?.length > 0) {
        toast(`${data.added.length} berhasil, ${data.errors.length} gagal`, "info");
      } else {
        toast(`${data.added.length} voucher berhasil dibuat!`, "success");
      }
    } catch (e: any) {
      toast(e.message || "Generate gagal", "error");
    } finally {
      setLoading(false);
    }
  };

  // CSV Download
  const handleCSV = () => {
    if (!result?.added.length) return;
    const csv  = buildCSV(result.added, result);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `voucher-${result.profile}-${date}.csv`);
    toast("CSV berhasil diunduh", "success");
  };

  // Filtered preview
  const filteredRows = (result?.added ?? []).filter(
    (r) =>
      r.username.toLowerCase().includes(search.toLowerCase()) ||
      r.password.toLowerCase().includes(search.toLowerCase())
  );

  // ─── UI ───────────────────────────────────────────────────────────────────

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Generate Voucher</h1>
        <p className="text-text-secondary text-sm mt-0.5 font-mono">
          Buat banyak user hotspot sekaligus, download CSV
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ── Form Panel ──────────────────────────────────────────────── */}
        <div className="xl:col-span-2 card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Pengaturan Generate
            </h2>
          </div>
          <div className="card-body space-y-4">
            {/* Jumlah & Mode */}
            <div className="grid grid-cols-2 gap-3">
              {field(
                "Jumlah Voucher",
                <input type="number" min={1} max={500} className="form-input"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              )}
              {field(
                "Mode",
                <select className="form-input" value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  <option value="vc">Voucher  (user = pass)</option>
                  <option value="up">User-Pass (beda)</option>
                </select>
              )}
            </div>

            {/* Panjang & Karakter */}
            <div className="grid grid-cols-2 gap-3">
              {field(
                "Panjang",
                <select className="form-input" value={form.len}
                  onChange={(e) => setForm({ ...form, len: e.target.value })}>
                  {[3,4,5,6,7,8,10,12].map((n) => (
                    <option key={n} value={n}>{n} karakter</option>
                  ))}
                </select>
              )}
              {field(
                "Tipe Karakter",
                <select className="form-input" value={form.char}
                  onChange={(e) => setForm({ ...form, char: e.target.value })}>
                  {CHAR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Prefix & Profile */}
            <div className="grid grid-cols-2 gap-3">
              {field(
                "Prefix  (opsional)",
                <input type="text" maxLength={8} className="form-input" placeholder="mis. vch-"
                  value={form.prefix}
                  onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
              )}
              {field(
                "Profile",
                <select className="form-input" value={form.profile}
                  onChange={(e) => setForm({ ...form, profile: e.target.value })}>
                  {profiles.map((p) => (
                    <option key={p[".id"]} value={p.name}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Server */}
            {field(
              "Server",
              <input type="text" className="form-input" placeholder="all"
                value={form.server}
                onChange={(e) => setForm({ ...form, server: e.target.value })} />
            )}

            {/* Time Limit */}
            {field(
              "Time Limit",
              <input type="text" className="form-input" placeholder="1h / 30m / 1d  (kosong = unlimited)"
                value={form.timelimit}
                onChange={(e) => setForm({ ...form, timelimit: e.target.value })} />
            )}

            {/* Data Limit */}
            {field(
              "Data Limit",
              <div className="flex gap-2">
                <input type="number" min={0} className="form-input" placeholder="0 = unlimited"
                  value={form.datalimit}
                  onChange={(e) => setForm({ ...form, datalimit: e.target.value })} />
                <select className="form-input w-24"
                  value={form.mbgb}
                  onChange={(e) => setForm({ ...form, mbgb: e.target.value })}>
                  <option value="1048576">MB</option>
                  <option value="1073741824">GB</option>
                </select>
              </div>
            )}

            {/* Komentar */}
            {field(
              "Komentar Tambahan  (opsional)",
              <input type="text" className="form-input" placeholder="batch-jan / promo-weekend"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            )}

            {/* Submit */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="btn btn-primary w-full justify-center py-3 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Membuat voucher...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Generate {form.qty} Voucher
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Result Panel ────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          {/* Info batch */}
          {result && (
            <div className="card">
              <div className="card-body">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: "Berhasil",    value: result.added.length,   color: "text-success" },
                    { label: "Gagal",       value: result.errors.length,  color: result.errors.length > 0 ? "text-danger" : "text-text-muted" },
                    { label: "Profile",     value: result.profile,        color: "text-accent" },
                    { label: "Time Limit",  value: result.timelimit || "Unlimited", color: "text-warning" },
                  ].map((s, i) => (
                    <div key={i} className="stat-card stat-card-accent">
                      <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
                      <div className="text-text-muted text-xs mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Batch tag */}
                <div className="flex items-center gap-2 text-xs font-mono text-text-secondary bg-bg-elevated border border-bg-border rounded px-3 py-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  Batch: <span className="text-accent">{result.batchTag}</span>
                </div>

                {/* Error list jika ada */}
                {result.errors.length > 0 && (
                  <div className="mt-3 bg-danger/5 border border-danger/20 rounded p-3">
                    <p className="text-danger text-xs font-semibold mb-1">Error saat menambahkan:</p>
                    <ul className="space-y-0.5">
                      {result.errors.map((e, i) => (
                        <li key={i} className="text-danger/80 text-xs font-mono">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Preview Voucher
                {result && (
                  <span className="badge badge-success ml-1">{result.added.length} voucher</span>
                )}
              </h2>

              {result && result.added.length > 0 && (
                <button onClick={handleCSV} className="btn btn-primary btn-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download CSV
                </button>
              )}
            </div>

            {result && result.added.length > 0 && (
              <div className="px-5 py-3 border-b border-bg-border">
                <input
                  type="text"
                  className="form-input max-w-xs"
                  placeholder="Filter username / password..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            <div className="overflow-x-auto" style={{ maxHeight: "480px", overflowY: "auto" }}>
              {!result ? (
                <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 opacity-30">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  <p className="text-sm">Isi form dan klik Generate untuk membuat voucher</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 48 }}>No</th>
                      <th>Username</th>
                      <th>Password</th>
                      <th>Profile</th>
                      <th>Time Limit</th>
                      <th>Data Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => (
                      <tr key={i}>
                        <td className="text-text-muted">{i + 1}</td>
                        <td>
                          <span className="text-accent font-medium">{r.username}</span>
                        </td>
                        <td>
                          <span className={`font-mono ${
                            r.username === r.password
                              ? "text-text-secondary"   // vc mode: sama
                              : "text-warning"          // up mode: beda
                          }`}>
                            {r.password}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-info">{result.profile}</span>
                        </td>
                        <td className="text-text-secondary">
                          {result.timelimit || "Unlimited"}
                        </td>
                        <td className="text-text-secondary">
                          {bytes(result.datalimit)}
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-text-muted">
                          Tidak ada hasil yang cocok
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer summary */}
            {result && result.added.length > 0 && (
              <div className="px-5 py-3 border-t border-bg-border flex items-center justify-between text-xs text-text-muted font-mono">
                <span>
                  Menampilkan {filteredRows.length} dari {result.added.length} voucher
                </span>
                <button
                  onClick={handleCSV}
                  className="text-accent hover:text-accent-dim flex items-center gap-1 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
