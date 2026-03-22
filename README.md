# MikroTik Manager — Next.js

Web panel manajemen MikroTik berbasis Next.js 14 dengan pendekatan yang sama seperti **Mikhmon** — koneksi langsung ke RouterOS API (TCP port 8728).

## Fitur

- 🔌 **Connect/Disconnect** ke MikroTik via RouterOS API
- 📊 **Dashboard** — resource (CPU, RAM, storage), interface list, live refresh
- 👥 **Hotspot Users** — list, tambah, edit, hapus (bulk/single), enable/disable
- 🗂️ **User Profiles** — list, tambah, edit, hapus
- 🟢 **Active Sessions** — monitoring real-time, kick user
- 🔐 Session tersimpan di encrypted cookie (iron-session)

## Cara Kerja (sama seperti Mikhmon)

Mikhmon PHP menggunakan `RouterosAPI->comm()` yang membuka koneksi TCP ke port 8728 MikroTik, login, kirim command, baca response. Project ini mengimplementasikan protokol yang sama dalam TypeScript murni di `src/lib/routeros.ts`.

```
Browser → Next.js API Route → RouterOS TCP Client → MikroTik Port 8728
```

## Prasyarat

1. **MikroTik RouterOS** versi 6.x atau 7.x
2. Aktifkan API service di MikroTik:
   ```
   /ip service set api disabled=no port=8728
   ```
3. Pastikan firewall mengizinkan akses ke port 8728 dari server Next.js

## Instalasi

```bash
# Clone / ekstrak project
cd mikrotik-manager

# Install dependencies
npm install

# (Opsional) Buat .env.local untuk kustomisasi secret
echo "SESSION_SECRET=ganti-dengan-string-acak-minimal-32-karakter" > .env.local

# Jalankan development server
npm run dev
```

Buka http://localhost:3000

## Build Production

```bash
npm run build
npm start
```

## Struktur Project

```
src/
├── lib/
│   ├── routeros.ts      # RouterOS TCP API client (TypeScript)
│   └── session.ts       # Iron session config
├── app/
│   ├── page.tsx         # Halaman login/connect
│   ├── dashboard/
│   │   ├── layout.tsx   # Layout dengan sidebar
│   │   └── page.tsx     # Dashboard stats
│   ├── hotspot/
│   │   ├── users/       # CRUD hotspot users
│   │   ├── profiles/    # CRUD user profiles
│   │   └── active/      # Active sessions + kick
│   └── api/mikrotik/
│       ├── connect/     # POST: login ke router
│       ├── disconnect/  # POST: logout
│       ├── dashboard/   # GET: system stats
│       └── hotspot/
│           ├── users/   # GET/POST/PUT/DELETE users
│           ├── profiles/# GET/POST/PUT/DELETE profiles
│           └── active/  # GET active, DELETE (kick)
└── components/
    ├── Sidebar.tsx       # Navigasi sidebar
    └── Toast.tsx         # Notifikasi toast
```

## RouterOS Commands yang Digunakan

| Operasi | Command RouterOS |
|---|---|
| System info | `/system/resource/print` |
| Interface list | `/interface/print` |
| List users | `/ip/hotspot/user/print` |
| Tambah user | `/ip/hotspot/user/add` |
| Edit user | `/ip/hotspot/user/set` |
| Hapus user | `/ip/hotspot/user/remove` |
| List profiles | `/ip/hotspot/user/profile/print` |
| Tambah profile | `/ip/hotspot/user/profile/add` |
| Edit profile | `/ip/hotspot/user/profile/set` |
| Hapus profile | `/ip/hotspot/user/profile/remove` |
| Active sessions | `/ip/hotspot/active/print` |
| Kick user | `/ip/hotspot/active/remove` |

## Catatan

- Project ini **tidak memerlukan database** — semua data diambil langsung dari MikroTik
- Session disimpan di cookie browser (encrypted dengan iron-session)
- RouterOS client mendukung RouterOS v6.43+ (plain password) dan versi lama (MD5 challenge-response)
