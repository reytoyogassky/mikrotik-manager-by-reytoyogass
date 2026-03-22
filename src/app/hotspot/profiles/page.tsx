"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";

interface UserProfile {
  ".id": string;
  name: string;
  "shared-users": string;
  "rate-limit": string;
  "session-timeout": string;
  "idle-timeout": string;
  "keepalive-timeout": string;
  "on-login": string;
  "on-logout": string;
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

const EMPTY_FORM = {
  name: "",
  "shared-users": "1",
  "rate-limit": "",
  "session-timeout": "",
  "idle-timeout": "",
  "on-login": "",
  "on-logout": "",
};

export default function ProfilesPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/mikrotik/hotspot/profiles");
      const data = await res.json();
      setProfiles(dedup<UserProfile>(data.profiles ?? [], ".id"));
    } catch {
      toast("Gagal memuat profiles", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditTarget(null);
    setModal("add");
  };

  const openEdit = (p: UserProfile) => {
    setForm({
      name: p.name,
      "shared-users": p["shared-users"] || "1",
      "rate-limit": p["rate-limit"] || "",
      "session-timeout": p["session-timeout"] || "",
      "idle-timeout": p["idle-timeout"] || "",
      "on-login": p["on-login"] || "",
      "on-logout": p["on-logout"] || "",
    });
    setEditTarget(p);
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.name) { toast("Nama profile wajib diisi", "error"); return; }
    setSaving(true);
    try {
      const method = modal === "add" ? "POST" : "PUT";
      const body = modal === "edit" ? { id: editTarget![".id"], ...form } : form;
      const res = await fetch("/api/mikrotik/hotspot/profiles", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Profile "${form.name}" berhasil ${modal === "add" ? "ditambahkan" : "diupdate"}`, "success");
      setModal(null);
      load();
    } catch (e: any) {
      toast(e.message || "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: UserProfile) => {
    if (!confirm(`Hapus profile "${p.name}"? Pastikan tidak ada user yang menggunakan profile ini.`)) return;
    try {
      const res = await fetch("/api/mikrotik/hotspot/profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p[".id"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Profile "${p.name}" dihapus`, "success");
      load();
    } catch (e: any) {
      toast(e.message || "Gagal menghapus", "error");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">User Profiles</h1>
          <p className="text-text-secondary text-sm mt-0.5 font-mono">
            {profiles.length} profiles tersedia
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-ghost btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh
          </button>
          <button onClick={openAdd} className="btn btn-primary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Tambah Profile
          </button>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-secondary">
              <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              <span className="text-sm font-mono">Memuat...</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Profile</th>
                  <th>Shared Users</th>
                  <th>Rate Limit</th>
                  <th>Session Timeout</th>
                  <th>Idle Timeout</th>
                  <th>On Login</th>
                  <th style={{ width: 100 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p[".id"]}>
                    <td>
                      <span className="text-accent font-medium">{p.name}</span>
                    </td>
                    <td className="text-center">{p["shared-users"] || "1"}</td>
                    <td>
                      {p["rate-limit"] ? (
                        <span className="badge badge-warning">{p["rate-limit"]}</span>
                      ) : "—"}
                    </td>
                    <td>{p["session-timeout"] || "—"}</td>
                    <td>{p["idle-timeout"] || "—"}</td>
                    <td className="text-text-secondary text-xs max-w-[120px] truncate">
                      {p["on-login"] || "—"}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="btn btn-ghost btn-sm px-2 py-1" title="Edit">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(p)} className="btn btn-danger btn-sm px-2 py-1" title="Hapus">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-text-muted">
                      Tidak ada profile ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="card-header">
              <h3 className="font-semibold text-text-primary text-sm">
                {modal === "add" ? "Tambah Profile Baru" : `Edit Profile: ${editTarget?.name}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nama Profile *</label>
                  <input type="text" className="form-input" placeholder="premium-1mbps" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Shared Users</label>
                  <input type="number" className="form-input" placeholder="1" value={form["shared-users"]}
                    onChange={(e) => setForm({ ...form, "shared-users": e.target.value })} />
                </div>
              </div>

              <div>
                <label className="form-label">Rate Limit</label>
                <input type="text" className="form-input" placeholder="1M/1M atau 512k/1M" value={form["rate-limit"]}
                  onChange={(e) => setForm({ ...form, "rate-limit": e.target.value })} />
                <p className="text-text-muted text-xs mt-1">Format: upload/download (contoh: 1M/2M)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Session Timeout</label>
                  <input type="text" className="form-input" placeholder="1h / 1d / 0s" value={form["session-timeout"]}
                    onChange={(e) => setForm({ ...form, "session-timeout": e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Idle Timeout</label>
                  <input type="text" className="form-input" placeholder="5m / 0s" value={form["idle-timeout"]}
                    onChange={(e) => setForm({ ...form, "idle-timeout": e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">On Login Script</label>
                  <input type="text" className="form-input" placeholder="nama script" value={form["on-login"]}
                    onChange={(e) => setForm({ ...form, "on-login": e.target.value })} />
                </div>
                <div>
                  <label className="form-label">On Logout Script</label>
                  <input type="text" className="form-input" placeholder="nama script" value={form["on-logout"]}
                    onChange={(e) => setForm({ ...form, "on-logout": e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setModal(null)} className="btn btn-ghost">Batal</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      Menyimpan...
                    </>
                  ) : modal === "add" ? "Tambah Profile" : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
