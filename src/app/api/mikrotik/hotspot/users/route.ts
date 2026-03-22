import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/routeros";

async function ctx() {
  const session = await getSession();
  if (!session.isConnected || !session.host)
    return { error: "Not connected" } as const;
  const client = createClient(session.host, session.port);
  return { client, u: session.username!, p: session.password! };
}

// GET — list users, opsional filter profile / comment
export async function GET(req: NextRequest) {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  const { client, u, p } = r;

  const { searchParams } = new URL(req.url);
  const profile = searchParams.get("profile");
  const comment = searchParams.get("comment");

  try {
    const params: Record<string, string> = {};
    if (profile && profile !== "all") params["?profile"] = profile;
    if (comment) params["?comment"] = comment;

    const [users, profiles] = await Promise.all([
      client.comm(u, p, "/ip/hotspot/user/print", params),
      client.comm(u, p, "/ip/hotspot/user/profile/print"),
    ]);

    return NextResponse.json({ users, profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — tambah user baru (sama seperti adduser.php Mikhmon)
export async function POST(req: NextRequest) {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  const { client, u, p } = r;

  try {
    const body = await req.json();
    const {
      name, password: pass = "", profile = "default",
      server = "all", comment = "",
      timelimit = "0", datalimit = "0", mbgb = "1048576",
    } = body;

    if (!name) return NextResponse.json({ error: "Nama user wajib diisi" }, { status: 400 });

    // Mikhmon: tandai mode vc- (voucher = username sama dengan password) atau up-
    const mode = name === (pass || name) ? "vc-" : "up-";
    const finalComment = mode + comment;
    const finalData =
      !datalimit || datalimit === "0" ? "0"
      : String(parseInt(datalimit) * parseInt(mbgb));

    await client.comm(u, p, "/ip/hotspot/user/add", {
      server,
      name,
      password: pass || name,
      profile,
      disabled: "no",
      "limit-uptime":       timelimit || "0",
      "limit-bytes-total":  finalData,
      comment:              finalComment,
    });

    // Ambil user yang baru dibuat
    const created = await client.comm(u, p, "/ip/hotspot/user/print", { "?name": name });
    return NextResponse.json({ ok: true, user: created[0] ?? {} });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — edit user
export async function PUT(req: NextRequest) {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  const { client, u, p } = r;

  try {
    const body = await req.json();
    const { id, name, password: pass, profile, comment,
            timelimit, datalimit, mbgb = "1048576", disabled } = body;

    if (!id) return NextResponse.json({ error: "ID user wajib diisi" }, { status: 400 });

    const params: Record<string, string> = { ".id": id };
    if (name      !== undefined) params["name"]               = name;
    if (pass      !== undefined) params["password"]            = pass;
    if (profile   !== undefined) params["profile"]             = profile;
    if (comment   !== undefined) params["comment"]             = comment;
    if (disabled  !== undefined) params["disabled"]            = disabled;
    if (timelimit !== undefined) params["limit-uptime"]        = timelimit || "0";
    if (datalimit !== undefined) {
      params["limit-bytes-total"] =
        !datalimit || datalimit === "0" ? "0"
        : String(parseInt(datalimit) * parseInt(mbgb));
    }

    await client.comm(u, p, "/ip/hotspot/user/set", params);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — hapus satu atau beberapa user (sama seperti removehotspotuser.php)
export async function DELETE(req: NextRequest) {
  const r = await ctx();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 401 });
  const { client, u, p } = r;

  try {
    const { ids }: { ids: string[] } = await req.json();
    if (!ids?.length) return NextResponse.json({ error: "ID tidak ada" }, { status: 400 });

    for (const id of ids) {
      // Ambil nama user dulu (untuk hapus script/scheduler terkait, seperti Mikhmon)
      const info = await client.comm(u, p, "/ip/hotspot/user/print", { "?.id": id });
      const name = info[0]?.name;

      if (name) {
        // Hapus system/script terkait (jika ada)
        try {
          const scr = await client.comm(u, p, "/system/script/print", { "?name": name });
          if (scr[0]?.[".id"]) {
            await client.comm(u, p, "/system/script/remove", { ".id": scr[0][".id"] });
          }
        } catch { /* oke jika tidak ada */ }

        // Hapus system/scheduler terkait (jika ada)
        try {
          const sch = await client.comm(u, p, "/system/scheduler/print", { "?name": name });
          if (sch[0]?.[".id"]) {
            await client.comm(u, p, "/system/scheduler/remove", { ".id": sch[0][".id"] });
          }
        } catch { /* oke jika tidak ada */ }
      }

      await client.comm(u, p, "/ip/hotspot/user/remove", { ".id": id });
    }

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
