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
- [x] Refactor internal Shadcn (seperti `button.tsx`, `input.tsx`, `sidebar.tsx`) untuk memastikan bentuk *pill-shaped* dan kesesuaian 100% dengan standar desain Meta.

## 🕒 JAM 4–6 — Peta Interaktif & Leaflet
- [x] Instalasi `leaflet`, `react-leaflet`, dan `@types/leaflet`
- [x] Pembuatan `MapComponent.tsx` menggunakan CartoDB Positron tile (gaya peta bersih/terang)
- [x] Modifikasi `MapView.tsx` untuk melakukan *dynamic import* guna menghindari error SSR Next.js
- [x] Implementasi *custom marker* dan jalur simulasi (Polyline) antara Batam Warehouse dan Batu Ampar
- [x] Pengaturan *overlay* status perjalanan (*Action Bar*) agar mengambang estetik di atas peta
- [x] *Push* kode akhir ke cabang (branch) `main`

## 🕒 JAM 6–9 — Interaktivitas Frontend (Mock State) & Halaman Pendukung
- [ ] Implementasi State Management: Menghubungkan klik pada rute Alpha/Beta/Gamma agar langsung merubah jalur Polyline di Peta Leaflet
- [ ] Buat halaman **Dashboard** (`/dashboard`) berisi metrik logistik dan grafik
- [ ] Buat halaman **Ferry Schedules** (`/schedules`) menggunakan Shadcn Table

## 🕒 JAM 9–11 — Penyempurnaan Chat Widget & Responsivitas
- [ ] Perbaiki logika expand/collapse pada `ChatWidget.tsx`
- [ ] Tambahkan animasi *typing indicator* (loading) saat menunggu balasan AI
- [ ] Audit tampilan mobile/tablet (pastikan Sidebar dan Peta tetap berfungsi baik di layar kecil)

## 🕒 JAM 11–13 — Integrasi Frontend ↔ Backend (Bersama Builder A & C)
- [ ] Hubungkan form pencarian rute ke API `/congestion` dan OSRM
- [ ] Hubungkan `ChatWidget.tsx` ke endpoint POST `/agent/chat`
- [ ] Tampilkan hasil rute dinamis dari backend langsung ke `react-leaflet`

## 🕒 JAM 13–15 — Polish & Bug Fixing
- [ ] Cek *edge case* (misal: bagaimana jika server mati, apakah UI memberikan *feedback* loading/error yang jelas?)
- [ ] Bantu dokumentasi fitur frontend di `README.md`
- [ ] Deployment Vercel (pastikan build berhasil tanpa error linting)

## 🕒 JAM 15–16 — Buffer & Submit
- [ ] Final UI QA (Quality Assurance) bersama tim
- [ ] Submit repository
