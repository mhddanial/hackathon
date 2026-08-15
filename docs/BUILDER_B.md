# Builder B - Task & Progress Tracker

**Peran:** Frontend Web App, Shadcn UI, Interactive Map
**Fokus Utama:** Implementasi desain Figma (`DESIGN.md`), integrasi Leaflet map, komponen UI responsif, dan state management.

---

## 🕒 JAM 0–2 — Kickoff & UI Skeleton
- [x] Inisialisasi Next.js (App Router) dengan Tailwind CSS v4 di folder `/frontend`
- [x] Instalasi dan konfigurasi pustaka Shadcn UI (beserta dependencies seperti `@base-ui/react` dan `lucide-react`)
- [x] Mapping token desain dari `DESIGN.md` ke `globals.css` (misal: warna Cobalt Blue `#0064e0`, radius `32px` untuk kartu)
- [x] Pembuatan tata letak global (`layout.tsx`)
- [x] Implementasi `Sidebar.tsx` (navigasi responsif) dan `Topbar.tsx` (pencarian & aksi)

## 🕒 JAM 2–4 — Implementasi Halaman Route Planner & Komponen UI
- [x] Implementasi halaman utama dasbor Route Intelligence (`page.tsx`)
- [x] Pembuatan komponen `RouteOptions.tsx` menggunakan kartu Shadcn (rute Alpha, Beta, Gamma)
- [x] Pembuatan komponen antarmuka chat agent `ChatWidget.tsx` (Logistics Oracle) melayang di pojok layar
- [x] Refactor internal Shadcn (seperti `button.tsx`, `input.tsx`, `sidebar.tsx`) untuk memastikan bentuk *pill-shaped* dan kesesuaian 100% dengan standar desain.

## 🕒 JAM 4–6 — Peta Interaktif & Leaflet
- [x] Instalasi `leaflet`, `react-leaflet`, dan `@types/leaflet`
- [x] Pembuatan `MapComponent.tsx` menggunakan CartoDB Positron tile (gaya peta bersih/terang)
- [x] Modifikasi `MapView.tsx` untuk melakukan *dynamic import* guna menghindari error SSR Next.js
- [x] Implementasi *custom marker* dan jalur simulasi (Polyline) antara Batam Warehouse dan Batu Ampar
- [x] Pengaturan *overlay* status perjalanan (*Action Bar*) agar mengambang estetik di atas peta
- [x] *Push* kode akhir ke cabang (branch) `main`

## 🕒 JAM 6–9 — Landing Page, Auth & UI Polish
- [x] Restrukturisasi arsitektur **Next.js Route Groups** — memisahkan `(marketing)` dan `(dashboard)` agar landing page bebas dari sidebar
- [x] Implementasi **Landing Page** (`/`) lengkap dengan header navigasi, hero section, metrics, dan feature cards
- [x] Update header landing page dengan menu yang sesuai fitur asli (Dashboard, Ferry Schedules, Route Planner, Oracle)
- [x] Implementasi halaman **Login** (`/login`) dengan desain premium (glassmorphism watermark background)
- [x] Implementasi halaman **Register** (`/register`) dengan field: Nama Lengkap, Email, Password, Konfirmasi Password
- [x] Integrasi **tombol Google Sign-In / Sign-Up** di halaman Login dan Register
- [x] Password strength hints real-time (panjang, uppercase, angka) dan validasi konfirmasi password
- [x] Hapus menu "Overview" dari sidebar (tidak relevan di luar dashboard)
- [x] Rename semua "CrossFlow" → **SmartFlow** di seluruh codebase
- [x] Logo **SmartFlow** di sidebar kini berfungsi sebagai link kembali ke landing page (`/`)

## 🕒 JAM 6–9 — Mobile UX & Responsive Fixes
- [x] Fix **Topbar z-index** (`z-50` + `backdrop-blur`) agar tidak tertimpa konten saat scroll
- [x] Optimasi **Topbar mobile** — search bar dan tombol NEW PLAN disembunyikan di layar kecil, diganti ikon compact
- [x] Tambah **tombol tutup (X)** di sidebar header untuk tampilan mobile
- [x] Sidebar **auto-close** saat menu item diklik di tampilan mobile
- [x] Fix nested scrolling di semua halaman dashboard (Dashboard, Ferry Schedules, Route Planner, Oracle) agar scroll alami mengikuti jendela browser
- [x] Padding responsif `p-4 md:p-8` di semua halaman dashboard
- [x] Fix `suppressHydrationWarning` di root `layout.tsx` untuk mencegah error hydration akibat browser extension
- [x] Fix error `asChild` prop (Radix vs Base UI) — migrasi ke `render` prop pattern
- [x] Push semua perubahan ke branch `main`

## 🕒 JAM 9–11 — Integrasi Agent (Logistics Oracle)
- [ ] Refactor `ChatWidget.tsx` agar memiliki kotak obrolan penuh dan gelembung pesan
- [ ] Sambungkan antarmuka chat dengan endpoint `POST /agent/chat` milik Builder A

## 🕒 JAM 11–13 — Integrasi Penuh & Robustness (Bersama Builder A)
- [ ] Tes integrasi penuh dari *frontend* ↔ *backend* tanpa bug fatal
- [ ] Uji *edge cases* (input kosong, tujuan tidak valid, atau OSRM *timeout*)
- [ ] Perbaikan UI/UX akhir berdasarkan hasil pengujian

## 🕒 JAM 13–15 — Polish & Deployment
- [ ] Pastikan deployment (Vercel) sinkron dan bebas error
- [ ] Tulis bagian dokumentasi teknis *frontend* di `README.md`
- [ ] Finalisasi asumsi data pada `PRD.md` dan `TECH.md`

## 🕒 JAM 15–16 — Buffer & Submit
- [ ] Final UI QA (Quality Assurance)
- [ ] Submit repository
