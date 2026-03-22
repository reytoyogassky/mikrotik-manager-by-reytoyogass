"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface DashboardData {
  resource:    Record<string, string>;
  routerboard: Record<string, string>;
  clock:       Record<string, string>;
  countUsers:  number | string;
  countActive: number | string;
  interfaces:  Record<string, string>[];
}
interface BwPoint { ts: number; rxBps: number; txBps: number; }
interface IfaceBw  { name: string; rxBps: number; txBps: number; }

const MAX_POINTS = 30;

function fBytes(b: number) {
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + " GB";
  if (b >= 1048576)    return (b / 1048576).toFixed(1) + " MB";
  if (b >= 1024)       return (b / 1024).toFixed(1) + " KB";
  return b + " B";
}
function fBits(bps: number) {
  if (bps >= 1_000_000_000) return (bps / 1_000_000_000).toFixed(2) + " Gbps";
  if (bps >= 1_000_000)     return (bps / 1_000_000).toFixed(2) + " Mbps";
  if (bps >= 1_000)         return (bps / 1_000).toFixed(1) + " Kbps";
  return bps + " bps";
}

// ─── Canvas bandwidth chart ───────────────────────────────────────────────────
function BandwidthChart({ points }: { points: BwPoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx)  return;

    // DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);
    if (points.length < 2) return;

    const maxVal = Math.max(...points.flatMap((p) => [p.rxBps, p.txBps]), 1);

    // Horizontal grid
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (H * i) / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const pad   = 4;
    const step  = W / (MAX_POINTS - 1);
    const startX = (MAX_POINTS - points.length) * step;

    const plot = (vals: number[], color: string) => {
      // Fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = startX + i * step;
        const y = H - pad - (v / maxVal) * (H - pad * 2);
        i === 0 ? ctx.moveTo(x, H) : void 0;
        i === 0 ? ctx.lineTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(startX + (vals.length - 1) * step, H);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = "round";
      ctx.lineCap     = "round";
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = startX + i * step;
        const y = H - pad - (v / maxVal) * (H - pad * 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    plot(points.map((p) => p.rxBps), "#00d4aa");
    plot(points.map((p) => p.txBps), "#ffa502");

    // Y-axis label (top)
    ctx.fillStyle  = "rgba(107,143,168,0.8)";
    ctx.font       = `${10 * dpr / dpr}px JetBrains Mono, monospace`;
    ctx.textAlign  = "left";
    ctx.fillText(fBits(maxVal), 4, 12);
  }, [points]);

  return <canvas ref={ref} className="w-full h-full block"/>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data,        setData]        = useState<DashboardData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [bwHistory,   setBwHistory]   = useState<BwPoint[]>([]);
  const [ifacesBw,    setIfacesBw]    = useState<IfaceBw[]>([]);
  const [activeIface, setActiveIface] = useState("all");
  const bwTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/mikrotik/dashboard");
      if (!r.ok) throw new Error("Gagal memuat data");
      setData(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const pollBw = useCallback(async () => {
    try {
      const r    = await fetch(`/api/mikrotik/bandwidth?iface=${activeIface}`);
      if (!r.ok) return;
      const json = await r.json();
      const ifaces: IfaceBw[] = json.interfaces ?? [];
      setIfacesBw(ifaces);
      const rx = ifaces.reduce((s, i) => s + i.rxBps, 0);
      const tx = ifaces.reduce((s, i) => s + i.txBps, 0);
      setBwHistory((prev) => [...prev, { ts: Date.now(), rxBps: rx, txBps: tx }].slice(-MAX_POINTS));
    } catch { /* silent */ }
  }, [activeIface]);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 10_000);
    return () => clearInterval(t);
  }, [loadStats]);

  useEffect(() => {
    setBwHistory([]);
    pollBw();
    bwTimer.current = setInterval(pollBw, 2_000);
    return () => { if (bwTimer.current) clearInterval(bwTimer.current); };
  }, [pollBw]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-3">
        <svg className="animate-spin mx-auto text-accent" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        <p className="text-sm font-mono text-text-secondary">Memuat data router...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-4">
      <div className="text-danger text-sm font-mono bg-danger/5 border border-danger/20 rounded p-4">Error: {error}</div>
    </div>
  );

  const res      = data?.resource ?? {};
  const totalMem = parseInt(res["total-memory"]) || 1;
  const freeMem  = parseInt(res["free-memory"])  || 0;
  const usedMem  = totalMem - freeMem;
  const memPct   = Math.round((usedMem / totalMem) * 100);
  const totalHdd = parseInt(res["total-hdd-space"]) || 1;
  const freeHdd  = parseInt(res["free-hdd-space"])  || 0;
  const usedHdd  = totalHdd - freeHdd;
  const hddPct   = Math.round((usedHdd / totalHdd) * 100);
  const cpu      = parseInt(res["cpu-load"]) || 0;

  const latestBw = bwHistory[bwHistory.length - 1];
  const totalRx  = latestBw?.rxBps ?? 0;
  const totalTx  = latestBw?.txBps ?? 0;

  const statCards = [
    {
      label: "HS Users", value: String(data?.countUsers ?? "—"), suffix: "",
      valueColor: "text-accent", barColor: "", pct: 0,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      label: "Online", value: String(data?.countActive ?? "—"), suffix: "",
      valueColor: "text-success", barColor: "", pct: 0,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
    },
    {
      label: "CPU", value: String(cpu), suffix: "%",
      valueColor: cpu > 80 ? "text-danger" : cpu > 50 ? "text-warning" : "text-info",
      barColor:   cpu > 80 ? "bg-danger"   : cpu > 50 ? "bg-warning"   : "bg-info",
      pct: cpu,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>,
    },
    {
      label: "RAM", value: String(memPct), suffix: "%",
      valueColor: memPct > 85 ? "text-danger" : memPct > 65 ? "text-warning" : "text-info",
      barColor:   memPct > 85 ? "bg-danger"   : memPct > 65 ? "bg-warning"   : "bg-info",
      pct: memPct,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 19v-3m4 3v-7m4 7v-5m4 5v-9"/><rect x="2" y="2" width="20" height="20" rx="2"/></svg>,
    },
  ];

  const runningIfaces = (data?.interfaces ?? []).filter(i => i["running"] === "true").slice(0, 5);

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-4 md:space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary text-xs md:text-sm mt-0.5 font-mono truncate max-w-[240px] sm:max-w-none">
            {res["board-name"] || data?.routerboard?.model || "MikroTik"} — RouterOS {res["version"]}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary font-mono bg-bg-surface border border-bg-border rounded px-3 py-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block"/>
          {data?.clock?.time ?? "—"}
        </div>
      </div>

      {/* Stat cards — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card stat-card-accent">
            <div className="flex items-start justify-between mb-2">
              <span className="text-text-muted">{s.icon}</span>
              <span className={`text-xl md:text-2xl font-bold font-mono ${s.valueColor}`}>
                {s.value}{s.suffix}
              </span>
            </div>
            <div className="text-text-secondary text-xs">{s.label}</div>
            {s.pct > 0 && (
              <div className="progress-bar mt-2">
                <div className={`progress-fill ${s.barColor}`} style={{ width: `${s.pct}%` }}/>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bandwidth monitor card */}
      <div className="card">
        <div className="card-header flex-wrap gap-y-2">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Bandwidth Realtime
            <span className="badge badge-neutral text-[10px]">2s</span>
          </h2>

          {/* Interface selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["all", ...runningIfaces.map(i => i["name"])].map((name) => (
              <button
                key={name}
                onClick={() => setActiveIface(name)}
                className={`btn btn-sm px-2.5 py-1 text-xs ${activeIface === name ? "btn-primary" : "btn-ghost"}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Speed display */}
        <div className="grid grid-cols-2 border-b border-bg-border">
          <div className="px-4 md:px-6 py-3 md:py-4 border-r border-bg-border">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5">
                <polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="19"/>
              </svg>
              <span className="text-text-muted text-[10px] font-mono uppercase tracking-wide">Download (RX)</span>
            </div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-accent">{fBits(totalRx)}</div>
          </div>
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffa502" strokeWidth="2.5">
                <polyline points="17 14 12 19 7 14"/><line x1="12" y1="19" x2="12" y2="5"/>
              </svg>
              <span className="text-text-muted text-[10px] font-mono uppercase tracking-wide">Upload (TX)</span>
            </div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-warning">{fBits(totalTx)}</div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-3 md:px-4 pt-3 pb-0" style={{ height: "160px" }}>
          <BandwidthChart points={bwHistory}/>
        </div>

        {/* Legend + sample count */}
        <div className="px-4 py-2.5 flex items-center gap-4 text-xs font-mono text-text-secondary border-t border-bg-border mt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-[2px] bg-accent inline-block rounded"/>Download
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-[2px] bg-warning inline-block rounded"/>Upload
          </span>
          <span className="ml-auto text-text-muted">{bwHistory.length}/{MAX_POINTS} sampel</span>
        </div>
      </div>

      {/* Per-interface cards (show if multiple ifaces detected) */}
      {ifacesBw.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {ifacesBw.map((iface) => {
            const maxRx = Math.max(...ifacesBw.map(i => i.rxBps), 1);
            const pct   = Math.round((iface.rxBps / maxRx) * 100);
            return (
              <button
                key={iface.name}
                onClick={() => setActiveIface(iface.name)}
                className={`card p-3 text-left cursor-pointer transition-all border hover:border-accent/40 ${
                  activeIface === iface.name ? "border-accent/60 bg-accent/5" : "border-bg-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2 gap-1">
                  <span className="text-accent text-xs font-mono font-semibold truncate">{iface.name}</span>
                  <span className={`badge text-[9px] flex-shrink-0 ${iface.rxBps > 0 || iface.txBps > 0 ? "badge-success" : "badge-neutral"}`}>
                    {iface.rxBps > 0 || iface.txBps > 0 ? "aktif" : "idle"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-accent">↓ {fBits(iface.rxBps)}</span>
                  <span className="text-warning">↑ {fBits(iface.txBps)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill bg-accent" style={{ width: `${pct}%` }}/>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* System info + interfaces tabel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System resource */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
              </svg>
              System Resources
            </h2>
            <button onClick={loadStats} className="btn btn-ghost btn-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              <span className="hidden sm:inline ml-1">Refresh</span>
            </button>
          </div>
          <div className="card-body space-y-2.5">
            {[
              { label: "Architecture", value: res["architecture-name"] },
              { label: "CPU",          value: `${res["cpu"]} (${res["cpu-count"]} core)` },
              { label: "CPU Freq",     value: `${res["cpu-frequency"]} MHz` },
              { label: "Memory",       value: `${fBytes(usedMem)} / ${fBytes(totalMem)}` },
              { label: "Storage",      value: `${fBytes(usedHdd)} / ${fBytes(totalHdd)}` },
              { label: "Uptime",       value: res["uptime"] },
              { label: "Version",      value: res["version"] },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-text-secondary font-mono uppercase tracking-wide flex-shrink-0">{r.label}</span>
                <span className="text-text-primary font-mono text-right truncate">{r.value || "—"}</span>
              </div>
            ))}
          </div>
          {/* Resource bars */}
          <div className="px-5 pb-4 space-y-2.5 border-t border-bg-border pt-3">
            {[
              { label: "CPU",  pct: cpu,    color: cpu > 80    ? "bg-danger" : cpu > 50    ? "bg-warning" : "bg-info" },
              { label: "RAM",  pct: memPct, color: memPct > 85 ? "bg-danger" : memPct > 65 ? "bg-warning" : "bg-info" },
              { label: "Disk", pct: hddPct, color: hddPct > 85 ? "bg-danger" : "bg-info" },
            ].map((b, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-text-secondary font-mono">{b.label}</span>
                  <span className="text-text-primary font-mono">{b.pct}%</span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill ${b.color}`} style={{ width: `${b.pct}%` }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interface table */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              Interfaces
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="hidden sm:table-cell">Type</th>
                  <th>↓ DL</th>
                  <th>↑ UL</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.interfaces ?? []).map((iface, i) => {
                  const bw = ifacesBw.find((b) => b.name === iface["name"]);
                  return (
                    <tr
                      key={i}
                      className="cursor-pointer"
                      onClick={() => setActiveIface(iface["name"])}
                    >
                      <td className="text-accent text-xs font-medium">{iface["name"]}</td>
                      <td className="text-text-secondary text-xs hidden sm:table-cell">{iface["type"] || "ether"}</td>
                      <td className="text-accent text-xs">{bw ? fBits(bw.rxBps) : "—"}</td>
                      <td className="text-warning text-xs">{bw ? fBits(bw.txBps) : "—"}</td>
                      <td>
                        <span className={`badge text-[10px] ${iface["running"] === "true" ? "badge-success" : "badge-neutral"}`}>
                          {iface["running"] === "true" ? "up" : "down"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(data?.interfaces ?? []).length === 0 && (
                  <tr><td colSpan={5} className="text-center text-text-muted py-8 text-xs">Tidak ada interface</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
