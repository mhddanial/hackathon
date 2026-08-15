# TECH.md — Batam Cross-Border SmartFlow

**Status:** Draft v0.2 — congestion model diupgrade dari lookup table murni jadi model terlatih (Random Forest) untuk menjawab kriteria "AI-driven prediction" (asumsi sementara, akan direvisi sebelum hari-H)

---

## 1. Arsitektur Umum

```
┌───────────────────┐      ┌────────────────────┐      ┌──────────────────┐
│  Next.js Frontend   │─────▶│   FastAPI Backend    │─────▶│  OSRM (routing)    │
│  - Peta heatmap       │      │  - /congestion         │      │  public demo server │
│  - Form rute            │      │  - /route               │      └──────────────────┘
│  - Chat widget           │◀─────│  - /ferry-schedule    │
└───────────────────┘      │  - /agent/chat          │
                                       └─────────┬──────────┘
                                                     │
                              ┌──────────────────┴───────────────────┐
                              │                                                                    │
                    ┌─────────▼─────────┐                                ┌────────▼────────┐
                    │ Supabase Postgres    │                                │ Gemini Flash-Lite  │
                    │ (data statis/heuristic)│                              │ (function calling)  │
                    └───────────────────┘                                └─────────────────┘
```

## 2. Tech Stack

| Layer | Teknologi | Catatan |
|---|---|---|
| Frontend | Next.js + Tailwind, Leaflet/Mapbox untuk peta | Deploy ke Vercel |
| Backend | FastAPI (Python) | Deploy ke Railway/Render |
| Database | **Supabase (PostgreSQL)** | Simpan data statis: road segments, congestion multipliers, ferry schedules |
| Routing engine | OSRM public demo server (`router.project-osrm.org`) | Self-host hanya jika ada waktu sisa dan public server tidak reliable |
| ML Model | scikit-learn (Random Forest Regressor/Classifier) | Model kemacetan dilatih dari data sintetis berbasis pola riset, di-serialize (joblib), dimuat saat backend start |
| AI Agent | Gemini 2.5 Flash-Lite (free tier), function calling | Fallback rule-based jika API gagal/limit |
| Hosting/CI | GitHub + Vercel + Railway | Branching: `main` + feature branch per builder |

## 3. Skema Database (Supabase / PostgreSQL)

### `road_segments`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| name | text | mis. "Yos Sudarso (Batu Ampar - Kabil)" |
| corridor_type | text | industrial_arterial / urban_arterial / access_road |
| start_lat, start_lng | float8 | titik awal segmen |
| end_lat, end_lng | float8 | titik akhir segmen |

### `congestion_multipliers`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| segment_id | uuid (FK → road_segments.id) | |
| day_type | text | weekday / weekend |
| hour_start, hour_end | int | jam berlaku multiplier ini |
| multiplier | float8 | pengali waktu tempuh dasar (mis. 2.5 = peak) |

### `ferry_schedules`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| terminal | text | batam_center / sekupang / batu_ampar |
| destination | text | mis. "Harbourfront, Singapore" |
| departure_time | time | |
| operator | text | opsional |

### `route_query_log` (opsional, untuk demo/analitik)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| origin, destination | text | |
| requested_at | timestamptz | default now() |
| recommended_departure | time | |
| result_json | jsonb | snapshot hasil rekomendasi |

> Supabase dipilih agar setup cepat (REST API otomatis + client library Python/JS tanpa perlu bikin ORM manual), cocok untuk kebutuhan hackathon 16 jam.

## 3.5 Model Prediksi Kemacetan (Machine Learning)

**Kenapa berubah dari lookup table murni:** problem statement eksplisit minta "AI-driven traffic prediction". Tabel `congestion_multipliers` di atas tetap ada, tapi perannya berubah — bukan lagi sumber jawaban langsung, melainkan **basis untuk membangun dataset training** bagi model yang benar-benar dilatih.

**Pendekatan:**
1. **Generate dataset sintetis** dari pola di `congestion_multipliers`: untuk tiap `segment_id`, buat ribuan baris kombinasi `(day_type, hour, corridor_type)` → `congestion_level`, dengan menambahkan noise acak kecil di sekitar multiplier dasar supaya model belajar pola, bukan hafal tabel.
2. **Fitur (input model):** `hour` (0-23), `day_type` (weekday/weekend, one-hot), `corridor_type` (industrial_arterial/urban_arterial/access_road, one-hot), `is_peak_hour` (derived boolean).
3. **Target (output model):** `congestion_level` (klasifikasi: low/medium/high) atau `multiplier` (regresi kontinu) — pilih klasifikasi dulu karena lebih mudah dijelaskan ke juri dan lebih toleran terhadap noise data sintetis.
4. **Model:** Random Forest (Classifier atau Regressor), sesuai pengalaman tim di capstone GeoMarket AI — cepat dilatih (hitungan detik-menit untuk dataset sekecil ini), tidak butuh GPU, mudah di-deploy sebagai file `.joblib`.
5. **Training dilakukan offline** (di jam 3-6, bareng pengembangan endpoint `/congestion`), hasil model disimpan sebagai file, di-load sekali saat FastAPI start (bukan retrain tiap request).
6. **Endpoint `/congestion` tetap sama secara kontrak** (lihat §4) — yang berubah hanya isi function-nya, dari `SELECT ... WHERE segment_id=...` menjadi `model.predict(features)`.

