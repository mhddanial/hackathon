# NEXT_STEPS.md — Rencana Tindak Lanjut Sebelum Hari-H

Ringkasan seluruh keputusan dari diskusi + riset, disusun jadi action item konkret. Referensi: PRD.md, TECH.md, TASK.md, train_model.ipynb.

---

## 1. Pembersihan Data Sebelum Import ke Supabase (Prioritas Tertinggi — blocker untuk training)

PIC: **Hustler/Dann** (manual), divalidasi Builder A sebelum training

Update: data mentah sekarang sudah lengkap (weekday + weekend, 6 segmen penuh, 24 jam tanpa celah) — gap yang sebelumnya diidentifikasi sudah **resolved**. Masalah yang tersisa sekarang murni soal *struktur* file, bukan kelengkapan data: sheet `congestion_multipliers` mencampur data aktual dengan catatan metodologi di kolom & baris yang sama.

**Langkah pembersihan `road_segments`:**
- [ ] Sisakan cuma kolom: `segment_id` (atau `id`), `name`, `corridor_type`, `start_lat`, `start_lng`, `end_lat`, `end_lng`, `length_km`, `typical_speed_kmh`
- [ ] Pastikan nilai `corridor_type` konsisten penulisannya di semua baris (mis. selalu `industrial_arterial`, bukan kadang `Industrial_Arterial` atau `industrial arterial`) — one-hot encoding di notebook memperlakukan setiap variasi penulisan sebagai kategori berbeda, jadi typo/inkonsistensi kapitalisasi akan memecah data yang seharusnya satu kelas

**Langkah pembersihan `congestion_multipliers`:**
- [ ] Sisakan cuma kolom: `segment_id`, `day_type`, `hour_window` (opsional, untuk dibaca manusia), `hour_start`, `hour_end`, `multiplier`, `congestion_level`, `description` (opsional)
- [ ] **Hapus kolom J sampai Y** (`section_id`, `topic`, `method_or_source`, `technical_explanation`, `journal_or_reference`, dan kolom contoh perhitungan `t_name`/`distance_km`/dst) — ini catatan metodologi yang tidak sejajar baris dengan data di kirinya, salin ke file terpisah (mis. `docs/methodology_notes.md`) kalau mau disimpan sebagai referensi, jangan ikut diimpor ke tabel
- [ ] **Hapus baris di bagian bawah sheet yang tidak punya `segment_id` terisi** — ini baris catatan/referensi yang nyasar ke tabel data
- [ ] Pastikan `hour_start`/`hour_end` berupa angka bulat (integer), bukan string atau format jam (`"06:00"`) — notebook memakainya langsung sebagai `int()`
- [ ] Pastikan `day_type` konsisten cuma dua nilai: `weekday` / `weekend` (huruf kecil semua, tanpa spasi tersembunyi)
- [ ] Cross-check tiap `segment_id` di sini benar-benar ada padanannya di `road_segments` yang sudah dibersihkan — kalau ada `segment_id` yang typo/tidak match, baris itu akan otomatis di-skip notebook dengan warning (lihat §3 notebook), bukan error keras, tapi berarti data itu hilang diam-diam kalau tidak dicek

**Validasi sebelum training (bisa dicek manual di Excel, atau jalankan §2 notebook setelah data masuk Supabase):**
- [ ] Tiap `segment_id` di `road_segments` punya minimal 1 baris `weekday` DAN 1 baris `weekend` di `congestion_multipliers`
- [ ] Window jam per `segment_id` per `day_type` saling menyambung tanpa celah dan tanpa tumpang tindih (mis. window A berakhir jam 9, window B berikutnya mulai jam 9 — bukan mulai jam 10 atau mulai jam 8)
- [ ] Tidak ada baris duplikat (`segment_id` + `day_type` + `hour_start` yang sama muncul dua kali)

**Urutan kerja:**
1. Bersihkan `road_segments` dulu (lebih sederhana, sedikit kolom)
2. Bersihkan `congestion_multipliers`, pisahkan catatan metodologi ke file terpisah
3. Import kedua tabel bersih ke Supabase
4. Jalankan §1-2 notebook (fetch + sanity check coverage) — kalau ada warning "segment_id tidak ditemukan" atau kolom `day_type_weekend` tidak muncul, kembali ke langkah 1-2, jangan lanjut training dulu
5. Baru lanjut ke §3 dst (generate synthetic data, training)

## 2. Notebook Training (train_model.ipynb) — Sudah Diupdate ke v2

