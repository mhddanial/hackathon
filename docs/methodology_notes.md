# Methodology Notes — Batam SmartFlow

> Dipindahkan dari sheet `congestion_multipliers` kolom J–Y (Excel: *Batam SmartFlow Data Master*).
> Tidak diimpor ke Supabase — hanya sebagai referensi riset.

---

## NOTE001 — Congestion Multiplier (Peak Hour)

**Topic:** Congestion Multiplier (Peak Hour)  
**Method / Source:** Calibration from Empirical Traffic Research  
**Technical Explanation:**  
Angka multiplier (1.50–2.10x) menggambarkan lonjakan waktu tempuh akibat kemacetan jam sibuk. Dikalibrasi dari studi empiris koridor logistik Batam di mana >70% volume kendaraan jam sibuk adalah angkutan barang/truk kontainer.  
**Journal / Reference:** Pure Journal UB & Kyushu Univ Evergreen Journal (2024)

---

## NOTE002 — Congestion Multiplier (Weekend & Off-Peak)

**Topic:** Congestion Multiplier (Weekend & Off-Peak)  
**Method / Source:** Baseline Low-Traffic Assumption  
**Technical Explanation:**  
Arus weekend (multiplier 1.00–1.25x) dan malam hari (00:00–06:00) diasumsikan flat/lancar akibat berhentinya jam operasional utama pabrik kawasan industri Mukakuning & Tanjung Uncang.  
**Journal / Reference:** Analisis Pola Pergerakan Logistik Industri Batam

---

## NOTE003 — Road Segment Coordinates (Lat/Lng)

**Topic:** Road Segment Coordinates (Lat/Lng)  
**Method / Source:** Real-world GIS & Google Maps API  
**Technical Explanation:**  
Titik koordinat awal (start) dan akhir (end) tiap segmen diambil dari gerbang arteri utama dan dermaga pelabuhan real di Batam (misal: Dermaga Selatan Batu Ampar 1.165051, 103.998727).  
**Journal / Reference:** Google Maps Platform & Batam Spatial Planning (Perwako No. 60/2021)

---

## NOTE004 — Carbon Emission Factor

**Topic:** Carbon Emission Factor  
**Method / Source:** IPCC Standard Guidelines  
**Technical Explanation:**  
Perhitungan emisi berbasis faktor emisi standar pembakaran diesel: **2.68 kg CO₂ per liter BBM**. Idling saat macet meningkatkan konsumsi BBM truk 2.0–2.5 L/jam.  
**Formula yang dipakai di notebook:**
- `T_actual = (Distance / Free_Flow_Speed) × Multiplier × 60` menit
- `Fuel = (Distance × 0.25 L/km) + (Idle_Hours × 2.25 L/hr)`
- `Emission (kg CO₂) = Fuel × 2.68`

**Journal / Reference:** 2006 IPCC Guidelines for National Greenhouse Gas Inventories & Ditjen EBTKE ESDM

---

## NOTE005 — Ferry Timetables & Cut-off

**Topic:** Ferry Timetables & Cut-off  
**Method / Source:** Consolidated Official Operator Schedules  
**Technical Explanation:**  
Jam keberangkatan dan waktu cut-off gate-in pelabuhan disesuaikan dengan jadwal harian publik kapal kargo/intermodal dan fast ferry rute Batam–Singapore.  
**Journal / Reference:** Official Timetables: BatamFast, Sindo Ferry, Majestic, & BP Batam Port Operations

---

## Interactive Simulation Table (dari kolom R–Y)

Tabel perhitungan contoh yang ada di spreadsheet — nilai dihitung pakai formula Excel:

| Segmen | Distance (km) | Free-Flow Speed (km/h) | Multiplier | T_actual (min) | Idle Time (hr) | Fuel Used (L) | CO₂ (kg) |
|---|---|---|---|---|---|---|---|
| Jl. Yos Sudarso (Peak Sore) | 12.5 | 40.0 | 2.10 | 39.4 | 0.33 | 3.87 | 10.37 |
| Jl. Jendral Sudirman (Peak Pagi) | 8.2 | 45.0 | 1.50 | 16.4 | 0.09 | 2.25 | 6.04 |
| Jl. Ahmad Yani (Off-Peak) | 6.4 | 50.0 | 1.15 | 8.8 | 0.02 | 1.64 | 4.40 |
