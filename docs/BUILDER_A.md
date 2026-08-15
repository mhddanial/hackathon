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
- [x] Buat tabel Supabase sesuai skema: `road_segments`, `congestion_multipliers`, `ferry_schedules`, `route_query_log`, `profiles` (Bisa run script SQL)
- [x] Setup Row Level Security (RLS) di Supabase untuk mengamankan data user
- [x] Setup koneksi Supabase client di FastAPI
- [x] Test query sederhana untuk memastikan koneksi ke Supabase berhasil
- [x] Import data awal dari Hustler (bisa placeholder dulu)

## 🕒 JAM 3–6 — Backend Inti: Congestion API & Auth
- [x] Buat Auth Dependency (`get_current_user`) di FastAPI untuk verifikasi JWT
- [x] Implement `GET /user/history`
- [ ] Buat script training model ML (`train_model.ipynb`) untuk generate data sintetik kemacetan dan export `rf_model.joblib`
- [ ] Implement `GET /congestion?segment_id=&day_type=&hour=`
    - Load model ML, prediksi level kemacetan & multiplier
    - Buat fallback ke query `congestion_multipliers` di Supabase jika model gagal dimuat
- [x] Implement helper function `calculate_emission_score(multipliers: list)`
- [ ] Unit test manual: cek 2-3 kombinasi segment/waktu dengan Postman/curl

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
- [ ] Tes integrasi penuh frontend ↔ backend ↔ agent
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
