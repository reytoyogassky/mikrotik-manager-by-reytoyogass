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
    const active = await r.client.comm(r.u, r.p, "/ip/hotspot/active/print");
    return NextResponse.json({ active });
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
    await r.client.comm(r.u, r.p, "/ip/hotspot/active/remove", { ".id": id });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
