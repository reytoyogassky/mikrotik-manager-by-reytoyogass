"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";

interface HotspotUser {
  ".id": string;
  name: string;
  password: string;
  profile: string;
  comment: string;
  disabled: string;
  "limit-uptime": string;
  "limit-bytes-total": string;
}

interface Profile {
  ".id": string;
  name: string;
}

const EMPTY_FORM = {
  name: "", password: "", profile: "default",
  server: "all", comment: "",
  timelimit: "", datalimit: "", mbgb: "1048576", disabled: "no",
};

function bytes(b: string | undefined) {
  const n = parseInt(b || "0");
  if (!n) return "—";
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + " GB";
  if (n >= 1048576)    return (n / 1048576).toFixed(2) + " MB";
  if (n >= 1024)       return (n / 1024).toFixed(2) + " KB";
  return n + " B";
}

/** Hapus duplikat berdasarkan key tertentu */
function dedup<T>(arr: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function HotspotUsersPage() {
  const { toast }  = useToast();
  const [users,    setUsers]    = useState<HotspotUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [profileFilter, setProfileFilter] = useState("all");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal,    setModal]    = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<HotspotUser | null>(null);
  const [form,     setForm]     = useState({ ...EMPTY_FORM });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cegah dua request sekaligus
  const fetchingRef = useRef(false);

  const loadUsers = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (profileFilter !== "all") params.set("profile", profileFilter);
      const res  = await fetch(`/api/mikrotik/hotspot/users?${params}`);
      const data = await res.json();

      // Dedup berdasarkan .id (safety net selain fix di routeros.ts)
      setUsers(dedup<HotspotUser>(data.users ?? [], ".id"));
      setProfiles(dedup<Profile>(data.profiles ?? [], ".id"));
    } catch {
      toast("Gagal memuat data users", "error");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [profileFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.comment?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((u) => u[".id"])));
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, profile: profiles[0]?.name || "default" });
    setEditTarget(null);
    setModal("add");
  };

  const openEdit = (user: HotspotUser) => {
    setForm({
      name:      user.name,
      password:  user.password || "",
      profile:   user.profile || "default",
      server:    "all",
      comment:   (user.comment || "").replace(/^(vc-|up-)/, ""),
      timelimit: user["limit-uptime"] || "",
      datalimit: "0",
      mbgb:      "1048576",
      disabled:  user.disabled || "no",
    });
    setEditTarget(user);
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.name) { toast("Nama user wajib diisi", "error"); return; }
    setSaving(true);
    try {
      const method = modal === "add" ? "POST" : "PUT";
      const body   = modal === "edit" && editTarget
        ? { id: editTarget[".id"], ...form }
        : form;
      const res  = await fetch("/api/mikrotik/hotspot/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`User "${form.name}" berhasil ${modal === "add" ? "ditambahkan" : "diupdate"}`, "success");
      setModal(null);
      loadUsers();
    } catch (e: any) {
      toast(e.message || "Gagal menyimpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Hapus ${ids.length} user? Aksi ini tidak dapat dibatalkan.`)) return;
    setDeleting(true);
    try {
      const res  = await fetch("/api/mikrotik/hotspot/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${data.deleted} user berhasil dihapus`, "success");
      setSelected(new Set());
      loadUsers();
    } catch (e: any) {
      toast(e.message || "Gagal menghapus", "error");
    } finally {
      setDeleting(false);
    }
  };

  const toggleDisable = async (user: HotspotUser) => {
    const newState = user.disabled === "true" ? "no" : "yes";
    try {
      await fetch("/api/mikrotik/hotspot/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user[".id"], disabled: newState }),
      });
      toast(`User ${newState === "yes" ? "dinonaktifkan" : "diaktifkan"}`, "success");
      loadUsers();
    } catch {
      toast("Gagal mengubah status", "error");
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Hotspot Users</h1>
          <p className="text-text-secondary text-sm mt-0.5 font-mono">
            {users.length} users terdaftar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={() => handleDelete([...selected])} disabled={deleting} className="btn btn-danger btn-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Hapus {selected.size}
            </button>
          )}
          <button onClick={loadUsers} className="btn btn-ghost btn-sm">
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
            Tambah User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Cari username / komentar..."
          className="form-input max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input w-auto"
          value={profileFilter}
          onChange={(e) => { setProfileFilter(e.target.value); setSelected(new Set()); }}
        >
          <option value="all">Semua Profile</option>
          {profiles.map((p) => (
            <option key={p[".id"]} value={p.name}>{p.name}</option>
          ))}
        </select>
        <span className="text-text-muted text-xs font-mono">
          Menampilkan {filtered.length} dari {users.length}
        </span>
      </div>

      {/* Table */}
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
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="accent-accent cursor-pointer"
                    />
                  </th>
                  <th>Username</th>
                  <th>Profile</th>
                  <th>Comment</th>
                  <th>Data Limit</th>
                  <th>Time Limit</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user[".id"]}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(user[".id"])}
                        onChange={() => toggleSelect(user[".id"])}
                        className="accent-accent cursor-pointer"
                      />
                    </td>
                    <td><span className="text-accent font-medium">{user.name}</span></td>
                    <td><span className="badge badge-info">{user.profile}</span></td>
                    <td className="text-text-secondary text-xs max-w-[160px] truncate">
                      {user.comment || "—"}
                    </td>
                    <td>{bytes(user["limit-bytes-total"])}</td>
                    <td>{user["limit-uptime"] || "—"}</td>
                    <td>
                      <button
                        onClick={() => toggleDisable(user)}
                        className={`badge cursor-pointer ${user.disabled === "true" ? "badge-danger" : "badge-success"}`}
                      >
                        {user.disabled === "true" ? "disabled" : "enabled"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(user)} className="btn btn-ghost btn-sm px-2 py-1" title="Edit">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete([user[".id"]])} className="btn btn-danger btn-sm px-2 py-1" title="Hapus">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-text-muted">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-2 opacity-30">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      </svg>
                      Tidak ada user ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Add/Edit */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="card-header">
              <h3 className="font-semibold text-text-primary text-sm">
                {modal === "add" ? "Tambah User Baru" : `Edit User: ${editTarget?.name}`}
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
                  <label className="form-label">Username *</label>
                  <input type="text" className="form-input" placeholder="user01"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <input type="text" className="form-input" placeholder="Kosong = sama dengan username"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Profile</label>
                  <select className="form-input" value={form.profile}
                    onChange={(e) => setForm({ ...form, profile: e.target.value })}>
                    {profiles.map((p) => (
                      <option key={p[".id"]} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.disabled}
                    onChange={(e) => setForm({ ...form, disabled: e.target.value })}>
                    <option value="no">Enabled</option>
                    <option value="yes">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Time Limit</label>
                  <input type="text" className="form-input" placeholder="1h / 30m / 0"
                    value={form.timelimit} onChange={(e) => setForm({ ...form, timelimit: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Data Limit</label>
                  <div className="flex gap-2">
                    <input type="number" className="form-input" placeholder="0 = unlimited"
                      value={form.datalimit} onChange={(e) => setForm({ ...form, datalimit: e.target.value })} />
                    <select className="form-input w-24" value={form.mbgb}
                      onChange={(e) => setForm({ ...form, mbgb: e.target.value })}>
                      <option value="1048576">MB</option>
                      <option value="1073741824">GB</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Komentar</label>
                <input type="text" className="form-input" placeholder="Opsional"
                  value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
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
                  ) : modal === "add" ? "Tambah User" : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
