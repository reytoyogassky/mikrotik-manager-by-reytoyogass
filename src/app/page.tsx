"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    host: "",
    port: "8728",
    username: "admin",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/mikrotik/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Koneksi gagal");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-info/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4 glow-accent-sm">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="3" y="8" width="26" height="16" rx="2" fill="none" stroke="#00d4aa" strokeWidth="1.5"/>
              <circle cx="7" cy="12" r="1.5" fill="#00d4aa"/>
              <circle cx="7" cy="16" r="1.5" fill="#00d4aa" opacity="0.5"/>
              <circle cx="7" cy="20" r="1.5" fill="#00d4aa" opacity="0.3"/>
              <rect x="12" y="11" width="14" height="1.5" rx="0.75" fill="#00d4aa" opacity="0.6"/>
              <rect x="12" y="15" width="10" height="1.5" rx="0.75" fill="#00d4aa" opacity="0.4"/>
              <rect x="12" y="19" width="12" height="1.5" rx="0.75" fill="#00d4aa" opacity="0.3"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            MikroTik Manager
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Hubungkan ke RouterOS via API
          </p>
        </div>

        {/* Form card */}
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleConnect} className="space-y-4">
              {/* Host & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="form-label">IP Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="192.168.1.1"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label">Port API</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="8728"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="admin"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-danger text-sm bg-danger/5 border border-danger/20 rounded px-3 py-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary w-full justify-center py-3 text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Menghubungkan...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                    Connect
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Info */}
        <p className="text-center text-text-muted text-xs mt-6">
          Pastikan API service aktif di{" "}
          <span className="text-text-secondary font-mono">IP → Services → api</span>
        </p>
      </div>
    </div>
  );
}
