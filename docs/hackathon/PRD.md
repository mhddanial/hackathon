# PRD — Batam Cross-Border SmartFlow

**Status:** Draft v0.1 (asumsi sementara, akan direvisi sebelum hari-H)
**Event:** Batam Singapore Hackathon 2026 · Tema: Ease of Living & Sustainability
**Topik:** Smart Mobility Flow — Traffic Congestion & Cross-Border Logistics

---

## 1. Latar Belakang & Masalah

Pelaku industri dan UMKM ekspor di kawasan industri Batam bergantung pada ketepatan jadwal pengiriman ke pelabuhan/terminal ferry menuju Singapura, namun tidak memiliki alat untuk memilih waktu keberangkatan dan rute yang meminimalkan risiko keterlambatan dan kemacetan.

Data pendukung:
- Yos Sudarso adalah arteri primer yang menghubungkan kawasan industri Batam dan menjadi koridor utama angkutan barang, dengan volume angkutan barang menyumbang >70% arus lalu lintas pada jam sibuk.
- Emisi (CO, HC, NOx, SPM) dari angkutan barang di koridor ini mendekati/melampaui ambang batas kualitas udara; kebisingan tertinggi mencapai 83,4 dB(A).
- Jalur intermodal resmi Batam–PSA Keppel–Changi sudah berjalan (2 trip/hari, ~10 ton/hari untuk cargo bernilai tinggi & time-sensitive), tetapi visibility di level koridor kota dan bagi UMKM masih lemah.

## 2. Target Pengguna

| Persona | Kebutuhan |
|---|---|
| Operator logistik/gudang di kawasan industri Batam | Tahu jam berangkat & rute paling aman ke pelabuhan/ferry agar tidak terlambat cut-off |
| UMKM ekspor kecil | Alat sederhana untuk estimasi waktu tempuh tanpa perlu tim logistik khusus |
| (Sekunder) Warga sekitar koridor padat | Manfaat tidak langsung dari pengurangan kemacetan & emisi |

## 3. Tujuan Produk (Hackathon Scope)

1. Memberikan rekomendasi rute & jam berangkat dari titik asal ke pelabuhan/terminal ferry tujuan, dengan mempertimbangkan pola kemacetan historis.
2. Menampilkan estimasi dampak emisi relatif dari rute yang direkomendasikan vs rute standar.
3. Menyediakan antarmuka percakapan (agent) sebagai cara alternatif mengakses rekomendasi, dengan tool-calling ke sistem inti.
4. Menyampaikan narasi keterkaitan koridor lokal Batam dengan supply chain Batam–Singapura (elemen visual, bukan fitur live).

## 4. Scope — In / Out untuk Hackathon (16 jam)

**In scope (fitur inti):**
- Heatmap kemacetan untuk 5–8 ruas jalan kunci (berbasis heuristic, bukan sensor real-time)
- Route recommender: origin → destination (pelabuhan/terminal) dengan jendela waktu, output rute + jam berangkat + estimasi emisi
- Jadwal ferry statis untuk 2–3 terminal utama
- Chat agent (Gemini, function calling) sebagai antarmuka natural language di atas sistem inti
- Fallback rule-based jika API agent gagal/limit habis
- Autentikasi user (Supabase Auth) untuk menyimpan profil dan riwayat pencarian rute

**Out of scope (untuk hackathon ini):**
- Data lalu lintas real-time/sensor IoT
- Integrasi API resmi pelabuhan/ferry (kemungkinan besar tidak tersedia publik)
- Dashboard cross-border Batam–Singapura sebagai fitur live (ditampilkan sebagai visual/mock di pitch deck saja)
- Multi-tenant, billing

## 5. User Stories

1. *Sebagai* operator logistik, *saya ingin* memasukkan lokasi gudang dan pelabuhan tujuan, *agar* saya dapat rekomendasi jam berangkat yang menghindari kemacetan.
2. *Sebagai* operator logistik, *saya ingin* bertanya dalam bahasa natural ("jam berapa paling aman ke Batu Ampar?"), *agar* saya tidak perlu memahami antarmuka teknis.
3. *Sebagai* juri/pengguna, *saya ingin* melihat peta kemacetan koridor Batam, *agar* saya memahami konteks masalah secara visual.
4. *Sebagai* pengguna, *saya ingin* melihat estimasi dampak emisi dari rute yang dipilih, *agar* saya memahami manfaat sustainability dari rekomendasi tsb.
5. *Sebagai* pengguna, *saya ingin* login ke sistem *agar* saya dapat menyimpan riwayat pencarian rute dan data profil saya.

## 6. Metrik Keberhasilan (untuk demo, bukan produksi)

- Sistem dapat memberi rekomendasi rute + jam berangkat untuk minimal 3 skenario asal-tujuan berbeda saat demo
- Chat agent berhasil merespons ≥90% dari pertanyaan yang sudah ditest sebelumnya
- Estimasi emisi relatif konsisten dan bisa dijelaskan logikanya ke juri
- Tidak ada kegagalan sistem (crash/500) selama demo live

## 7. Keterkaitan dengan Kriteria Juri

| Kriteria | Bagaimana produk ini menjawab |
|---|---|
| Problem Understanding & Relevance | Problem statement spesifik ke koridor Batam, didukung data riset kuantitatif |
| Technical Execution & Engineering Quality | Kombinasi ML/heuristic model + agent tool-calling + fallback robustness |
| Innovation & Creativity | Constraint jadwal ferry/pelabuhan + fokus angkutan barang lintas-batas, bukan navigasi umum |
| Impact & Feasibility | Solusi deployable bertahap: mulai dari heuristic model, terbuka untuk data real-time di fase berikutnya |
| Presentation & Demo | Narasi jujur soal batasan data (heuristic vs real-time) sebagai kekuatan desain, bukan kelemahan |

## 8. Asumsi Sementara (perlu divalidasi tim sebelum hari-H)

- Jam peak/offpeak: 06:00–09:00 dan 16:00–19:00 hari kerja (asumsi umum, sesuaikan jika ada data lebih spesifik dari jurnal riset)
- Terminal ferry yang dicover: Batam Center, Sekupang, Batu Ampar
- Ruas jalan yang dicover: minimal Yos Sudarso dan Sudirman, ditambah 3-6 ruas penghubung kawasan industri lain
- Ada fitur login/akun opsional untuk menyimpan riwayat rute.

## 9. Tim & Peran

- **Builder A:** Backend inti (congestion model, routing wrapper), integrasi agent
- **Builder B:** Backend routing/API + Frontend (peta, form, panel hasil)
- **Hipster:** UI/UX, visual dashboard cross-border (mock), video demo
- **Hustler:** Data collection (jadwal ferry, ruas jalan), narasi pitch, antisipasi Q&A juri
