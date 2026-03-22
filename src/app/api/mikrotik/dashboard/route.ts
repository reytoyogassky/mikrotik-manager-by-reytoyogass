import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/routeros";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isConnected || !session.host) {
      return NextResponse.json({ error: "Not connected" }, { status: 401 });
    }

    const c = createClient(session.host, session.port);
    const u = session.username!;
    const p = session.password!;

    const [resource, routerboard, clock, countUsers, countActive, interfaces] =
      await Promise.allSettled([
        c.comm(u, p, "/system/resource/print"),
        c.comm(u, p, "/system/routerboard/print"),
        c.comm(u, p, "/system/clock/print"),
        c.comm(u, p, "/ip/hotspot/user/print",   { "count-only": "" }),
        c.comm(u, p, "/ip/hotspot/active/print",  { "count-only": "" }),
        c.comm(u, p, "/interface/print"),
      ]);

    return NextResponse.json({
      resource:    resource.status    === "fulfilled" ? resource.value[0]    : {},
      routerboard: routerboard.status === "fulfilled" ? routerboard.value[0] : {},
      clock:       clock.status       === "fulfilled" ? clock.value[0]       : {},
      countUsers:  countUsers.status  === "fulfilled" ? (countUsers.value[0]?.count  ?? 0) : 0,
      countActive: countActive.status === "fulfilled" ? (countActive.value[0]?.count ?? 0) : 0,
      interfaces:  interfaces.status  === "fulfilled" ? interfaces.value.slice(0, 8) : [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
