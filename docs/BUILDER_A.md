# Builder A - Task & Progress Tracker

**Peran:** Backend Inti (Congestion Model, Routing Wrapper), Integrasi Agent
**Fokus Utama:** API kemacetan, integrasi Gemini, setup environment, dan fallback logic.

---

## 🕒 JAM 0–1 — Kickoff & Setup
- [x] Buat folder `/backend` di dalam repository
- [x] Buat file `.env` (berisi: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `OSRM_BASE_URL`)
- [x] Bagikan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` ke tim via `.env.example`
- [x] Buat API key Gemini di AI Studio, test 1 request sederhana
- [x] Setup FastAPI project skeleton (buat file `main.py` dan struktur *routers*)
- [x] Install dependencies: `fastapi`, `uvicorn`, `supabase`, `google-generativeai`, `scikit-learn`
- [x] Tetap di branch `main` (kesepakatan tim)

## 🕒 JAM 1–3 — Data Collection & Backend Skeleton
- [x] Buat tabel Supabase sesuai skema: `road_segments`, `congestion_multipliers`, `ferry_schedules`, `route_query_log`
- [x] Setup koneksi Supabase client di FastAPI
- [x] Test query sederhana untuk memastikan koneksi ke Supabase berhasil
- [x] Migrasi schema Supabase ke **v2** — tambah kolom `segment_id TEXT`, `length_km`, `typical_speed_kmh`, `congestion_level`, `hour_window`, `cutoff_time`, `vessel_type`, `cargo_capacity_tons` agar kompatibel dengan notebook training
- [x] Buat `backend/scripts/prepare_data.py` — script idempotent untuk cleaning + import data Excel ke Supabase (validasi coverage, cast tipe data, override deskripsi ke bahasa Inggris)
- [x] Import data final ke Supabase: **6 road_segments, 25 congestion_multipliers, 20 ferry_schedules** — semua bersih, no NULL, no duplikat
- [x] Semua deskripsi `congestion_multipliers` diubah ke bahasa Inggris penuh

## 🕒 JAM 3–6 — Backend Inti: Congestion API & Model Training
- [x] Buat Auth Dependency (`get_current_user`) di FastAPI untuk verifikasi JWT
- [x] Implement `GET /user/history`
- [x] Jalankan `train_model.ipynb` v2 dengan data final — model berhasil ditraining dan diekspor ke `backend/rf_model.joblib` (310 KB)
  - Accuracy: **95.1%** | F1 high: 0.77 | F1 medium: 0.84 | F1 low: 0.98
  - 14,400 synthetic rows | 7 features | 50 estimators | seed=42
  - Multiplier map: `low=1.066×`, `medium=1.227×`, `high=1.818×`
  - Sanity check prediksi: 3/4 passed (SEG001 jam 11 predicted low, bukan medium — edge case acceptable)
- [x] Implement `GET /congestion?segment_id=&day_type=&hour=`
    - ML inference dari `rf_model.joblib` (pandas-free — pakai plain list array)
    - Fallback ke Supabase `congestion_multipliers` dengan midnight-wrap window logic
    - Sklearn `UserWarning` disuppress dengan `warnings.catch_warnings()`
    - **Test result**: SEG001 weekday jam 7 → `HIGH 1.82x` ✅ | SEG005 weekend jam 10 → `MEDIUM 1.23x` ✅
- [x] Implement helper function `calculate_emission_score(multipliers: list)`
- [x] Unit test manual: Agent chat test — full pipeline User→Gemini→FastAPI→ML→Gemini berhasil, HTTP 200 OK

## 🕒 JAM 6–9 — Persiapan Agent
- [x] Susun *System Prompt* di file terpisah agar prompt agent rapi
- [x] Definisikan file struktur *Tool Schema* untuk persiapan integrasi Gemini

## 🕒 JAM 9–11 — Integrasi Agent (Gemini Function Calling)
- [x] Tetap di branch `main`
- [x] Definisikan JSON tool schema (3 tools: `get_congestion_level`, `get_optimal_route`, `get_ferry_schedule`)
- [x] Implement `POST /agent/chat` untuk handle request natural language dari *ChatWidget* frontend
- [x] Buat alur logika eksekusi *function calling* dari respon Gemini ke fungsi internal FastAPI
- [x] Implement fallback rule-based jika Gemini API gagal, timeout, atau limit habis
- [x] Test agent dengan minimal 5 skenario chat berbeda

## 🕒 JAM 11–13 — Integrasi Penuh, Bug Fixing, Robustness
- [x] Implement `GET /congestion` endpoint — **DONE, sekarang live di `/congestion`**
- [x] Agent tools `get_congestion_level` → real ML | `get_ferry_schedule` → real Supabase query
- [ ] Tes integrasi penuh frontend ↔ backend (**Builder B sudah push**: register page, sidebar, planner, oracle, schedules — perlu connect ke API)
- [ ] Test end-to-end minimal 3 skenario origin-destination bersama Builder B
- [ ] Cek edge case: input kosong, OSRM timeout, pastikan endpoint tidak 500

## 🕒 JAM 13–14 — Polish & Persiapan Materi
- [ ] Deployment backend production (Railway/Render) pastikan environment variables masuk semua
- [ ] Bantu finalisasi public repository (tulis `README.md` backend untuk juri)

## 🕒 JAM 14–15 — Dokumentasi Tertulis
- [ ] Update `TECH.md` dan `PRD.md` jika ada asumsi data/model yang berubah
- [ ] Review kodingan dan pastikan komentar kode bersih (clean code)

## 🕒 JAM 15–16 — Buffer & Submit
- [ ] Pantau log backend, double check rate limit API pihak ketiga
- [ ] Submit repository

---

## 📦 Pre-Hackathon Deliverables (Selesai 2026-08-15)

| Deliverable | Status | Detail |
|---|---|---|
| Supabase schema v2 | ✅ Done | [`database/schema.sql`](../backend/database/schema.sql) — 4 tabel, FK, index |
| Data cleaning & import script | ✅ Done | [`scripts/prepare_data.py`](../backend/scripts/prepare_data.py) — idempotent, validasi coverage |
| Data import ke Supabase | ✅ Done | 6 segments · 25 multipliers · 20 ferry schedules |
| English descriptions | ✅ Done | Semua 25 baris `congestion_multipliers.description` → English |
| Methodology notes | ✅ Done | [`docs/methodology_notes.md`](./methodology_notes.md) |
| Model training | ✅ Done | `rf_model.joblib` 310 KB, accuracy 95.1% |
| Model evaluation | ✅ Done | Classification report, multiplier map, sanity check 3/4 pass |

## 🚧 Next Priority — Stage Berikutnya

**Builder B sudah push frontend** (register, planner, oracle, schedules, sidebar). Sekarang fokus ke koneksi frontend ↔ backend:

1. **Implement `POST /route`** — Builder B punya halaman Planner UI yang butuh data rute nyata (origin, destination, jam, day_type → return travel_time_min, congestion_level, multiplier, emission_kg)
2. **Sambungkan Agent Chat Widget** (`/oracle` page) ke endpoint `POST /agent/chat` yang sudah live
3. **Deploy backend** ke Railway/Render — agar Builder B bisa point frontend ke URL produksi, bukan `localhost`
4. **Test E2E** minimal 3 skenario lengkap bersama Builder B setelah deploy
