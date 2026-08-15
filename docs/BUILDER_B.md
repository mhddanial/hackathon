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

## 🕒 JAM 3–6 — Routing Wrapper & API Internal (Next.js)
- [ ] Implement endpoint `GET /route` (Memanggil OSRM, me-loop opsi jam berangkat, menggabungkan data kemacetan, dan mengembalikan `route_geometry`)
- [ ] Implement endpoint `GET /ferry-schedule` (API internal mengambil data Supabase)

## 🕒 JAM 6–9 — Form Pencarian & Panel Hasil Rute
- [ ] Implementasi komponen **`RouteForm`** (Input origin, destination, time window)
- [ ] Implementasi komponen **`ResultPanel`** (Menampilkan durasi, jam rekomendasi, dan *emission score*)
- [ ] Menghubungkan `MapView.tsx` dengan data asli (menampilkan `route_geometry` OSRM dan warna rute kemacetan)

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