PIC: **Builder A** — tinggal jalankan setelah data bersih masuk Supabase (lihat poin 1)

- [x] Fix data leakage `is_peak` — sekarang diturunkan murni dari `hour`, independen dari target
- [x] Target training memakai `congestion_level` asli dari data (bukan threshold ulang) — penting karena beberapa baris sumber data (mis. multiplier 1.2 dilabeli MEDIUM) tidak cocok dengan threshold sembarangan
- [x] `expand_hours()` menangani window wrap tengah malam & window 24 jam penuh (weekend)
- [x] Mapping level → multiplier representatif (§6 notebook)
- [x] Fungsi hitung waktu tempuh & emisi sesuai formula asli dari `research_sources` (§7 notebook)
- [ ] **Belum dilakukan:** jalankan ulang notebook dengan data yang sudah dibersihkan (poin 1), cek `classification_report` — pastikan tidak ada kelas yang precision/recall-nya 0

## 3. Update Logic `/route` (Faktor Tambahan di Luar Model ML)

PIC: **Builder A & B**

- [ ] Integrasikan `length_km` + `typical_speed_kmh` dari `road_segments` sebagai baseline waktu tempuh (juga jadi fallback kalau OSRM down — lihat §5).
- [ ] Tambahkan filter **cutoff_time** dari `ferry_schedules`: opsi jam berangkat yang membuat ETA + buffer melewati cutoff harus dibuang dari kandidat rekomendasi, bukan cuma "kurang optimal".
- [ ] (Opsional, kalau waktu cukup) tambahkan pencocokan `cargo_capacity_tons`/`vessel_type` — kalau user input estimasi berat kargo, saring terminal yang sesuai (mis. kargo besar → cuma Batu Ampar/Cargo Vessel, bukan Fast Ferry).

## 4. Keputusan Routing Engine (Sudah Difinalkan)

- [x] **Tetap pakai OSRM public demo server** untuk hackathon — gratis, tanpa billing account, tanpa risiko biaya tak terduga.
- [x] **Google Routes API (traffic-aware) dicatat sebagai roadmap produksi**, bukan dipakai sekarang — sudah didokumentasikan di TECH.md §7.5 sebagai future swap-in yang tidak mengubah kontrak API.
- [ ] Test OSRM public server dari environment kalian sebelum hari-H (kadang ada downtime/rate limit) — kalau bermasalah, siapkan fallback Haversine × faktor kecepatan.

## 5. Dokumentasi — Sinkronisasi

- [x] TECH.md diupdate ke v0.3 (model ML §3.5, roadmap produksi §7.5).
- [ ] **Klarifikasi soal Auth/Supabase Auth/`profiles`/`/user/history`** yang muncul di versi PRD.md/TECH.md yang di-upload — ini belum pernah disepakati sebelumnya dan berpotensi menambah scope di luar rencana 16 jam. Perlu diputuskan tim: masuk scope atau dibuang, sebelum dokumen difinalkan.
- [ ] Setelah data di poin 1 lengkap, update bagian "Asumsi Sementara" di PRD.md jadi angka final.

## 6. Urutan Kerja yang Disarankan (sebelum hari-H, bukan saat hari-H)

1. Hustler selesaikan gap data (poin 1) — ini blocker untuk semua yang lain
2. Builder A perbaiki notebook (poin 2) sambil menunggu data lengkap, bisa test dulu pakai data placeholder
3. Tim putuskan soal Auth (poin 5) — kalau ditambah, alokasikan waktu eksplisit di TASK.md; kalau tidak, hapus dari draft PRD/TECH yang beredar supaya tidak ada dokumen yang saling kontradiksi
4. Test OSRM public server (poin 4) dari laptop masing-masing builder
5. Setelah semua di atas beres, baru mulai simulasi dry-run alur end-to-end (form → congestion → route → emisi) dengan data dummy, sebelum hari-H beneran dimulai

## Ringkasan Status

| Area | Status |
|---|---|
| Problem statement & fitur inti | ✅ Solid, sudah divalidasi terhadap kriteria juri |
| Data mentah (spreadsheet) | ✅ Lengkap (weekday+weekend, 6 segmen) — ⚠️ perlu dibersihkan dari kolom/baris metodologi sebelum import |
| Notebook training | ✅ v2 sudah fix bug & lengkap — tinggal dijalankan dengan data bersih |
| Arsitektur & tech stack | ✅ Sudah final, termasuk keputusan OSRM vs Google Routes |
| Scope (Auth) | ❓ Belum diputuskan, berpotensi konflik antar dokumen |
