# TASK.md — Breakdown Kerja 16 Jam

**Proyek:** Batam Cross-Border SmartFlow
**Tim:** Builder A, Builder B, Hipster, Hustler
**Referensi:** PRD.md, TECH.md

Legenda prioritas: 🔴 Wajib (fitur inti) · 🟡 Penting (agent layer) · ⚪ Nice-to-have (drop dulu kalau waktu mepet)

---

## JAM 0–1 — Kickoff & Setup

**Semua anggota bersama:**
- [ ] Review ulang PRD.md & TECH.md, kunci scope final (tidak ada penambahan fitur setelah jam ini)
- [ ] Buat repo GitHub, struktur folder `/frontend`, `/backend`, `/docs`
- [ ] Buat project Supabase, catat `SUPABASE_URL` + `SUPABASE_ANON_KEY`, share ke tim via `.env.example`
- [ ] Buat API key Gemini di AI Studio, test 1 request sederhana (pastikan tidak ada masalah billing/region)
- [ ] Assign branch: `feature/backend-congestion`, `feature/backend-agent`, `feature/frontend-map`, `feature/frontend-ui`

**Builder A:** 🔴 Setup FastAPI project skeleton, install dependencies (`fastapi`, `uvicorn`, `supabase-py`, `google-generativeai`), buat file `.env`
**Builder B:** 🔴 Setup Next.js project (Tailwind + Leaflet), deploy skeleton kosong ke Vercel supaya pipeline jalan sejak awal
**Hipster:** ⚪ Riset referensi visual (color scheme heatmap, layout dashboard), mulai wireframe kasar di Figma/kertas
**Hustler:** 🔴 Mulai kumpulkan data jadwal ferry (screenshot/catat dari sumber resmi) dan daftar ruas jalan kunci

---

## JAM 1–3 — Data Collection & Backend Skeleton

### Fitur: Data dasar (congestion table, ferry schedule, road segments)

**Hustler:** 🔴
- [ ] Finalisasi daftar 5-8 ruas jalan kunci (nama + titik awal-akhir kasar, cari koordinat via Google Maps klik-kanan "copy coordinates")
- [ ] Isi tabel multiplier kemacetan per ruas: weekday peak/offpeak, weekend (pakai asumsi PRD kalau belum ada data spesifik: peak 06:00-09:00 & 16:00-19:00)
- [ ] Kumpulkan jadwal ferry 2-3 terminal (Batam Center, Sekupang, Batu Ampar) — jam keberangkatan + tujuan
- [ ] Rapikan semua data di satu spreadsheet/CSV untuk diimpor ke Supabase oleh Builder A

**Builder A:** 🔴
- [ ] Buat tabel Supabase sesuai skema TECH.md: `road_segments`, `congestion_multipliers`, `ferry_schedules`, `route_query_log`
- [ ] Setup koneksi Supabase client di FastAPI, test query sederhana
- [ ] Import data awal dari Hustler (boleh placeholder dulu, disempurnakan berkala)

**Builder B:** 🔴 (paralel, tidak bergantung ke data)
- [ ] Setup routing wrapper: fungsi panggil OSRM (`router.project-osrm.org`) dengan koordinat dummy, pastikan response geometri rute bisa di-parse
- [ ] Setup struktur komponen frontend: `MapView`, `RouteForm`, `ResultPanel`, `ChatWidget` (kosongan dulu)

**Hipster:** ⚪
- [ ] Lanjutkan wireframe: layout halaman utama (peta + form di kiri, hasil di kanan)
- [ ] Pilih palet warna heatmap (mis. hijau→kuning→merah untuk low→medium→high congestion)

---

## JAM 3–6 — Backend Inti: Congestion & Route API

### Fitur: `GET /congestion`, `GET /route`, emission scoring 🔴

**Builder A:**
- [ ] Implement `GET /congestion?segment_id=&day_type=&hour=` — query Supabase, return level + multiplier
- [ ] Implement fungsi `calculate_emission_score(multipliers: list)` — logika sederhana, konsisten, bisa dijelaskan
- [ ] Unit test manual: cek 2-3 kombinasi segment/waktu, pastikan hasil masuk akal

**Builder B:**
- [ ] Implement `GET /route?origin=&destination=&departure_window_start=&departure_window_end=`
  - Panggil OSRM untuk geometri + durasi dasar
  - Loop beberapa opsi jam berangkat dalam window, ambil multiplier dari `/congestion` untuk tiap segmen yang dilalui
  - Pilih jam berangkat dengan total waktu temputi terbobotinya paling rendah
  - Return: `recommended_departure`, `route_geometry`, `estimated_duration_min`, `emission_score`, `explanation`
- [ ] Implement `GET /ferry-schedule?terminal=`

**Checkpoint jam 6:** 🔴 Pastikan 2 endpoint inti (`/route`, `/congestion`) bisa dites lewat Postman/curl dan hasilnya masuk akal sebelum lanjut ke frontend integration.

---

## JAM 6–9 — Frontend: Peta, Form, Panel Hasil

### Fitur: Heatmap kemacetan + form rute + panel hasil 🔴

**Builder B:**
- [ ] `MapView`: render peta Batam (Leaflet), overlay warna per ruas jalan berdasarkan level congestion saat ini (panggil `/congestion` untuk tiap segmen)
- [ ] `RouteForm`: input origin (dropdown/autocomplete gudang/kawasan industri), destination (dropdown terminal/pelabuhan), time window
- [ ] `ResultPanel`: tampilkan hasil dari `/route` — jam berangkat rekomendasi, durasi, emission badge, penjelasan singkat
- [ ] Gambar rute (`route_geometry`) di atas peta

