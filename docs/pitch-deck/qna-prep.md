# Persiapan Tanya Jawab (Q&A Prep)

_Kumpulan prediksi pertanyaan dari Juri dan panduan cara menjawabnya (terutama terkait teknis dan keberlanjutan produk)._

### 1. Dari mana data jadwal feri dan kondisi pelabuhan ini berasal?
**Jawaban:** Untuk prototipe/demo ini, kami menggunakan sistem simulasi _mock data_ dari *backend* kami (FastAPI) untuk mendemonstrasikan algoritma *routing* dan prediksi AI. Di dunia nyata, ini akan berintegrasi via API langsung dengan otoritas pelabuhan (Batam/Singapura) dan penyedia feri kargo.

### 2. Apa bedanya SmartFlow dengan aplikasi manajemen logistik yang sudah ada?
**Jawaban:** SmartFlow fokus secara spesifik pada **Konektivitas Lintas Batas (Cross-Border)** dan **Keberlanjutan (Sustainability)**. Selain optimasi rute biasa, asisten AI (Oracle) kami mampu memahami konteks tak terduga (seperti cuaca buruk di selat) dan mengkalkulasi dampak emisi secara instan, sesuatu yang jarang ada di aplikasi konvensional.

### 3. Bagaimana model AI di balik 'Logistics Oracle' bekerja?
**Jawaban:** Oracle dibangun menggunakan Large Language Models (LLM) yang disesuaikan (*prompt-engineered*) untuk memahami konteks logistik logistik. Saat ini ia memproses _context_ dari _state_ aplikasi dan data simulasi untuk memberikan rekomendasi re-routing dan notifikasi _delay_ prediksi.

### 4. Seberapa akurat metrik pelacakan Emisi (Sustainability) yang kalian buat?
**Jawaban:** Kami menggunakan rumus standar konversi (contoh: estimasi konsumsi bahan bakar vs. jarak tempuh laut & darat). Meski saat ini bersifat kalkulasi dasar, arsitekturnya sudah disiapkan agar siap menerima data telemetri nyata (*real telematics*) jika nantinya dihubungkan ke armada di lapangan.

### 5. Apa tantangan terbesar jika aplikasi ini di-deploy sungguhan?
**Jawaban:** Tantangan terbesarnya adalah integrasi API dengan berbagai sistem lama (*legacy systems*) yang dimiliki oleh masing-masing vendor pelayaran dan otoritas pelabuhan. Oleh karena itu, arsitektur kami didesain berbasis API dan modular (FastAPI backend) agar lebih fleksibel dihubungkan ke *gateway* apa pun.
