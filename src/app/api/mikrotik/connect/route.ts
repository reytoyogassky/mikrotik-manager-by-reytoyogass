import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/routeros";

export async function POST(req: NextRequest) {
  try {
    const { host, port, username, password } = await req.json();

    if (!host || !username) {
      return NextResponse.json(
        { error: "Host dan username wajib diisi" },
        { status: 400 }
      );
    }

    const portNum = parseInt(port) || 8728;
    const client  = createClient(host, portNum);

    // Test koneksi — ambil system resource
    try {
      await client.comm(username, password, "/system/resource/print");
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Gagal terhubung ke router" },
        { status: 401 }
      );
    }

    // Simpan ke session
    const session = await getSession();
    session.host        = host;
    session.port        = portNum;
    session.username    = username;
    session.password    = password;
    session.isConnected = true;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
