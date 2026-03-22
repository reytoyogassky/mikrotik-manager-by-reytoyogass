"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    label: "Hotspot Users",
    href: "/hotspot/users",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: "Generate Voucher",
    href: "/hotspot/voucher",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  },
  {
    label: "User Profile",
    href: "/hotspot/profiles",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  },
  {
    label: "Active Sessions",
    href: "/hotspot/active",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  },
];

export default function Sidebar({ host, username }: { host: string; username: string }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open,   setOpen]   = useState(false);
  const [busy,   setBusy]   = useState(false);

  // Tutup sidebar saat navigasi (mobile)
  useEffect(() => { setOpen(false); }, [pathname]);

  // Tutup sidebar saat klik di luar (mobile)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const sidebar = document.getElementById("main-sidebar");
      if (sidebar && !sidebar.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleDisconnect = async () => {
    setBusy(true);
    await fetch("/api/mikrotik/disconnect", { method: "POST" });
    router.push("/");
  };

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="p-4 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="#00d4aa" strokeWidth="1.5"/>
              <circle cx="5.5" cy="10" r="1" fill="#00d4aa"/>
              <circle cx="5.5" cy="14" r="1" fill="#00d4aa" opacity="0.4"/>
              <rect x="9" y="9" width="10" height="1.5" rx="0.75" fill="#00d4aa" opacity="0.5"/>
              <rect x="9" y="13" width="7" height="1.5" rx="0.75" fill="#00d4aa" opacity="0.3"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-text-primary font-semibold text-sm leading-none">MikroTik</div>
            <div className="text-text-muted text-xs mt-0.5 font-mono truncate">{host}</div>
          </div>
          {/* Close btn mobile only */}
          <button
            onClick={() => setOpen(false)}
            className="ml-auto md:hidden text-text-muted hover:text-text-primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"/>
          <span className="text-success text-xs font-mono">{username}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="text-text-muted text-[10px] uppercase tracking-widest font-mono px-3 py-2">Menu</div>
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Disconnect */}
      <div className="p-3 border-t border-bg-border">
        <button
          onClick={handleDisconnect}
          disabled={busy}
          className="btn btn-ghost btn-sm w-full justify-center text-danger hover:text-danger hover:bg-danger/10 hover:border-danger/30"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {busy ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 bg-bg-surface border-b border-bg-border px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          className="text-text-secondary hover:text-text-primary"
          aria-label="Buka menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="#00d4aa" strokeWidth="1.5"/>
            <circle cx="5.5" cy="10" r="1" fill="#00d4aa"/>
            <rect x="9" y="9" width="10" height="1.5" rx="0.75" fill="#00d4aa" opacity="0.5"/>
          </svg>
          <span className="text-text-primary font-semibold text-sm">MikroTik Manager</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"/>
          <span className="text-success text-xs font-mono truncate max-w-[100px]">{host}</span>
        </div>
      </div>

      {/* ── Mobile overlay ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      <aside
        id="main-sidebar"
        className={`
          fixed top-0 left-0 h-full z-50 w-64 flex flex-col bg-bg-surface border-r border-bg-border
          transform transition-transform duration-200 ease-out
          md:relative md:translate-x-0 md:w-56 md:flex-shrink-0
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:h-screen md:sticky md:top-0
        `}
      >
        <SidebarContent/>
      </aside>
    </>
  );
}
