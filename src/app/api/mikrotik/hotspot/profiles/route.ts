import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/routeros";

async function ctx() {
  const session = await getSession();
  if (!session.isConnected || !session.host)
    return { error: "Not connected" } as const;
  return {
    client: createClient(session.host, session.port),
    u: session.username!,
    p: session.password!,
  };
}

export async function GET() {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  try {
    const profiles = await r.client.comm(r.u, r.p, "/ip/hotspot/user/profile/print");
    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  try {
    const body = await req.json();
    const { name, "shared-users": sh = "1", "rate-limit": rl = "",
            "session-timeout": st = "", "idle-timeout": it = "",
            "on-login": ol = "", "on-logout": olo = "" } = body;
    if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

    const params: Record<string, string> = { name, "shared-users": sh };
    if (rl)  params["rate-limit"]       = rl;
    if (st)  params["session-timeout"]  = st;
    if (it)  params["idle-timeout"]     = it;
    if (ol)  params["on-login"]         = ol;
    if (olo) params["on-logout"]        = olo;

    await r.client.comm(r.u, r.p, "/ip/hotspot/user/profile/add", params);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });

    const params: Record<string, string> = { ".id": id };
    const allowed = ["name","shared-users","rate-limit","session-timeout",
                     "idle-timeout","keepalive-timeout","on-login","on-logout"];
    for (const k of allowed) {
      if (fields[k] !== undefined && fields[k] !== "") params[k] = fields[k];
    }
    await r.client.comm(r.u, r.p, "/ip/hotspot/user/profile/set", params);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });
    await r.client.comm(r.u, r.p, "/ip/hotspot/user/profile/remove", { ".id": id });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
