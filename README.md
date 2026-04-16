<div align="center">
  <img src="public/logo.png" alt="VibeCoderz Logo" width="120" height="auto" />
  <h1>🚀 VibeCoderz AI Architecture Engine</h1>
  <p><strong>Generator Arsitektur Aplikasi dan Product Requirements Document (PRD) Bertenaga AI</strong></p>
</div>

<hr />

## 📖 Deskripsi Proyek
**VibeCoderz** adalah sebuah *platform* *SaaS* yang dirancang untuk mempercepat fase perencanaan infrastruktur dan arsitektur *software*. Dengan hanya menginputkan sedikit deskripsi mengenai aplikasi yang ingin dibuat, *Artificial Intelligence* akan langsung menghasilkan analisis komprehensif, mulai dari eksekutif ringkasan, tumpukan teknologi *(tech-stack)* terbaik, skema *user flow*, sampai *diagram flowchart* dan PRD *(Product Requirements Document)* siap pakai.

## ✨ Fitur Utama
- **Autentikasi Aman:** Sistem _login_ terintegrasi secara _seamless_ menggunakan Google OAuth 2.0.
- **Visualisasi Dinamis:** Memproduksi *flowchart* dan *class diagram* menggunakan _Markdown Mermaid.js_ yang langsung me-render dengan mulus.
- **Akselerator Arsitektur AI:** Mengandalkan ketangguhan model bahasa Llama-3.3-70B (via API Groq) berkecepatan tinggi.
- **Logika Cerdas _Multi-Key_ (Failover):** Integrasi _multi-key_ jika API limit Groq tercapai, menjamin sistem tetap hidup (_zero downtime_ generasi).
- **Desain Antarmuka Premium:** Dibangun memakai konsep _Dark Mode_, _Glassmorphism_, dan micro-animasi yang ditenagai oleh Framer Motion + Tailwind CSS.

## 🛠️ Tech Stack
- **Frontend:** React (Vite), TypeScript, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend:** Node.js, Express.js.
- **Database & ORM:** Prisma ORM dengan SQLite (Zero-configuration).
- **AI Integration:** Groq SDK (Llama-3.3-70B-Versatile).
- **Auth:** `@react-oauth/google` + Google Auth API.

## ⚙️ Cara Menginstall & Menjalankan (Local)

1. **Jalankan Terminal dan Kloning Repositori ini:**
   ```bash
   git clone https://github.com/USERNAME/VibeCoderz.git
   cd VibeCoderz
   ```

2. **Instal Dependensi NPM:**
   ```bash
   npm install
   ```

3. **Set-Up File `.env`:**
   Buat file `.env` di _root_ direktori proyek dan masukkan kredensial berikut:
   ```env
   # API Keys untuk Model Generatif Groq (AI)
   GROQ_API_KEY="gsk_api_pertama_kamu"
   GROQ_API_KEY_2="gsk_api_kedua_cadangan_opsional"

   # Database Lokasi (SQLite)
   SQLITE_URL="file:./dev.db"

   # Google Authentication
   VITE_GOOGLE_CLIENT_ID="klien-id-google-kamu.apps.googleusercontent.com"
   ```

4. **Kompilasi Database (Prisma):**
   Mulai pembuatan file database sinkron ke Schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Jalankan Server:**
   ```bash
   npm run dev
   ```
   Web server akan terbuka di rute *development* biasa Anda. Silakan nikmati VibeCoderz!

## 🛡️ Keamanan & Privasi
- Jangan pernah _commit_ file `.env` yang berisikan kunci asli Anda ke dalam github langsung. Pastikan terdapat entri `.env` pada `.gitignore` Anda.

<br />

<div align="center">
  <sub>Dibangun dengan ❤️ untuk Ekosistem Developer Global.</sub>
</div>
