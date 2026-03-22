"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

interface ActiveSession {
  ".id": string;
  user: string;
  address: string;
  "mac-address": string;
  uptime: string;
  "bytes-in": string;
  "bytes-out": string;
  "packets-in": string;
  "packets-out": string;
  server: string;
  "login-by": string;
  comment?: string;
}

function bytes(b: string | undefined) {
  const n = parseInt(b || "0");
  if (!n) return "0 B";
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + " GB";
  if (n >= 1048576) return (n / 1048576).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(2) + " KB";
  return n + " B";
}

export default function ActiveSessionsPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kicking, setKicking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mikrotik/hotspot/active");
      const data = await res.json();
      setSessions(data.active ?? []);
    } catch {
      toast("Gagal memuat sesi aktif", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // auto refresh tiap 5 detik
    return () => clearInterval(t);
  }, [load]);

  const kickUser = async (session: ActiveSession) => {
    if (!confirm(`Kick user "${session.user}"?`)) return;
    setKicking(session[".id"]);
    try {
      const res = await fetch("/api/mikrotik/hotspot/active", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session[".id"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`User "${session.user}" berhasil dikick`, "success");
      load();
    } catch (e: any) {
      toast(e.message || "Gagal kick user", "error");
    } finally {
      setKicking(null);
    }
  };

  const filtered = sessions.filter(
    (s) =>
      s.user?.toLowerCase().includes(search.toLowerCase()) ||
      s.address?.includes(search) ||
      s["mac-address"]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Active Sessions</h1>
          <p className="text-text-secondary text-sm mt-0.5 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
            {sessions.length} user online &bull; auto-refresh setiap 5 detik
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Online", value: sessions.length, color: "text-success" },
          {
            label: "Total In",
            value: bytes(
              String(sessions.reduce((a, s) => a + parseInt(s["bytes-in"] || "0"), 0))
            ),
            color: "text-info",
          },
          {
            label: "Total Out",
            value: bytes(
              String(sessions.reduce((a, s) => a + parseInt(s["bytes-out"] || "0"), 0))
            ),
            color: "text-warning",
          },
          {
            label: "Servers",
            value: [...new Set(sessions.map((s) => s.server))].length,
            color: "text-accent",
          },
        ].map((c, i) => (
          <div key={i} className="stat-card stat-card-accent">
            <div className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</div>
            <div className="text-text-secondary text-xs mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cari username, IP, atau MAC..."
        className="form-input max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-secondary">
              <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              <span className="text-sm font-mono">Memuat sesi aktif...</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>MAC Address</th>
                  <th>Uptime</th>
                  <th>Download</th>
                  <th>Upload</th>
                  <th>Server</th>
                  <th>Login By</th>
                  <th style={{ width: 80 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s[".id"]}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0 animate-pulse" />
                        <span className="text-accent font-medium">{s.user}</span>
                      </div>
                    </td>
                    <td>{s.address || "—"}</td>
                    <td className="text-text-secondary text-xs">{s["mac-address"] || "—"}</td>
                    <td className="text-success">{s.uptime || "—"}</td>
                    <td className="text-info">{bytes(s["bytes-in"])}</td>
                    <td className="text-warning">{bytes(s["bytes-out"])}</td>
                    <td>
                      <span className="badge badge-neutral">{s.server || "—"}</span>
                    </td>
                    <td className="text-text-secondary text-xs">{s["login-by"] || "—"}</td>
                    <td>
                      <button
                        onClick={() => kickUser(s)}
                        disabled={kicking === s[".id"]}
                        className="btn btn-danger btn-sm px-2 py-1 text-xs"
                        title="Kick"
                      >
                        {kicking === s[".id"] ? (
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 11-6.219-8.56"/>
                          </svg>
                        ) : (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                            </svg>
                            Kick
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-text-muted">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-2 opacity-30">
                        <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                      </svg>
                      Tidak ada sesi aktif saat ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