**Fallback:** kalau model gagal dimuat (file corrupt/hilang), backend otomatis fallback ke lookup table `congestion_multipliers` seperti versi awal — jadi tidak ada single point of failure.

**Narasi untuk juri:** model dilatih dari pola historis/riset lokal (bukan sensor real-time), sehingga hasilnya predictive dan explainable, dengan jalur upgrade jelas ke data sensor real-time di iterasi berikutnya.

## 4. API Contract (FastAPI)

### `GET /congestion`
Query: `segment_id`, `day_type`, `hour`
Logika: susun fitur dari query params + `corridor_type` (lookup dari `road_segments`) → `model.predict(features)` (lihat §3.5) → fallback ke `congestion_multipliers` kalau model tidak tersedia
Response: `{ "segment_id": "...", "level": "high", "multiplier": 2.5, "source": "model" }`

### `GET /route`
Query: `origin`, `destination`, `departure_window_start`, `departure_window_end`
Logika:
1. Panggil OSRM untuk geometri rute + estimasi waktu tempuh dasar
2. Overlay multiplier congestion per segmen yang dilalui (dari Supabase)
3. Hitung beberapa opsi jam berangkat dalam window, pilih yang total waktu tempuh terbobotinya paling rendah
4. Hitung `emission_score` relatif (fungsi sederhana dari total multiplier terboboti)

Response:
```json
{
  "recommended_departure": "05:30",
  "route_geometry": "...",
  "estimated_duration_min": 42,
  "emission_score": "low",
  "explanation": "Menghindari jam padat weekday 06:00-09:00 di Yos Sudarso"
}
```

### `GET /ferry-schedule`
Query: `terminal`
Response: list jadwal keberangkatan

### `POST /agent/chat`
Body: `{ "message": "..." }`
Logika: kirim ke Gemini dengan tool schema (lihat §5), Gemini memutuskan tool mana yang dipanggil, backend eksekusi tool → hasil dikembalikan ke Gemini → Gemini susun jawaban natural.
Response: `{ "reply": "...", "tool_calls_used": [...] }`

## 5. Agent Tool Schema (Gemini Function Calling)

```json
[
  {
    "name": "get_congestion_level",
    "description": "Ambil estimasi tingkat kemacetan di sebuah ruas jalan pada waktu tertentu",
    "parameters": {
      "type": "object",
      "properties": {
        "segment_id": {"type": "string"},
        "day_type": {"type": "string", "enum": ["weekday", "weekend"]},
        "hour": {"type": "integer"}
      },
      "required": ["segment_id", "day_type", "hour"]
    }
  },
  {
    "name": "get_optimal_route",
    "description": "Hitung rute dan jam berangkat terbaik dari origin ke destinasi",
    "parameters": {
      "type": "object",
      "properties": {
        "origin": {"type": "string"},
        "destination": {"type": "string"},
        "departure_window_start": {"type": "string"},
        "departure_window_end": {"type": "string"}
      },
      "required": ["origin", "destination"]
    }
  },
  {
    "name": "get_ferry_schedule",
    "description": "Ambil jadwal keberangkatan ferry di sebuah terminal",
    "parameters": {
      "type": "object",
      "properties": {
        "terminal": {"type": "string", "enum": ["batam_center", "sekupang", "batu_ampar"]}
      },
      "required": ["terminal"]
    }
  }
]
```

System prompt (ringkas): agent wajib memanggil tool sebelum menjawab pertanyaan yang butuh data (jangan menebak angka); jika semua tool gagal, beri disclaimer jujur, jangan mengarang jawaban.

## 6. Environment Variables (draft)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
GEMINI_API_KEY=
OSRM_BASE_URL=https://router.project-osrm.org
NEXT_PUBLIC_API_BASE_URL=
```

## 7. Risiko Teknis & Mitigasi

| Risiko | Mitigasi |
|---|---|
| OSRM public server down/lambat | Fallback: estimasi jarak Haversine × faktor kecepatan rata-rata |
| Gemini rate limit saat demo live | Gunakan Flash-Lite, fallback rule-based response, batasi skenario chat yang sudah ditest |
| Supabase free tier limit (koneksi/row) | Data statis kecil (puluhan-ratusan baris), jauh di bawah limit free tier |
| Waktu habis sebelum agent selesai (checkpoint jam 11) | Drop fitur chat, tampilkan hasil via form biasa — fitur inti (routing + heatmap) tetap utuh |
| Model ML gagal load / hasil prediksi tidak masuk akal | Fallback otomatis ke lookup table `congestion_multipliers`; test model dengan beberapa kasus known-value sebelum integrasi ke `/congestion` |

## 8. Checklist Setup Awal (Jam 0–1)

- [ ] Buat project Supabase, catat URL + anon key
- [ ] Buat project Gemini API key di AI Studio, test 1 request sederhana
- [ ] Setup repo GitHub + struktur folder (`/frontend`, `/backend`)
- [ ] Deploy skeleton kosong ke Vercel (frontend) & Railway/Render (backend) — supaya pipeline deployment sudah jalan sejak awal, tidak diburu di jam-jam akhir
- [ ] Isi tabel Supabase dengan data awal (bisa placeholder, disempurnakan jam 1-3)
