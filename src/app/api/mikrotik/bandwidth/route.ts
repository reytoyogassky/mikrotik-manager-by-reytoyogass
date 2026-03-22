import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/routeros";

/**
 * GET /api/mikrotik/bandwidth?iface=ether1
 *
 * Menggunakan /interface/monitor-traffic dengan =once= untuk mendapatkan
 * rx-bits-per-second dan tx-bits-per-second secara langsung dari RouterOS.
 * Dipanggil setiap 2 detik dari client untuk membentuk grafik realtime.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isConnected || !session.host) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const iface = searchParams.get("iface") || "all";

  const c = createClient(session.host, session.port);
  const u = session.username!;
  const p = session.password!;

  try {
    // Ambil daftar interface yang running dulu jika "all"
    const ifaceList = await c.comm(u, p, "/interface/print");
    const running   = ifaceList.filter((i) => i["running"] === "true" && i["type"] !== "loopback");

    // Pilih interface yang akan dimonitor
    let targets: string[] = [];
    if (iface === "all") {
      // Ambil max 4 interface pertama yang running (hindari terlalu banyak request)
      targets = running.slice(0, 4).map((i) => i["name"]).filter(Boolean);
    } else {
      targets = [iface];
    }

    if (targets.length === 0) {
      return NextResponse.json({ interfaces: [], timestamp: Date.now() });
    }

    // Monitor traffic tiap interface (=once= agar tidak streaming)
    const results = await Promise.allSettled(
      targets.map((name) =>
        c.comm(u, p, "/interface/monitor-traffic", {
          interface: name,
          once: "",
        })
      )
    );

    const interfaces = targets.map((name, idx) => {
      const result = results[idx];
      if (result.status === "fulfilled" && result.value[0]) {
        const d = result.value[0];
        return {
          name,
          rxBps:    parseInt(d["rx-bits-per-second"]  || "0"),
          txBps:    parseInt(d["tx-bits-per-second"]  || "0"),
          rxPps:    parseInt(d["rx-packets-per-second"] || "0"),
          txPps:    parseInt(d["tx-packets-per-second"] || "0"),
          running:  true,
        };
      }
      return { name, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, running: false };
    });

    return NextResponse.json({ interfaces, timestamp: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
