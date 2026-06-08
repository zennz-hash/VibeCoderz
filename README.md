<div align="center">
  <img src="public/logo.png" alt="VibeCoderz Logo" width="120" height="auto" />
  <h1>🚀 VibeCoderz AI Architecture Engine</h1>
  <p><strong>Generator Arsitektur Aplikasi dan Product Requirements Document (PRD) Bertenaga AI</strong></p>
</div>

<hr />

## 📖 Deskripsi Proyek
**VibeCoderz** adalah sebuah *platform* *SaaS* yang dirancang untuk mempercepat fase perencanaan infrastruktur dan arsitektur *software*. Dengan hanya menginputkan sedikit deskripsi mengenai aplikasi yang ingin dibuat, *Artificial Intelligence* akan langsung menghasilkan analisis komprehensif, mulai dari eksekutif ringkasan, tumpukan teknologi *(tech-stack)* terbaik, skema *user flow*, sampai *diagram flowchart* dan PRD *(Product Requirements Document)* siap pakai.

## ✨ Fitur Utama
- **Autentikasi Aman:** Login Google ID token diverifikasi di server, sesi disimpan di database, dan browser memakai cookie httpOnly.
- **Generator PRD AI:** Menghasilkan PRD lengkap (Executive Summary, tech stack, arsitektur, Vibecoding Plan) dalam Bahasa Indonesia.
- **Build Code (IDE AI):** Generate aplikasi React lengkap dari instruksi/dokumen, dijalankan langsung di browser via Sandpack, dengan auto-fix error.
- **Visualisasi Dinamis:** Render _flowchart_ & _class diagram_ via _Markdown Mermaid.js_.
- **Multi-Model AI:** 9router OpenAI-compatible sebagai provider utama, dengan fallback otomatis dari model premium ke model cepat bila provider belum tersedia.
- **Failover Model:** Otomatis mencoba model fallback saat model pilihan gagal sebelum request dianggap gagal.
- **Sistem Kuota & Plan:** Kuota harian PRD & Code per plan (FREE/PRO/PRO_MAX), reset otomatis (zona waktu Asia/Jakarta).
- **Manajemen Blueprint:** Auto-save, share publik, revisi AI, dan edit manual (PRO/PRO_MAX).
- **Desain Premium:** _Dark Mode_, _Glassmorphism_, micro-animasi (Framer Motion + Tailwind CSS).

## 🛠️ Tech Stack
- **Frontend:** React 19 (Vite), TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, Recharts, Mermaid, Sandpack.
- **Backend:** Node.js, Express.js, tsx.
- **Database & ORM:** Prisma ORM dengan SQLite (Zero-configuration).
- **AI Integration:** OpenAI SDK (kompatibel) melalui 9router.
- **Auth:** `@react-oauth/google` + Google ID token verification + JWT session cookie httpOnly.

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
   Salin `.env.example` menjadi `.env`, lalu isi kredensialnya:
   ```bash
   cp .env.example .env
   ```
   ```env
   # AI via 9router
   ROUTER9_API_KEY="..."
   ROUTER9_BASE_URL="https://your-9router-openai-compatible-base-url/v1"
   ROUTER9_MODEL="ag/gemini-3-flash"

   # WAJIB — server tidak akan jalan tanpa JWT_SECRET (min. 32 karakter)
   JWT_SECRET="<hasil: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\">"
   ADMIN_EMAILS="ikhwanda466@gmail.com"

   # Google Authentication
   VITE_GOOGLE_CLIENT_ID="klien-id-google-kamu.apps.googleusercontent.com"

   # Database (SQLite)
   SQLITE_URL="file:./dev.db"

   # Produksi: isi bila frontend beda origin dari backend. Bisa comma-separated.
   FRONTEND_URL="https://domain-kamu.com"
   # Aktifkan hanya jika server berada di belakang reverse proxy terpercaya.
   TRUST_PROXY="1"
   ```
   > ⚠️ Tanpa `JWT_SECRET` (min. 32 karakter), server akan berhenti saat startup.

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