**Hipster:**
- [ ] Styling `MapView`, `RouteForm`, `ResultPanel` sesuai wireframe & palet warna
- [ ] Desain emission badge (ikon + warna: low = hijau, medium = kuning, high = merah)
- [ ] Mulai susun draft pitch deck (struktur slide, belum full konten)

**Builder A:** (paralel)
- [ ] Mulai kerjakan agent layer (lihat Jam 9-11), siapkan dulu system prompt & tool schema di file terpisah

**Hustler:**
- [ ] Validasi ulang angka-angka data (cross-check jadwal ferry, ruas jalan) dengan sumber riset yang sudah dikutip di PRD
- [ ] Mulai susun narasi problem statement untuk pitch (bukan slide, draft narasi dulu)

---

## JAM 9–11 — Integrasi Agent (Gemini Function Calling)

### Fitur: Chat agent dengan tool-calling 🟡

**Builder A:**
- [ ] Definisikan tool schema (3 tools: `get_congestion_level`, `get_optimal_route`, `get_ferry_schedule`) sesuai TECH.md
- [ ] Setup system prompt: agent wajib panggil tool sebelum menjawab, jangan menebak angka, jujur kalau data tidak ada
- [ ] Implement `POST /agent/chat`: terima pesan, kirim ke Gemini dengan tools, eksekusi tool call, kembalikan hasil ke Gemini, return jawaban final
- [ ] Implement fallback: kalau Gemini API error/timeout/rate limit, backend beri jawaban rule-based sederhana (mis. "Berdasarkan data kami, rute tercepat adalah... coba tanya lagi beberapa saat.")
- [ ] Test minimal 5 skenario pertanyaan chat, catat mana yang berhasil/gagal

**Builder B:**
- [ ] `ChatWidget`: UI chat sederhana (input + bubble percakapan), panggil `/agent/chat`
- [ ] Integrasikan hasil chat dengan `ResultPanel`/`MapView` kalau relevan (opsional, bisa cukup tampilkan teks jawaban saja)

**Checkpoint jam 11 (KRITIS):** 🔴
Kalau agent belum jalan stabil di titik ini → **drop fitur chat**, fallback ke form biasa saja. Fitur inti (routing + heatmap) harus tetap utuh dan berfungsi. Jangan korbankan waktu integrasi FE-BE demi mengejar chat yang belum matang.

---

## JAM 11–13 — Integrasi Penuh, Bug Fixing, Robustness

**Semua Builder:**
- [ ] Integrasi penuh frontend ↔ backend ↔ (agent jika lolos checkpoint)
- [ ] Test end-to-end minimal 3 skenario origin-destination berbeda
- [ ] Cek edge case: input kosong, destination tidak valid, OSRM timeout → pastikan ada fallback (estimasi Haversine × faktor kecepatan) 🔴
- [ ] Perbaiki bug UI/UX yang ditemukan saat testing

**Hipster:**
- [ ] Finalisasi visual: pastikan konsisten warna, font, spacing
- [ ] Siapkan slide visual untuk dashboard cross-border Batam-Singapura (mock/statis, bukan fitur live) ⚪

**Hustler:**
- [ ] Siapkan Q&A antisipasi juri, terutama soal: sumber data (heuristic vs real-time), skalabilitas, cara handle rate limit API
- [ ] Review konsistensi angka antara aplikasi live dan yang disebutkan di pitch

---

## JAM 13–14 — Polish & Persiapan Materi

**Hipster:**
- [ ] Rekam video demo 3 menit (skenario: buka app → pilih origin/destination → lihat hasil rute+emisi → tanya via chat)
- [ ] Finalisasi pitch deck (5 min demo)

**Hustler:**
- [ ] Susun narasi presentasi: problem → solusi → demo → dampak → keunikan
- [ ] Latihan pitch bareng 1x sebelum jam submission

**Builder A & B:**
- [ ] Final bug pass, pastikan deployment production (Vercel + Railway/Render) sinkron dengan versi terbaru
- [ ] Siapkan public repository (README singkat: cara jalankan, tech stack, link demo)

---

## JAM 14–15 — Dokumentasi Tertulis

**Semua:**
- [ ] Finalisasi PRD.md dan TECH.md (update bagian "asumsi sementara" jadi angka final yang benar-benar dipakai)
- [ ] Tulis dokumentasi submission (README, cara instalasi, screenshot)
- [ ] Pastikan repository public dan bisa diakses juri

---

## JAM 15–16 — Buffer & Submit

**Semua:**
- [ ] Submit repository, video demo, pitch deck, dokumentasi sesuai format submission
- [ ] Double-check semua link bisa diakses (tidak private, tidak 404)
- [ ] Submit sebelum jam 05:00

---

## Ringkasan Tanggung Jawab per Orang

| Orang | Fokus Utama |
|---|---|
| **Builder A** | Backend inti (congestion, emission scoring), agent/tool-calling, fallback logic |
| **Builder B** | Routing wrapper (OSRM), frontend (peta, form, panel hasil, chat widget) |
| **Hipster** | UI/UX, styling, visual dashboard mock, video demo, pitch deck |
| **Hustler** | Data collection & validasi, narasi pitch, antisipasi Q&A juri |

## Checkpoint Kritis (jangan dilewatkan)

| Jam | Checkpoint | Aksi jika gagal |
|---|---|---|
| 6 | `/route` & `/congestion` jalan dan hasilnya masuk akal | Perpanjang waktu backend, geser jam frontend mulai jam 7 |
| 11 | Agent chat jalan stabil | Drop fitur chat, fokus ke form biasa |
| 13 | Semua fitur inti terintegrasi tanpa bug fatal | Prioritaskan stabilitas demo di atas jumlah fitur |
