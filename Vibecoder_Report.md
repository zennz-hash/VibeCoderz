# Laporan Proyek: Vibecoder (PRD Generator Platform)

## 1. Ikhtisar Proyek
**Vibecoder** adalah platform SaaS cerdas berbasis *Artificial Intelligence* (AI) yang dirancang secara khusus untuk para *developer*, *tech-founder*, dan arsitek perangkat lunak. Tujuan utama platform ini adalah mempercepat proses penyusunan *Product Requirements Document* (PRD), perancangan infrastruktur database, dan sinkronisasi ekosistem teknologi dari hitungan minggu menjadi hitungan detik.

Antarmuka Vibecoder dirancang dengan estetika **Modern Web3 Tech Community** (terinspirasi dari platform terkemuka seperti BlockDev.id), mengutamakan struktur *Bento Grid* yang tegas, sudut memutar (*large border-radius*), dan palet warna kontras tinggi (Deep Navy, Electric Blue, dan Mint Green) yang menjauhi stereotip UI generik berbasis AI.

---

## 2. Arsitektur / *Tech Stack*
Proyek ini dibangun di atas fondasi teknologi modern *Fullstack*:
- **Frontend**: React (via Vite) dengan TypeScript.
- **Styling**: Tailwind CSS v4 untuk pengaturan desain utilitas dan struktur tata letak *grid*.
- **Animasi/Transisi**: Framer Motion untuk memberikan interaktivitas pegas (*spring animations*) dan transisi antarmuka yang ultra-halus.
- **Visualisasi Arsitektur**: Mermaid.js untuk mengubah respons teks AI menjadi diagram relasi entitas (*ER Diagram*) interaktif di *Dashboard*.
- **Backend / Routing Tambahan**: Node.js & Express (terpisah atau disisipkan melalui setup Vite-plugin/server lokal) untuk menjembatani komunikasi ke LLM.
- **Engine AI**: Groq API ditenagai oleh model performa tinggi **Llama 3.3 70B** atau ekuivalen kustom, untuk komputasi bahasa teknikal.

---

## 3. Fitur Utama Platform

### A. Landing Page Terbuka (Publik)
Halaman depan difokuskan sebagai kanal konversi (*funnel*) dengan informasi utuh yang menampilkan:
- **Hero Section**: *Headlines* provokatif mengenai revolusi pembentukan ekosistem dan penghematan jutaan baris kode, disisipkan visual *badge* dan statistik.
- **Bento Grid Features**: Presentasi 3 kapabilitas utama (Arsitektur Presisi, Visualisasi Skema, dan Rantai Eksekusi) dalam format kotak padat modern.
- **Modul Etalase Kapasitas (Harga)**: Tabel perbandingan benefit paket (Trial, Starter, Pro) sebagai ajang referensi calon pengguna sebelum memutuskan masuk ke dasbor.
- **Login Ekosistem**: Dialog modal *Overlay* estetik autentikasi mandiri.

### B. Konsol / Dasbor Interaktif (Ruang Terbatas)
Pengalaman utama pengguna berada di area *Workspace* tertutup:
- **Pusat Komando (Home)**: Metrik ringkas berupa jumlah *blueprint* yang sudah dirakit serta status *AI engine*.
- **Builder Node (Merakit PRD)**: Sebuah iterasi pertanyaan (Formulir AI) bergaya *slide-by-slide* di mana pengguna mengisi variabel: jenis aplikasi, segmen pasar, opsi *login*, fitur prioritas, penyimpanan, hingga strategi desain sistem (Monolith/Microservices). Parameter akhir dirender *real-time* ke server lokal AI.
- **Dokumen Teknis Visual**: Hasil sintesis LLM dimuntahkan menjadi format tulisan *Markdown*, dilengkapi diagram basis data (dari *Mermaid code block*) yang dapat disalin (*Copy*) atau diturunkan berformat `.md` langsung.
- **Pembelian Kapasitas (Ruang Upgrade)**: Opsi purna-jual agar pengguna *freemium* dapat melunasi tagihan naik tingkat tanpa keluar panel.

---

## 4. Model Bisnis & Lisensi
Pemutaran operasional dibagi menjadi tiga tingkat keanggotaan:

| Komponen | PRD Trial | PRD Starter (Rp20.000/bln) | PRD Pro (Rp75.000/bln) |
| :--- | :--- | :--- | :--- |
| **Model Mesin Akal**| Standar | Premium | Premium+ (GodMode) |
| **Batas Harian (Token)**| 1x PRD per hari | 5x PRD setiap hari | Rekues *Unlimited* (Tak Terbatas) |
| **Eksport Berkas MD**| Terbuka | Terbuka | Terbuka |
| **Revisi Interaktif**| Terkunci | Mendukung (Batas 20 *chat*) | Sepenuhnya Terbuka (100++ *chat*) |
| **Batas Kedaluwarsa**| Sesuai kuota | Tidak Ada *Expiry* | Tidak Ada *Expiry* |
| **Bonus Pelengkap** | - | - | Kursus VibeCoding Eksklusif |

---

## 5. Panduan Menjalankan Sistem
1. Pastikan seluruh dependensi telah diinisiasi via komando lokal perangkat: `npm install`.
2. Pasang lisensi akses AI (Groq API Key) di dalam arsip variabel `.env`.
3. Aktifkan saluran eksekusi dengan `npm run dev`. Proses akan membangun *server* proksi backend pada port 3000 sekaligus menjembatani klien visual web.
4. Buka penjelajah (browser) web menuju `http://localhost:3000/`.

---
*Laporan diekspor secara algoritmik dari sistem repositori lokal.*
