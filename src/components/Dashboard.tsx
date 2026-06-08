import React, { useState, useEffect, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { Layers, Activity, Search, Clock, LogOut, ArrowRight, Settings, Check, Download, Copy, Play, Code2, Menu, ChevronLeft, Bot, Trash2, Eye, User, Edit2, Save, Send, Loader2, ShoppingCart, LayoutDashboard, MessageCircle, GraduationCap, Wallet, Building2, UtensilsCrossed, Users, HeartPulse, ClipboardList, FileText, Folder, Tag } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ApiConnectionError, apiFetch, readApiError, userFacingError } from '../utils/api';

const BuildCode = React.lazy(() => import('./BuildCode'));

type MermaidModule = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidModule> | null = null;

function loadMermaid(): Promise<MermaidModule> {
  mermaidPromise ??= import('mermaid').then((mod) => {
    const instance = mod.default;
    instance.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        primaryColor: '#1e293b',
        primaryTextColor: '#fff',
        primaryBorderColor: '#334155',
        lineColor: '#94a3b8',
        secondaryColor: '#FFFFFF',
        tertiaryColor: '#0f172a',
      },
      securityLevel: 'strict',
    });
    return instance;
  });
  return mermaidPromise;
}

/* Ikon template PRD (pengganti emoji) — dipetakan dari id template. */
const TEMPLATE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  t1: ShoppingCart,        // E-Commerce
  t2: LayoutDashboard,     // SaaS Dashboard
  t3: MessageCircle,       // Social Media
  t4: GraduationCap,       // LMS
  t5: Wallet,              // Fintech Wallet
  t6: Building2,           // Property
  t7: UtensilsCrossed,     // Food Delivery
  t8: Users,               // HR & Payroll
  t9: HeartPulse,          // Healthcare
  t10: ClipboardList,      // Project Management
};

/* Sanitize SVG to prevent XSS from AI-generated content */
const sanitizeSvg = (svgString: string): string => {
  /* Remove script tags */
  let safe = svgString.replace(/<script[\s\S]*?<\/script>/gi, '');
  /* Remove event handlers */
  safe = safe.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  /* Remove javascript: URIs */
  safe = safe.replace(/javascript\s*:/gi, 'blocked:');
  return safe;
};

const MermaidDiagram = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState('');
  const [hasError, setHasError] = useState(false);
  const baseId = useId().replace(/:/g, '');
  const id = useMemo(() => `mermaid-${baseId}-${Math.random().toString(36).slice(2, 8)}`, [baseId]);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    const renderChart = async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(id, chart);
        if (isMounted) setSvg(sanitizeSvg(svg));
      } catch (error) {
        if (isMounted) setHasError(true);
        /* Cleanup phantom mermaid container that leaks on error */
        const phantom = document.getElementById('d' + id);
        if (phantom) phantom.remove();
      }
    };

    renderChart();
    return () => {
      isMounted = false;
      // Cleanup phantom mermaid container to prevent DOM leak
      document.getElementById('d' + id)?.remove();
    };
  }, [chart, id]);

  if (hasError) {
    return (
      <div className="my-8 bg-red-500/10 border border-red-500/20 rounded-3xl p-8">
        <div className="mb-4 font-bold text-red-400">ER Diagram Rendering Failed</div>
        <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap bg-black/50 p-6 rounded-2xl">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-wrapper my-12 flex justify-center bg-[#000000] border border-white/5 rounded-[40px] p-10 overflow-x-auto shadow-2xl"
      dangerouslySetInnerHTML={{ __html: svg || '<div class="text-gray-400 font-medium">Memproses Diagram Visual...</div>' }}
    />
  );
};

type QuestionType = 'single' | 'multi' | 'input';
interface QuizQuestion {
  id: number;
  title: string;
  type: QuestionType;
  options?: string[];
}

/* ================================================================
   DYNAMIC QUIZ: Konteks pertanyaan berubah sesuai jenis proyek
   Mendukung 14+ kategori industri secara otomatis
================================================================ */
function getQuizQuestions(projectType: string, description: string): QuizQuestion[] {
  const desc = (description + ' ' + projectType).toLowerCase();

  /* ── Context Detection Engine ── */
  const isWeb3       = /web3|blockchain|defi|nft|crypto|token|smart.?contract|dapp|wallet|solidity/.test(desc);
  const isMobile     = /mobile|android|ios|flutter|react.native/.test(desc) || projectType.toLowerCase().includes('mobile');
  const isAI         = /\bai\b|llm|machine.?learn|chatbot|gpt|gemini|claude|deep.?learn|neural|nlp/.test(desc) || projectType.includes('AI');
  const isEcommerce  = /toko|ecommerce|e-commerce|marketplace|shop|belanja|produk|checkout|keranjang/.test(desc) || projectType.includes('Commerce');
  const isFinance    = /financ|fintech|bank|invest|trading|saham|reksa.?dana|pinjam|kredit|wallet|pembayaran|akuntansi|invoic|billing/.test(desc);
  const isProperty   = /properti|property|real.?estate|rumah|apartemen|kos|sewa|listing|agen/.test(desc);
  const isHealth     = /health|kesehatan|medis|rumah.?sakit|klinik|dokter|apotek|telemedi|rekam.?medis|pasien/.test(desc);
  const isEducation  = /educa|pendidikan|lms|e-?learn|kursus|course|siswa|guru|murid|sekolah|kampus|universitas|quiz|ujian/.test(desc);
  const isSocial     = /social|sosial.?media|komunitas|forum|feed|post|follow|friend|chat|messaging/.test(desc);
  const isFood       = /food|makan|restoran|restaurant|catering|menu|delivery|kuliner|dapur|resep|cafe/.test(desc);
  const isTravel     = /travel|wisata|hotel|penginapan|booking|reservasi|tiket|perjalanan|tour|destinasi/.test(desc);
  const isLogistic   = /logist|pengiriman|kurir|gudang|warehouse|inventori|stok|supply.?chain|tracking|fleet/.test(desc);
  const isHR         = /\bhr\b|hrd|sdm|rekrutmen|recruit|karyawan|absensi|payroll|gaji|cuti|employee/.test(desc);
  const isGaming     = /game|gaming|esport|turnamen|leaderboard|reward|quest|achievement|multiplayer/.test(desc);
  const isAPI        = projectType.toLowerCase().includes('api');
  const isSaaS       = /saas|subscription|langganan|multi.?tenant/.test(desc) || projectType.includes('SaaS');
  const isCMS        = /cms|content.?manage|blog|artikel|berita|news|publish|editor/.test(desc);

  /* ── Q1: Platform ── */
  const q1Options = isMobile
    ? ["Android Native", "iOS Native", "Cross-Platform (Flutter)", "React Native", "PWA"]
    : isWeb3
    ? ["dApp (Decentralized App)", "DeFi Platform", "NFT Marketplace", "DAO Dashboard", "Hybrid (Web2+Web3)"]
    : ["Aplikasi Web (SPA)", "Server-Side Rendered (SSR)", "Static Site (SSG)", "Desktop (Electron)", "Lainnya"];

  /* ── Q2: Target User — Adaptif per konteks ── */
  const q2Options = isWeb3       ? ["Trader / Investor Crypto", "NFT Collector / Creator", "Developer Blockchain", "DAO Members", "Lainnya"]
    : isEcommerce  ? ["Pembeli Individu (B2C)", "Reseller / Dropshipper", "Penjual / Merchant", "Enterprise Buyer (B2B)", "Lainnya"]
    : isFinance    ? ["Nasabah Individu", "Investor Ritel", "Pelaku Bisnis (UMKM)", "Perusahaan Korporat", "Lainnya"]
    : isProperty   ? ["Pencari Properti (Buyer)", "Pemilik / Landlord", "Agen / Broker", "Developer Properti", "Lainnya"]
    : isHealth     ? ["Pasien Umum", "Dokter / Tenaga Medis", "Admin Rumah Sakit", "Apotek / Farmasi", "Lainnya"]
    : isEducation  ? ["Siswa / Mahasiswa", "Guru / Dosen", "Admin Akademik", "Orang Tua / Wali", "Lainnya"]
    : isSocial     ? ["End User / Publik", "Kreator / Influencer", "Brand / Bisnis", "Moderator / Admin", "Lainnya"]
    : isFood       ? ["Pelanggan / Konsumen", "Pemilik Restoran", "Driver / Kurir", "Supplier Bahan Baku", "Lainnya"]
    : isTravel     ? ["Traveler / Wisatawan", "Pemilik Hotel / Penginapan", "Tour Operator", "Mitra Transportasi", "Lainnya"]
    : isLogistic   ? ["Pengirim (Shipper)", "Kurir / Driver", "Manajer Gudang", "Pelanggan Akhir", "Lainnya"]
    : isHR         ? ["Karyawan", "HRD / Manajer SDM", "Pelamar Kerja", "C-Level / Direksi", "Lainnya"]
    : isGaming     ? ["Gamer Kasual", "Gamer Kompetitif / Esport", "Developer Game", "Penyelenggara Turnamen", "Lainnya"]
    : isCMS        ? ["Penulis / Editor", "Admin Konten", "Pembaca / Subscriber", "Tim Marketing", "Lainnya"]
    : ["Retail (B2C)", "Institusi (B2B)", "Developer (B2D)", "Internal Enterprise", "Lainnya"];

  /* ── Q3: Auth ── */
  const q3Options = isWeb3       ? ["Web3 Wallet (MetaMask/Phantom)", "WalletConnect", "SIWE (Sign-In with Ethereum)", "Email + Wallet Binding", "Social Login Fallback"]
    : isMobile     ? ["Biometrik (Fingerprint/FaceID)", "OTP via SMS/WhatsApp", "Social Login (Google/Apple)", "Email/Sandi", "PIN Code"]
    : isFinance    ? ["KYC + Verifikasi Identitas", "2FA (OTP + Authenticator)", "Email/Sandi + PIN Transaksi", "Biometrik", "SSO Enterprise"]
    : isHealth     ? ["NIK + Verifikasi Pasien", "OTP via SMS", "Login Khusus Tenaga Medis", "SSO Rumah Sakit", "Lainnya"]
    : isEducation  ? ["NIS/NIM + Password", "Google Workspace (Education)", "SSO Kampus", "OTP via WhatsApp", "Lainnya"]
    : ["Email/Sandi", "Social Web2 (Google/X)", "OAuth2 / SSO Enterprise", "Magic Link (Passwordless)", "OTP via WhatsApp"];

  /* ── Q4: Fitur Prioritas — PALING KONTEKSTUAL ── */
  const q4Options = isWeb3       ? ["Smart Contract (Solidity/Rust)", "Token Staking / Yield Farming", "On-chain Governance (DAO)", "NFT Minting & Marketplace", "Cross-chain Bridge", "Oracle Integration (Chainlink)", "Wallet Portfolio Tracker"]
    : isAI         ? ["LLM Chat Interface", "RAG (Retrieval Augmented Gen)", "Image/Audio Generation", "Fine-tuning Pipeline", "Vector Database (Embeddings)", "Agent / Tool-use System", "Content Moderation AI"]
    : isEcommerce  ? ["Payment Gateway (Midtrans/Stripe)", "Keranjang & Checkout", "Inventori & Stok Real-time", "Sistem Review & Rating", "Kurir / Ongkir Integration", "Voucher & Promo Engine", "Dashboard Seller"]
    : isFinance    ? ["Payment Gateway / Transfer", "Manajemen Portofolio", "Laporan Keuangan Otomatis", "Notifikasi Transaksi Real-time", "KYC/AML Verification", "Multi-currency Support", "Audit Trail & Compliance"]
    : isProperty   ? ["Pencarian & Filter Properti", "Peta Lokasi Interaktif", "Kalkulator KPR / Cicilan", "Virtual Tour 360°", "Sistem Booking Kunjungan", "Dashboard Agen", "Sistem Review Properti"]
    : isHealth     ? ["Rekam Medis Elektronik", "Booking & Antrian Online", "Telemedicine (Video Call)", "E-Resep & Apotek Online", "Riwayat Lab & Hasil Tes", "Reminder Obat / Jadwal", "Dashboard Dokter"]
    : isEducation  ? ["Video Streaming / LMS", "Kuis & Ujian Online", "Sistem Penilaian Otomatis", "Forum Diskusi / Tanya Jawab", "Sertifikat Digital", "Progress Tracking / Rapor", "Live Class (Video Conference)"]
    : isSocial     ? ["Feed / Timeline Post", "Direct Message / Chat", "Story / Reel / Short Video", "Like / Comment / Share", "Notifikasi Real-time", "User Profile & Follow", "Content Recommendation AI"]
    : isFood       ? ["Menu Digital & Ordering", "Delivery Tracking Real-time", "Sistem Rating & Ulasan", "Manajemen Meja / Reservasi", "Loyalty Points / Voucher", "Kitchen Display System", "Laporan Penjualan Harian"]
    : isTravel     ? ["Pencarian & Booking Hotel", "Tiket Pesawat / Kereta", "Itinerary Planner", "Review & Rating Destinasi", "Peta Wisata Interaktif", "Payment Multi-method", "Notifikasi & Reminder Perjalanan"]
    : isLogistic   ? ["Fleet / Armada Tracking GPS", "Manajemen Gudang (WMS)", "Scan Barcode / QR", "Route Optimization", "Proof of Delivery", "Laporan Pengiriman Real-time", "Integrasi Marketplace"]
    : isHR         ? ["Absensi & Kehadiran (Clock In/Out)", "Payroll & Slip Gaji", "Manajemen Cuti & Izin", "Rekrutmen & Lamaran Online", "KPI & Performance Review", "Org Chart & Struktur Tim", "Training / E-Learning Internal"]
    : isGaming     ? ["Leaderboard & Ranking", "In-app Purchase / Microtx", "Matchmaking System", "Achievement / Quest System", "Social & Guild System", "Anti-cheat Mechanism", "Tournament Bracket"]
    : isCMS        ? ["Rich Text Editor (WYSIWYG)", "Media Library & Asset Mgmt", "SEO Optimization Tools", "Scheduling & Auto-publish", "Multi-language / i18n", "Version History & Drafts", "Comment Moderation"]
    : isSaaS       ? ["Multi-tenant Architecture", "Subscription & Billing", "Role-based Access Control", "Analytics Dashboard", "Webhook & API Integration", "Email Notification Engine", "Audit Log & Activity Feed"]
    : ["Payment Gateway", "Real-time Chat / Messaging", "Modul AI / LLM", "Dasbor Analisis Data", "Notifikasi Push", "File Upload & Storage", "Lainnya"];

  /* ── Q5: Database ── */
  const q5Options = isWeb3
    ? ["On-chain Storage (EVM)", "IPFS / Arweave", "The Graph (Indexing)", "Hybrid (On-chain + DB)", "Lainnya"]
    : isHealth || isFinance
    ? ["PostgreSQL (ACID Compliance)", "Oracle DB (Enterprise)", "Supabase + Row Level Security", "Hybrid (SQL + NoSQL)", "Lainnya"]
    : ["PostgreSQL (Relasional)", "MongoDB (NoSQL)", "Supabase (PostgreSQL + Realtime)", "Firebase / Firestore", "MySQL", "SQLite (Lokal)"];

  /* ── Q6: Backend / Infra ── */
  const q6Title = isWeb3 ? "Pilih jaringan blockchain utama:" : isLogistic ? "Arsitektur tracking & real-time:" : "Pilih paradigma struktur backend-mu:";
  const q6Options = isWeb3
    ? ["Ethereum", "Polygon (PoS)", "Solana", "BNB Smart Chain", "Arbitrum / Optimism (L2)", "Base (Coinbase L2)", "Multi-chain"]
    : isAPI
    ? ["REST API (Express/Fastify)", "GraphQL (Apollo/Yoga)", "gRPC Microservice", "tRPC (End-to-end Typesafe)", "WebSocket Server", "Lainnya"]
    : isLogistic
    ? ["WebSocket + Redis Pub/Sub", "MQTT (IoT Sensors)", "Server-Sent Events (SSE)", "Firebase Realtime DB", "Lainnya"]
    : ["Monolithic Server", "Microservices (Kubernetes)", "Serverless Functions", "Edge Computing (Cloudflare)", "BaaS (Supabase/Firebase)", "Lainnya"];

  /* ── Q7: Monetisasi ── */
  const q7Title = isWeb3       ? "Model tokenomics atau mekanisme pendapatan?"
    : isEcommerce  ? "Model pendapatan (komisi, langganan, iklan)?"
    : isFinance    ? "Model bisnis (bunga, biaya admin, premium tier)?"
    : isEducation  ? "Model monetisasi (freemium, per kursus, subscription)?"
    : isGaming     ? "Model monetisasi (in-app purchase, ads, premium)?"
    : isHealth     ? "Model bisnis (per konsultasi, berlangganan, B2B rumah sakit)?"
    : isFood       ? "Model pendapatan (komisi per order, langganan resto, ads)?"
    : "Mekanisme utama aliran pendapatan (Monetisasi)?";

  return [
    { id: 1, title: "Apa bentuk akhir dari platform teknologimu?", type: 'single' as QuestionType, options: q1Options },
    { id: 2, title: "Siapa segmentasi pengguna utamamu?", type: 'single' as QuestionType, options: q2Options },
    { id: 3, title: "Metode otentikasi (login) apa yang digunakan?", type: 'multi' as QuestionType, options: q3Options },
    { id: 4, title: "Pilih infrastruktur fitur prioritas yang krusial:", type: 'multi' as QuestionType, options: q4Options },
    { id: 5, title: "Bagaimana arsitektur penyimpanan datamu?", type: 'single' as QuestionType, options: q5Options },
    { id: 6, title: q6Title, type: 'single' as QuestionType, options: q6Options },
    { id: 7, title: q7Title, type: 'input' as QuestionType }
  ];
}

const LOADING_SEQUENCE = [
  "Menyinkronkan Parameter Infrastruktur...",
  "Merakit Matriks Relasional Database...",
  "Memetakan Aliran Data Pengguna...",
  "Mengekstrak Dokumen Teknis...",
  "Finalisasi Blueprints..."
];

const parseBlueprintTags = (blueprint: any): string[] => {
  if (Array.isArray(blueprint?.tags)) return blueprint.tags.filter((tag: unknown) => typeof tag === 'string');
  if (typeof blueprint?.tagsJson !== 'string') return [];
  try {
    const parsed = JSON.parse(blueprint.tagsJson);
    return Array.isArray(parsed) ? parsed.filter((tag: unknown) => typeof tag === 'string') : [];
  } catch {
    return [];
  }
};

const normalizeTagsInput = (value: string): string[] => (
  Array.from(new Set(
    value
      .split(',')
      .map((tag) => tag.trim().replace(/^#+/, ''))
      .filter(Boolean)
      .map((tag) => tag.slice(0, 24))
  )).slice(0, 8)
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'dashboard' | 'builder' | 'upgrade' | 'build_code' | 'settings' | 'admin'>('dashboard');
  const [builderStep, setBuilderStep] = useState<'standby' | 'quiz' | 'generating' | 'result'>('standby');
  const [builderDropdown, setBuilderDropdown] = useState<'platform' | 'model' | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [projectType, setProjectType] = useState('Fullstack Web App');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isAiChoice, setIsAiChoice] = useState(true);
  const [techStack, setTechStack] = useState({ frontend: 'Next.js', backend: 'Node.js/Express', database: 'PostgreSQL', deployment: 'Vercel' });
  const [modelSelection, setModelSelection] = useState('PRD Thinking'); // PRD Thinking | PRD Thinking Standard | PRD Thinking Max

  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string | string[]>>({});

  /* Dynamic quiz questions based on project context */
  const quizQuestions = useMemo(() => getQuizQuestions(projectType, projectDescription), [projectType, projectDescription]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [prdResult, setPrdResult] = useState('');
  const [currentBlueprintId, setCurrentBlueprintId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [viewingBlueprint, setViewingBlueprint] = useState<any>(null);
  const [blueprintVersions, setBlueprintVersions] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit PRD State
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  const [editedBlueprintContent, setEditedBlueprintContent] = useState('');
  const [editedBlueprintFolder, setEditedBlueprintFolder] = useState('');
  const [editedBlueprintTags, setEditedBlueprintTags] = useState('');
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  // Result Page Edit + Revision State
  const [isEditingPrd, setIsEditingPrd] = useState(false);
  const [editedPrdContent, setEditedPrdContent] = useState('');
  const [resultRevisionPrompt, setResultRevisionPrompt] = useState('');
  const [isResultRevising, setIsResultRevising] = useState(false);

  /* PRD Revision handler for the result page (uses prompt caching) */
  const handleResultRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultRevisionPrompt.trim() || isResultRevising) return;
    setIsResultRevising(true);

    try {
      /* Find the saved blueprint ID from the latest blueprints list */
      const blueprintId = currentBlueprintId;

      /* If no saved blueprint yet, save the current PRD first */
      if (!blueprintId) {
        /* Use the revision endpoint directly with a temporary save */
        throw new Error('PRD belum tersimpan. Silakan generate ulang.');
      }

      const res = await apiFetch('/api/revise-prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId,
          currentContent: prdResult,
          revisionPrompt: resultRevisionPrompt,
          modelSelection,
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPrdResult(data.blueprint.content);
        setResultRevisionPrompt('');
        if (data.model?.requested && data.model?.usedLabel && data.model.requested !== data.model.usedLabel) {
          setToast(`Model ${data.model.requested} belum tersedia, fallback ke ${data.model.usedLabel}.`);
        }
        fetchBlueprints();
      } else {
        setToast(data.error || 'Gagal merevisi PRD.');
      }
    } catch (error: any) {
      setToast(error.message || 'Terjadi kesalahan saat merevisi PRD.');
    } finally {
      setIsResultRevising(false);
    }
  };

  const openBlueprint = async (id: string) => {
    try {
      const res = await apiFetch(`/api/blueprints/${id}`);
      if (res.ok) {
        const data = await res.json();
        setViewingBlueprint(data);
        setEditedBlueprintContent(data.content);
        setEditedBlueprintFolder(data.folder || '');
        setEditedBlueprintTags(parseBlueprintTags(data).join(', '));
        setIsEditingBlueprint(false);
        setRevisionPrompt('');
        const versionsRes = await apiFetch(`/api/blueprints/${id}/versions`).catch(() => null);
        if (versionsRes?.ok) setBlueprintVersions(await versionsRes.json());
      }
    } catch (e) { console.error('Failed to open blueprint', e); }
  };

  const restoreBlueprintVersion = async (versionId: string) => {
    if (!viewingBlueprint) return;
    const res = await apiFetch(`/api/blueprints/${viewingBlueprint.id}/versions/${versionId}/restore`, { method: 'POST' });
    if (!res.ok) {
      setToast('Gagal restore versi.');
      return;
    }
    const updated = await res.json();
    setViewingBlueprint(updated);
    setEditedBlueprintContent(updated.content);
    setEditedBlueprintFolder(updated.folder || '');
    setEditedBlueprintTags(parseBlueprintTags(updated).join(', '));
    setToast('Versi blueprint berhasil direstore.');
    openBlueprint(updated.id);
    fetchBlueprints();
  };

  const deleteBlueprint = async (id: string) => {
    try {
      await apiFetch(`/api/blueprints/${id}`, { method: 'DELETE' });
      setDeletingId(null);
      fetchBlueprints();
    } catch (e) { console.error('Failed to delete blueprint', e); }
  };

  const saveEditedBlueprint = async () => {
    if (!viewingBlueprint) return;
    try {
      const res = await apiFetch(`/api/blueprints/${viewingBlueprint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedBlueprintContent })
      });
      if (res.ok) {
        const updated = await res.json();
        setViewingBlueprint(updated);
        setIsEditingBlueprint(false);
        const versionsRes = await apiFetch(`/api/blueprints/${updated.id}/versions`).catch(() => null);
        if (versionsRes?.ok) setBlueprintVersions(await versionsRes.json());
        fetchBlueprints(); // Refresh table preview if needed
      }
    } catch (e) { console.error('Failed to save blueprint', e); }
  };

  const saveBlueprintMetadata = async () => {
    if (!viewingBlueprint) return;
    const res = await apiFetch(`/api/blueprints/${viewingBlueprint.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: editedBlueprintFolder,
        tags: normalizeTagsInput(editedBlueprintTags),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(data.error || 'Gagal menyimpan metadata.');
      return;
    }
    setViewingBlueprint(data);
    setEditedBlueprintFolder(data.folder || '');
    setEditedBlueprintTags(parseBlueprintTags(data).join(', '));
    setToast('Metadata blueprint disimpan.');
    fetchBlueprints();
  };

  const handleReviseBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingBlueprint || !revisionPrompt.trim() || isRevising) return;

    setIsRevising(true);
    try {
      const res = await apiFetch('/api/revise-prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: viewingBlueprint.id,
          currentContent: editedBlueprintContent,
          revisionPrompt,
          modelSelection,
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setViewingBlueprint(data.blueprint);
        setEditedBlueprintContent(data.blueprint.content);
        setRevisionPrompt('');
        openBlueprint(data.blueprint.id);
        fetchBlueprints();
        if (data.model?.requested && data.model?.usedLabel && data.model.requested !== data.model.usedLabel) {
          setToast(`Model ${data.model.requested} belum tersedia, fallback ke ${data.model.usedLabel}.`);
        }
        const versionsRes = await apiFetch(`/api/blueprints/${data.blueprint.id}/versions`).catch(() => null);
        if (versionsRes?.ok) setBlueprintVersions(await versionsRes.json());
      } else {
        setToast(data.error || 'Gagal merevisi PRD.');
      }
    } catch (error) {
      console.error('Revision error:', error);
      setToast('Terjadi kesalahan saat merevisi PRD.');
    } finally {
      setIsRevising(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (builderStep === 'generating') {
      interval = setInterval(() => setLoadingStep((prev) => (prev + 1) % LOADING_SEQUENCE.length), 2000);
    }
    return () => clearInterval(interval);
  }, [builderStep]);

  const handleStackChange = (field: keyof typeof techStack, value: string) => setTechStack((prev) => ({ ...prev, [field]: value }));

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectDescription.trim()) return;
    setCurrentQuizIndex(0);
    setBuilderStep('quiz');
  };

  const handleQuizAnswer = (qId: number, answer: string, type: QuestionType) => {
    setQuizAnswers(prev => {
      if (type === 'single') {
        setTimeout(() => setCurrentQuizIndex(c => (c < quizQuestions.length - 1 ? c + 1 : c)), 250);
        return { ...prev, [qId]: answer };
      }
      if (type === 'multi') {
        const current = (prev[qId] as string[]) || [];
        if (current.includes(answer)) return { ...prev, [qId]: current.filter(a => a !== answer) };
        return { ...prev, [qId]: [...current, answer] };
      }
      return { ...prev, [qId]: answer };
    });
  };

  const nextSlide = () => setCurrentQuizIndex(c => (c < quizQuestions.length - 1 ? c + 1 : c));
  const prevSlide = () => setCurrentQuizIndex(c => (c > 0 ? c - 1 : c));

  const handleFinalSubmit = async () => {
    setBuilderStep('generating');
    setPrdResult('');
    setCurrentBlueprintId(null);
    setLoadingStep(0);

    let compiledDescription = projectDescription + "\n\nKonteks Kebutuhan Tambahan:\n";
    quizQuestions.forEach(q => {
      const ans = quizAnswers[q.id];
      if (ans) compiledDescription += `- ${q.title}: ${Array.isArray(ans) ? ans.join(', ') : ans}\n`;
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      // Premium PRD models need longer timeout (up to 5 min).
      const controller = new AbortController();
      const slowPrdModels = ['PRD Thinking Standard', 'PRD Thinking Max'];
      const timeoutMs = slowPrdModels.includes(modelSelection) ? 300000 : 120000;
      timeoutId = setTimeout(() => {
        controller.abort(new DOMException(`Request timeout setelah ${Math.round(timeoutMs / 1000)} detik. Server sedang sibuk, coba lagi.`, 'AbortError'));
      }, timeoutMs);

      const response = await apiFetch('/api/generate-prd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectType, projectName, projectDescription: compiledDescription, isAiChoice, techStack, modelSelection }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, `Server menolak request (${response.status}).`));
      }
      const data = await response.json();
      setPrdResult(data.markdown);
      setCurrentBlueprintId(data.blueprintId || null);
      setBuilderStep('result');
      if (data.model?.requested && data.model?.usedLabel && data.model.requested !== data.model.usedLabel) {
        setToast(`Model ${data.model.requested} belum tersedia, fallback ke ${data.model.usedLabel}.`);
      }

      // Update quota info from server response
      if (data.quota) {
        setUserProfile((prev: any) => prev ? { ...prev, quota: data.quota } : prev);
      }

      // Refresh blueprints list (PRD was auto-saved server-side)
      fetchBlueprints();

    } catch (error: any) {
      const title = error instanceof ApiConnectionError ? 'ERROR SYSTEM KONEKSI' : 'ERROR SYSTEM API';
      setPrdResult(`### ${title}\n\n${userFacingError(error, 'Gagal membuat PRD.')}`);
      setBuilderStep('result');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prdResult);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExportText = () => {
    const blob = new Blob([prdResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, '_') || 'Arsitektur'}_Blueprint.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const saveEditedPrdResult = async () => {
    if (!currentBlueprintId) {
      setToast('Blueprint belum tersimpan. Silakan generate ulang.');
      return;
    }
    try {
      const res = await apiFetch(`/api/blueprints/${currentBlueprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedPrdContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan edit PRD.');
      setPrdResult(data.content);
      setIsEditingPrd(false);
      fetchBlueprints();
    } catch (error: any) {
      setToast(error.message || 'Gagal menyimpan edit PRD.');
    }
  };

  /* ====================== RENDERERS ====================== */

  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch fresh user profile from server (not stale localStorage)
  const fetchUserProfile = async () => {
    try {
      const res = await apiFetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
        // Also update localStorage for components that still read from it
        localStorage.setItem('user', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      // Fallback to localStorage if server unreachable
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUserProfile(JSON.parse(storedUser));
      } catch(e) {}
    }
  };

  // Fetch blueprints from API
  const fetchBlueprints = async () => {
    try {
      const res = await apiFetch('/api/blueprints');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBlueprints(data);
      }
    } catch (error) {
      console.error('Failed to fetch blueprints', error);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchBlueprints();
    fetchAnalytics();
    fetchTemplates();
  }, []);

  /* ═══════════ ANALYTICS ═══════════ */
  const [analyticsData, setAnalyticsData] = useState<{ chartData: any[], totals: { prd: number, code: number, revise: number } }>({ chartData: [], totals: { prd: 0, code: 0, revise: 0 } });
  const fetchAnalytics = async () => {
    try {
      const res = await apiFetch('/api/analytics');
      if (res.ok) setAnalyticsData(await res.json());
    } catch (e) { /* silent */ }
  };

  /* ═══════════ TEMPLATES ═══════════ */
  const [templates, setTemplates] = useState<any[]>([]);
  const fetchTemplates = async () => {
    try {
      const res = await apiFetch('/api/templates');
      if (res.ok) setTemplates(await res.json());
    } catch (e) { /* silent */ }
  };

  /* ═══════════ ADMIN OPS ═══════════ */
  const [adminOverview, setAdminOverview] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersTotal, setAdminUsersTotal] = useState(0);
  const [adminUsersPage, setAdminUsersPage] = useState(1);
  const [adminUsersTotalPages, setAdminUsersTotalPages] = useState(1);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminRoleFilter, setAdminRoleFilter] = useState('ALL');
  const [adminPlanFilter, setAdminPlanFilter] = useState('ALL');
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [adminAiRequests, setAdminAiRequests] = useState<any[]>([]);

  const fetchAdminData = async () => {
    if (userProfile?.role !== 'ADMIN') return;
    const userParams = new URLSearchParams({
      page: String(adminUsersPage),
      limit: '25',
    });
    if (adminSearch.trim()) userParams.set('search', adminSearch.trim());
    if (adminRoleFilter !== 'ALL') userParams.set('role', adminRoleFilter);
    if (adminPlanFilter !== 'ALL') userParams.set('planType', adminPlanFilter);

    const [overviewRes, usersRes, auditRes, aiRes] = await Promise.all([
      apiFetch('/api/admin/overview').catch(() => null),
      apiFetch(`/api/admin/users?${userParams}`).catch(() => null),
      apiFetch('/api/admin/audit-logs').catch(() => null),
      apiFetch('/api/admin/ai-requests').catch(() => null),
    ]);
    if (overviewRes?.ok) setAdminOverview(await overviewRes.json());
    if (usersRes?.ok) {
      const data = await usersRes.json();
      if (Array.isArray(data)) {
        setAdminUsers(data);
        setAdminUsersTotal(data.length);
        setAdminUsersTotalPages(1);
      } else {
        setAdminUsers(Array.isArray(data.items) ? data.items : []);
        setAdminUsersTotal(Number(data.total || 0));
        setAdminUsersTotalPages(Number(data.totalPages || 1));
      }
    }
    if (auditRes?.ok) setAdminAuditLogs(await auditRes.json());
    if (aiRes?.ok) setAdminAiRequests(await aiRes.json());
  };

  useEffect(() => {
    if (activeView === 'admin') fetchAdminData();
  }, [activeView, userProfile?.role, adminUsersPage, adminRoleFilter, adminPlanFilter, adminSearch]);

  const updateAdminRole = async (id: string, role: string) => {
    if (!window.confirm(`Ubah role user ini menjadi ${role}?`)) return;
    const res = await apiFetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setToast(data.error || 'Gagal update role.');
      return;
    }
    setToast('Role user diperbarui.');
    fetchAdminData();
  };

  const updateAdminPlan = async (id: string, planType: string) => {
    if (!window.confirm(`Ubah plan user ini menjadi ${planType}? Quota hari ini akan direset.`)) return;
    const res = await apiFetch(`/api/admin/users/${id}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planType }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(data.error || 'Gagal update plan.');
      return;
    }
    setToast(`Plan user diubah ke ${data.planType}.`);
    fetchAdminData();
    fetchUserProfile();
  };

  const resetAdminQuota = async (id: string) => {
    if (!window.confirm('Reset quota user ini sekarang?')) return;
    const res = await apiFetch(`/api/admin/users/${id}/reset-quota`, { method: 'POST' });
    if (!res.ok) {
      setToast('Gagal reset quota user.');
      return;
    }
    setToast('Quota user direset.');
    fetchAdminData();
  };

  const applyTemplate = (tpl: any) => {
    if (builderStep === 'generating') {
      setActiveView('builder');
      setToast('Build Project masih berjalan. Tunggu selesai sebelum memakai template lain.');
      return;
    }
    setProjectName(tpl.name);
    setProjectType(tpl.type);
    setProjectDescription(tpl.description);
    setActiveView('builder');
    setBuilderStep('standby');
    setToast(`Template "${tpl.name}" diterapkan!`);
  };

  /* ═══════════ TOAST NOTIFICATION ═══════════ */
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const requestManualUpgrade = (plan: 'PRO' | 'PRO_MAX') => {
    const label = plan === 'PRO_MAX' ? 'PRD Pro Max' : 'PRD Pro';
    setToast(`Billing otomatis belum aktif. Minta admin mengubah plan ke ${label} dari Admin Ops.`);
  };

  /* ═══════════ SHARE PRD ═══════════ */
  const handleShareBlueprint = async (id: string) => {
    try {
      const res = await apiFetch(`/api/blueprints/${id}/share`, { method: 'POST' });
      const data = await res.json();
      if (data.isPublic && data.shareToken) {
        const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
        navigator.clipboard.writeText(shareUrl);
        setToast('Link share disalin ke clipboard!');
      } else {
        setToast('Share dinonaktifkan.');
      }
      fetchBlueprints();
    } catch (e) { setToast('Gagal toggle share.'); }
  };

  const duplicateBlueprint = async (id: string) => {
    const res = await apiFetch(`/api/blueprints/${id}/duplicate`, { method: 'POST' });
    if (!res.ok) {
      setToast('Gagal duplikasi blueprint.');
      return;
    }
    setToast('Blueprint berhasil diduplikasi.');
    fetchBlueprints();
  };

  const downloadBlueprint = async (id: string, name: string, format: 'md' | 'json' | 'html' = 'md') => {
    const res = await apiFetch(`/api/blueprints/${id}/export?format=${format}`);
    if (!res.ok) {
      setToast('Gagal export blueprint.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9_-]+/gi, '_') || 'blueprint'}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allBlueprints = blueprints.map(b => ({
     id: b.id,
     realId: b.id as string,
     name: b.name,
     type: b.type,
     time: new Date(b.createdAt).toLocaleDateString(),
     folder: b.folder || '',
     tags: parseBlueprintTags(b),
     version: Number(b.currentVersion || 1),
  }));

  const availableFolders = Array.from(new Set(allBlueprints.map((b) => b.folder).filter(Boolean))).sort();
  const availableTags = Array.from(new Set(allBlueprints.flatMap((b) => b.tags))).sort();

  const displayBlueprints = allBlueprints.filter((b) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || [b.name, b.type, b.folder, ...b.tags].some((value) => value.toLowerCase().includes(query));
    const matchesFolder = folderFilter === 'all' || b.folder === folderFilter;
    const matchesTag = tagFilter === 'all' || b.tags.includes(tagFilter);
    return matchesQuery && matchesFolder && matchesTag;
  });
  const hasBlueprintFilters = Boolean(searchQuery.trim()) || folderFilter !== 'all' || tagFilter !== 'all';

  const getPlanInfo = () => {
     const plan = userProfile?.plan;
     if (!plan) return 'PRD Pro';
     if (plan === 'PRO') return 'PRD Pro';
     if (plan === 'PRO_MAX') return 'PRD Pro Max';
     if (plan === 'FREE') return 'PRD Free';
     return plan;
  };

  const getQuotaInfo = () => {
     if (userProfile?.quota && typeof userProfile.quota === 'object') {
       const codeRemaining = userProfile?.codeQuota?.remaining || 0;
       const codeLimit = userProfile?.codeQuota?.limit || 0;
       return `(Sisa ${userProfile.quota.remaining}/${userProfile.quota.limit} PRD, ${codeRemaining}/${codeLimit} Code)`;
     }
     return '(Memuat kuota...)';
  };

  const renderAdmin = () => (
    <div className="p-8 lg:p-14 text-white max-w-7xl w-full">
      <div className="mb-10 border-b border-white/5 pb-8">
        <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2">Admin Ops</h1>
        <p className="text-gray-400 text-lg font-medium">Pantau user, quota, audit log, dan request AI tanpa modul billing.</p>
      </div>

      {userProfile?.role !== 'ADMIN' ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-100 font-bold">
          Akses admin hanya tersedia untuk role ADMIN.
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              ['Users', adminOverview?.users ?? 0],
              ['Blueprints', adminOverview?.blueprints ?? 0],
              ['Usage Hari Ini', adminOverview?.usageToday ?? 0],
              ['Code Projects', adminOverview?.codeProjects ?? 0],
              ['AI Failed 7D', adminOverview?.failedAiLast7Days ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-3xl border border-white/5 bg-[#111] p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{label}</div>
                <div className="text-3xl font-black">{String(value)}</div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/5 bg-[#111] overflow-hidden">
            <div className="p-6 border-b border-white/5 space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold">User Management</h2>
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-1">{adminUsersTotal} user ditemukan</div>
                </div>
                <button onClick={fetchAdminData} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-bold">Refresh</button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_auto]">
                <input
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setAdminUsersPage(1);
                      fetchAdminData();
                    }
                  }}
                  placeholder="Cari nama atau email user..."
                  className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-white/25"
                />
                <select
                  value={adminRoleFilter}
                  onChange={(e) => { setAdminRoleFilter(e.target.value); setAdminUsersPage(1); }}
                  className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-gray-200 outline-none focus:border-white/25"
                >
                  <option value="ALL">Semua Role</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="USER">USER</option>
                </select>
                <select
                  value={adminPlanFilter}
                  onChange={(e) => { setAdminPlanFilter(e.target.value); setAdminUsersPage(1); }}
                  className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-gray-200 outline-none focus:border-white/25"
                >
                  <option value="ALL">Semua Plan</option>
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="PRO_MAX">PRO_MAX</option>
                </select>
                <button
                  onClick={() => { setAdminUsersPage(1); fetchAdminData(); }}
                  className="px-5 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-gray-200"
                >
                  Cari
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 uppercase text-[10px] tracking-widest">
                  <tr className="border-b border-white/5">
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">Role</th>
                    <th className="text-left p-4">Plan</th>
                    <th className="text-left p-4">Quota</th>
                    <th className="text-left p-4">Blueprint</th>
                    <th className="text-right p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="p-4">
                        <div className="font-bold text-white">{user.name || '-'}</div>
                        <div className="text-gray-500 text-xs">{user.email}</div>
                      </td>
                      <td className="p-4 font-bold">{user.role}</td>
                      <td className="p-4">
                        <select
                          value={user.planType || 'FREE'}
                          onChange={(e) => updateAdminPlan(user.id, e.target.value)}
                          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-200 outline-none hover:bg-white/10 focus:border-white/25"
                        >
                          <option value="FREE">FREE</option>
                          <option value="PRO">PRO</option>
                          <option value="PRO_MAX">PRO_MAX</option>
                        </select>
                      </td>
                      <td className="p-4 text-gray-400">PRD {user.quotaUsedToday || 0} / Code {user.codeQuotaUsedToday || 0}</td>
                      <td className="p-4 text-gray-400">{user.blueprintCount || 0}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => resetAdminQuota(user.id)} className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold">Reset Quota</button>
                          <button onClick={() => updateAdminRole(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN')} className="px-3 py-2 rounded-full bg-white text-black hover:bg-gray-200 text-xs font-bold">
                            {user.role === 'ADMIN' ? 'Make User' : 'Make Admin'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {adminUsers.length === 0 && (
                    <tr><td className="p-6 text-gray-500 font-bold" colSpan={6}>Belum ada data user.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-white/5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-gray-400">
              <div className="font-bold">Halaman {adminUsersPage} dari {adminUsersTotalPages}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAdminUsersPage((page) => Math.max(1, page - 1))}
                  disabled={adminUsersPage <= 1}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10 font-bold"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setAdminUsersPage((page) => Math.min(adminUsersTotalPages, page + 1))}
                  disabled={adminUsersPage >= adminUsersTotalPages}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10 font-bold"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/5 bg-[#111] overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-lg font-extrabold">Audit Log</h2>
              </div>
              <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {adminAuditLogs.slice(0, 40).map((log) => (
                  <div key={log.id} className="p-4">
                    <div className="font-bold text-sm">{log.action}</div>
                    <div className="text-xs text-gray-500 mt-1">{log.email || 'system'} - {new Date(log.createdAt).toLocaleString()}</div>
                    <div className="text-xs text-gray-600 mt-1">{log.targetType || '-'} {log.targetId || ''}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#111] overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-lg font-extrabold">AI Request Log</h2>
              </div>
              <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {adminAiRequests.slice(0, 40).map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-bold text-sm">{item.type} <span className={item.status === 'FAILED' ? 'text-red-400' : 'text-emerald-400'}>{item.status}</span></div>
                      <div className="text-xs text-gray-500">{item.durationMs || 0}ms</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{item.email || 'unknown'} - {item.model || item.provider || '-'}</div>
                    {item.error && <div className="text-xs text-red-300 mt-2 line-clamp-2">{item.error}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDashboardHome = () => (
    <div className="p-8 lg:p-14 text-white max-w-7xl w-full flex-1 flex flex-col">
       <div className="mb-12 border-b border-white/5 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 shrink-0">
          <div>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2">Dashboard Proyek Saya</h1>
            <p className="text-gray-400 text-lg font-medium">Kelola rencana dan struktur aplikasi Anda dengan mudah di sini.</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full xl:w-auto">
            <div className="relative flex-1 min-w-[240px] xl:w-72">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Temukan nama proyek..." className="bg-[#111111] border border-white/5 rounded-full pl-12 pr-6 py-4 text-sm font-medium w-full focus:outline-none focus:border-white/20 transition-colors text-white" />
            </div>
            <div className="relative min-w-[170px]">
              <Folder className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} className="appearance-none w-full bg-[#111111] border border-white/5 rounded-full pl-11 pr-8 py-4 text-sm font-bold text-gray-300 focus:outline-none focus:border-white/20">
                <option value="all">Semua folder</option>
                {availableFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
              </select>
            </div>
            <div className="relative min-w-[160px]">
              <Tag className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="appearance-none w-full bg-[#111111] border border-white/5 rounded-full pl-11 pr-8 py-4 text-sm font-bold text-gray-300 focus:outline-none focus:border-white/20">
                <option value="all">Semua tag</option>
                {availableTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}
              </select>
            </div>
          </div>
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 shrink-0 pb-12">

          {/* Status Akun */}
          <div className="xl:col-span-4 p-8 lg:p-10 rounded-[32px] md:rounded-[40px] bg-[#111111] border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between relative overflow-hidden shadow-xl h-full">
             <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 blur-[50px] rounded-full pointer-events-none" />
             <div className="flex justify-between items-center mb-6 relative z-10 w-full">
                <div className="text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Status Akun Aktif {userProfile?.name ? `- ${userProfile.name}` : ''}</div>
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[10px] md:text-[12px] uppercase tracking-widest border border-white/20">
                  <Activity className="w-3.5 h-3.5 mr-2" /> {getPlanInfo()}
                </div>
             </div>
             <div className="relative z-10 mt-auto pt-8">
                <div className="text-4xl md:text-5xl font-extrabold text-white mb-3">{userProfile?.plan === 'PRO_MAX' ? 'Rp75.000' : userProfile?.plan === 'PRO' ? 'Rp20.000' : 'Rp0'} <span className="text-xl md:text-2xl text-gray-500 font-medium">/bln</span></div>
                <div className="text-xs md:text-sm font-medium text-gray-400 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white text-black animate-pulse"></div> Modul AI Premium aktif {getQuotaInfo()}
                </div>
             </div>
          </div>

          {/* Telemetry Stream Chart */}
          <div className="xl:col-span-8 p-8 lg:p-10 rounded-3xl bg-[#0A0A0A] border border-white/10 flex flex-col h-full">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 relative z-10 gap-6 shrink-0">
               <div className="shrink-0">
                 <div className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2">Aktivitas Penggunaan</div>
                 <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                   <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl shrink-0">
                     <Activity className="w-5 h-5 text-gray-300" />
                   </div>
                   <span className="truncate">Statistik Pembuatan</span>
                 </h3>
               </div>
               <div className="flex gap-5 md:gap-7 px-5 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl shrink-0 overflow-x-auto custom-scrollbar">
                 <div className="flex items-center gap-2.5 shrink-0">
                   <span className="w-6 h-[3px] rounded-full bg-white shrink-0" />
                   <div>
                     <div className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">PRD</div>
                     <div className="text-xs md:text-sm font-bold text-white">{analyticsData.totals.prd}</div>
                   </div>
                 </div>
                 <div className="w-px bg-white/10 shrink-0"></div>
                 <div className="flex items-center gap-2.5 shrink-0">
                   <span className="w-6 h-[3px] rounded-full bg-gray-500 shrink-0" />
                   <div>
                     <div className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Code</div>
                     <div className="text-xs md:text-sm font-bold text-white">{analyticsData.totals.code}</div>
                   </div>
                 </div>
                 <div className="w-px bg-white/10 shrink-0"></div>
                 <div className="flex items-center gap-2.5 shrink-0">
                   <span className="w-6 shrink-0 border-t-2 border-dashed border-gray-600" />
                   <div>
                     <div className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Revisi</div>
                     <div className="text-xs md:text-sm font-bold text-white">{analyticsData.totals.revise}</div>
                   </div>
                 </div>
               </div>
            </div>

            <div className="min-h-[250px] md:min-h-[280px] w-full relative z-10 flex-1 pt-4">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={analyticsData.chartData.length > 0 ? analyticsData.chartData : [
                    { date: 'Belum ada', prd: 0, code: 0, revise: 0 }
                 ]} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="fillPrd" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#ffffff" stopOpacity={0.18}/>
                       <stop offset="100%" stopColor="#ffffff" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="fillCode" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.12}/>
                       <stop offset="100%" stopColor="#9ca3af" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
                   <XAxis dataKey="date" stroke="rgba(255,255,255,0.25)" fontSize={11} fontWeight={600} tickMargin={12} axisLine={false} tickLine={false} />
                   <YAxis stroke="rgba(255,255,255,0.25)" fontSize={11} fontWeight={600} axisLine={false} tickLine={false} allowDecimals={false} />
                   <RechartsTooltip
                     contentStyle={{ backgroundColor: '#0E0E0E', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}
                     itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}
                     labelStyle={{ color: '#888', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}
                     cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
                   />
                   <Area type="monotone" dataKey="prd" name="PRD" stroke="#ffffff" strokeWidth={2.5} fillOpacity={1} fill="url(#fillPrd)" dot={false} activeDot={{ r: 4, fill: '#fff', stroke: '#000', strokeWidth: 2 }} />
                   <Area type="monotone" dataKey="code" name="Code" stroke="#9ca3af" strokeWidth={2.5} fillOpacity={1} fill="url(#fillCode)" dot={false} activeDot={{ r: 4, fill: '#9ca3af', stroke: '#000', strokeWidth: 2 }} />
                   <Area type="monotone" dataKey="revise" name="Revisi" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 4" fill="none" dot={false} activeDot={{ r: 4, fill: '#6b7280', stroke: '#000', strokeWidth: 2 }} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>

            {/* Project Entities Table */}
          <div className="xl:col-span-12 bg-[#111111] rounded-[32px] md:rounded-[40px] border border-white/5 flex flex-col shadow-2xl relative overflow-hidden">
             <div className="grid grid-cols-12 px-6 md:px-10 py-5 border-b border-white/5 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest bg-black/20">
               <div className="col-span-1">No</div>
               <div className="col-span-5 md:col-span-4">Nama Proyek</div>
               <div className="col-span-3 md:col-span-3 text-right md:text-left">Tipe Aplikasi</div>
               <div className="hidden md:block col-span-2 text-right">Dibuat Pada</div>
               <div className="col-span-3 md:col-span-2 text-right">Aksi</div>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[200px]">
               {displayBlueprints.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full py-16 text-gray-500">
                   <Search className="w-8 h-8 mb-4 opacity-50" />
                   <p className="text-sm font-medium">
                     {blueprints.length === 0
                       ? 'Belum ada blueprint tersimpan. Mulai dari Build PRD untuk membuat proyek pertama.'
                       : hasBlueprintFilters
                         ? 'Tidak ada proyek yang cocok dengan filter.'
                         : 'Tidak ada proyek yang ditemukan.'}
                   </p>
                 </div>
               ) : displayBlueprints.map((item, i) => (
                 <div key={item.id} className="grid grid-cols-12 px-6 md:px-10 py-4 md:py-5 border-b border-white/5 items-center hover:bg-white/5 transition-colors group">
                   <div className="col-span-1 text-gray-500 font-bold text-sm">{i+1}</div>
                   <div onClick={() => item.realId && openBlueprint(item.realId)} className="col-span-5 md:col-span-4 pr-4 cursor-pointer min-w-0">
                     <div className="font-bold text-sm md:text-lg text-gray-200 group-hover:text-white transition-colors flex items-center gap-2 min-w-0">
                       <span className="truncate">{item.name}</span>
                       {item.realId && <Eye className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" />}
                       {item.version > 1 && <span className="hidden md:inline-flex text-[10px] font-black text-gray-500 border border-white/10 rounded-full px-2 py-0.5">v{item.version}</span>}
                     </div>
                     <div className="mt-2 hidden md:flex flex-wrap gap-1.5">
                       {item.folder && (
                         <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/5 px-2.5 py-1 text-[10px] font-bold text-gray-500">
                           <Folder className="w-3 h-3" /> {item.folder}
                         </span>
                       )}
                       {item.tags.slice(0, 3).map((tag) => (
                         <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-black/40 border border-white/5 px-2.5 py-1 text-[10px] font-bold text-gray-500">
                           <Tag className="w-3 h-3" /> {tag}
                         </span>
                       ))}
                     </div>
                   </div>
                   <div className="col-span-3 md:col-span-3 text-xs md:text-sm font-medium text-gray-400 text-right md:text-left">
                     <span className="px-3 md:px-5 py-1.5 md:py-2.5 bg-black/40 rounded-full border border-white/5 inline-block text-center">{item.type}</span>
                   </div>
                   <div className="hidden md:block col-span-2 text-sm font-medium text-gray-500 text-right">{item.time}</div>
                   <div className="col-span-3 md:col-span-2 text-right">
                     {deletingId === item.realId ? (
                         <div className="flex items-center justify-end gap-2">
                           <button onClick={() => deleteBlueprint(item.realId!)} className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 hover:bg-red-500/30 transition-colors">Hapus</button>
                           <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 rounded-full bg-white/5 text-gray-400 text-xs font-bold border border-white/10 hover:bg-white/10 transition-colors">Batal</button>
                         </div>
                       ) : (
                         <div className="flex items-center justify-end gap-1">
                           <button onClick={() => handleShareBlueprint(item.realId!)} className="p-2 rounded-xl hover:bg-white/10 text-gray-600 hover:text-white transition-all" title="Share">
                             <ArrowRight className="w-4 h-4" />
                           </button>
                           <button onClick={() => duplicateBlueprint(item.realId!)} className="p-2 rounded-xl hover:bg-white/10 text-gray-600 hover:text-white transition-all" title="Duplikasi">
                             <Copy className="w-4 h-4" />
                           </button>
                           <button onClick={() => downloadBlueprint(item.realId!, item.name, 'md')} className="p-2 rounded-xl hover:bg-white/10 text-gray-600 hover:text-white transition-all" title="Export MD">
                             <Download className="w-4 h-4" />
                           </button>
                           <button onClick={() => setDeletingId(item.realId!)} className="p-2 rounded-xl hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all" title="Hapus">
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       )}
                   </div>
                 </div>
               ))}
             </div>
          </div>

       </div>

       {/* TEMPLATE LIBRARY */}
       {templates.length > 0 && (
         <div className="mt-8 shrink-0">
           <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-3">
             <Layers className="w-5 h-5 text-gray-400" /> Template PRD Siap Pakai
           </h3>
           <p className="text-sm text-gray-500 mb-6 ml-8">Pilih kerangka siap pakai untuk mempercepat pembuatan.</p>
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
             {templates.map(tpl => {
               const Icon = TEMPLATE_ICONS[tpl.id] || FileText;
               return (
               <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                 className="relative p-5 rounded-2xl bg-[#0E0E0E] border border-white/10 hover:border-white/25 hover:bg-white/[0.03] text-left transition-colors group flex flex-col gap-3">
                 <div className="flex items-start justify-between">
                   <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:border-white transition-colors">
                     <Icon className="w-5 h-5 text-gray-300 group-hover:text-black transition-colors" />
                   </div>
                   <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white -translate-x-1 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all" />
                 </div>
                 <div>
                   <div className="font-semibold text-white text-[15px] mb-1.5">{tpl.name}</div>
                   <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{tpl.description}</p>
                 </div>
                 <div className="mt-auto pt-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider border-t border-white/5 pt-3">{tpl.type}</div>
               </button>
             );})}
           </div>
         </div>
       )}
    </div>
  );



  const renderBuilder = () => (
    <div className="h-full w-full bg-[#000000] flex flex-col" onClick={() => { if (builderDropdown) setBuilderDropdown(null); }}>
      {/* ═══════════ STANDBY: COMPOSER CHAT DI TENGAH (gaya BuildCode) ═══════════ */}
      {builderStep === 'standby' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-6 overflow-hidden">
          {/* Background grid monokrom */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, #000 35%, transparent 100%)' }} />

          <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-8">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center text-center gap-4">
              <h1 className="text-4xl md:text-[3rem] leading-[1.1] font-bold tracking-tight text-white">
                Rancang aplikasi Anda
              </h1>
              <p className="text-gray-400 text-base md:text-lg max-w-md font-normal leading-relaxed">
                Ceritakan ide Anda, AI akan menyusun PRD lengkap: arsitektur, diagram, dan rencana teknis.
              </p>
            </motion.div>

            <motion.form
              onSubmit={handleSetupSubmit}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full bg-[#0E0E0E] border border-white/10 rounded-[24px] shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)] focus-within:border-white/25 transition-colors"
            >
              {/* Nama aplikasi */}
              <input
                type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                placeholder="Nama aplikasi (mis. JajanWarung)"
                className="w-full bg-transparent text-white text-[15px] font-semibold outline-none px-5 pt-5 pb-2 placeholder-gray-600"
              />
              {/* Deskripsi */}
              <textarea
                value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSetupSubmit(e as any); } }}
                placeholder="Ceritakan ide aplikasi Anda — fitur utama, target pengguna, tujuan platform..."
                className="w-full max-h-56 min-h-[120px] bg-transparent text-white text-[15px] resize-none outline-none px-5 pb-4 placeholder-gray-600 font-normal leading-relaxed"
              />

              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 p-3 border-t border-white/[0.06] bg-white/[0.015] rounded-b-[24px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Platform dropdown */}
                  <div className="relative">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setBuilderDropdown(builderDropdown === 'platform' ? null : 'platform'); }} className={`flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-lg text-[12px] font-medium transition-colors border ${builderDropdown === 'platform' ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
                      <Code2 className="w-3.5 h-3.5" /> {projectType} <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${builderDropdown === 'platform' ? 'rotate-90' : '-rotate-90'}`} />
                    </button>
                    <AnimatePresence>
                      {builderDropdown === 'platform' && (
                        <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.12 }} className="absolute bottom-full left-0 mb-2 w-56 bg-[#0E0E0E] border border-white/10 rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.7)] p-1 z-50">
                          {['Fullstack Web App', 'Android', 'Website'].map(opt => (
                            <button key={opt} type="button" onClick={(e) => { e.stopPropagation(); setProjectType(opt); setBuilderDropdown(null); }} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium flex items-center justify-between transition-colors ${projectType === opt ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'}`}>
                              {opt}{projectType === opt && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Model dropdown */}
                  <div className="relative">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setBuilderDropdown(builderDropdown === 'model' ? null : 'model'); }} className={`flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-lg text-[12px] font-medium transition-colors border ${builderDropdown === 'model' ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
                      <Bot className="w-3.5 h-3.5" /> {modelSelection} <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${builderDropdown === 'model' ? 'rotate-90' : '-rotate-90'}`} />
                    </button>
                    <AnimatePresence>
                      {builderDropdown === 'model' && (
                        <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.12 }} className="absolute bottom-full left-0 mb-2 w-56 bg-[#0E0E0E] border border-white/10 rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.7)] p-1 z-50">
                          {[
                            { name: 'PRD Thinking', fallback: false, badge: 'Gemini Flash' },
                            { name: 'PRD Thinking Standard', fallback: true, badge: 'GPT-5.5' },
                            { name: 'PRD Thinking Max', fallback: true, badge: 'Claude' },
                          ].map(opt => (
                            <button key={opt.name} type="button" onClick={(e) => { e.stopPropagation(); setModelSelection(opt.name); setBuilderDropdown(null); }} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium flex items-center justify-between gap-3 transition-colors ${modelSelection === opt.name ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'}`}>
                              <span>{opt.name}</span>
                              {modelSelection === opt.name
                                ? <Check className="w-3.5 h-3.5" />
                                : <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wider">{opt.badge}</span>}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Tech toggle */}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setIsAiChoice(!isAiChoice); }} className="flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-lg text-[12px] font-medium border bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors">
                    <Settings className="w-3.5 h-3.5" /> {isAiChoice ? 'Tech: Otomatis AI' : 'Tech: Manual'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!projectName.trim() || !projectDescription.trim()}
                  className={`shrink-0 px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 font-semibold text-sm ${
                    projectName.trim() && projectDescription.trim() ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'
                  }`}
                >
                  Lanjut <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.form>

            {/* Tech manual (muncul saat dipilih) */}
            <AnimatePresence>
              {!isAiChoice && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {([['Frontend','frontend',['React / Vite','Next.js','Vue.js / Nuxt','SvelteKit','Native (Android/iOS)']],['Backend','backend',['Node.js/Express','Python/Django','Go / Fiber','PHP / Laravel','Serverless (Edge)']],['Database','database',['PostgreSQL','MySQL','MongoDB','Redis','Firebase / Supabase']],['Deploy','deployment',['Vercel','AWS / EC2','DigitalOcean (VPS)','Railway / Render','Cloudflare Pages']]] as const).map(([label, key, opts]) => (
                      <div key={key}>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">{label}</label>
                        <select value={(techStack as any)[key]} onChange={(e) => handleStackChange(key as any, e.target.value)} className="w-full bg-[#0E0E0E] border border-white/10 rounded-lg p-2.5 text-[12px] text-white focus:outline-none focus:border-white/25 appearance-none font-medium">
                          {opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick start chips */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: 'Aplikasi kasir UMKM', name: 'POS UMKM', desc: 'Aplikasi kasir untuk UMKM: katalog produk, transaksi, struk, dan laporan penjualan harian.' },
                { label: 'Marketplace jasa', name: 'JasaKu', desc: 'Marketplace penyedia jasa: pencarian, booking, chat, pembayaran, dan ulasan.' },
                { label: 'Aplikasi keuangan', name: 'DompetKu', desc: 'Aplikasi pencatat keuangan pribadi: pemasukan, pengeluaran, anggaran, dan laporan.' },
              ].map(s => (
                <button key={s.label} type="button" onClick={(e) => { e.stopPropagation(); setProjectName(s.name); setProjectDescription(s.desc); }} className="px-3.5 py-2 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 text-[12.5px] font-medium text-gray-300 hover:text-white transition-colors">
                  {s.label}
                </button>
              ))}
            </motion.div>
          </div>
        </div>
      )}

      {/* ═══════════ QUIZ / GENERATING / RESULT (full width) ═══════════ */}
      {builderStep !== 'standby' && (
      <div className="flex-1 h-full bg-[#000000] relative z-10 overflow-hidden flex flex-col justify-center">

         <AnimatePresence mode="wait">

           {builderStep === 'quiz' && (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full h-full max-w-4xl mx-auto flex flex-col pb-20 justify-center px-10">
               <div className="mb-14">
                 <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 text-gray-300 font-bold text-xs uppercase tracking-widest mb-6 border border-white/10">
                   Fase Integrasi Ke {currentQuizIndex + 1}/{quizQuestions.length}
                 </div>
                 <h2 className="text-4xl lg:text-[44px] font-extrabold tracking-tight text-white leading-tight mb-4">
                   {quizQuestions[currentQuizIndex].title}
                 </h2>
                 {quizQuestions[currentQuizIndex].type === 'multi' && <p className="text-gray-500 font-medium text-lg">Pilihan ganda diizinkan.</p>}
               </div>

               <div className="mb-16 min-h-[140px]">
                 {quizQuestions[currentQuizIndex].type === 'input' ? (
                   <textarea rows={3} value={(quizAnswers[quizQuestions[currentQuizIndex].id] as string)||''} onChange={(e)=>handleQuizAnswer(quizQuestions[currentQuizIndex].id, e.target.value, 'input')}
                     className="w-full bg-[#111111] border-2 border-white/5 rounded-3xl p-6 text-xl text-white focus:outline-none focus:border-white/20 transition-colors resize-none"
                     placeholder="Tulis pemikiranmu secara leluasa..."
                   />
                 ) : (
                   <div className="flex flex-wrap gap-3">
                     {quizQuestions[currentQuizIndex].options?.map(opt => {
                       const isSel = quizQuestions[currentQuizIndex].type === 'single' ? quizAnswers[quizQuestions[currentQuizIndex].id] === opt : ((quizAnswers[quizQuestions[currentQuizIndex].id] as string[]) || []).includes(opt);
                       return (
                         <button key={opt} onClick={() => handleQuizAnswer(quizQuestions[currentQuizIndex].id, opt, quizQuestions[currentQuizIndex].type)}
                           className={`px-6 py-4 rounded-2xl border border-white/5 font-bold text-sm md:text-base transition-all shadow-sm ${isSel ? 'bg-white text-black border-white/20 scale-[1.02]' : 'bg-[#111111] text-gray-400 hover:bg-white/10 hover:text-white'}`}
                         >
                           {opt}
                         </button>
                       )
                     })}
                   </div>
                 )}
               </div>

               <div className="flex items-center gap-6">
                 {currentQuizIndex === quizQuestions.length - 1 ? (
                   <button onClick={handleFinalSubmit} className="px-10 py-5 rounded-full bg-white text-black font-extrabold hover:shadow-[0_8px_30px_rgba(255,255,255,0.2)] transition-all flex items-center gap-2">
                     Eksekusi Sistem <Play className="w-5 h-5 fill-current ml-2" />
                   </button>
                 ) : (
                   <button onClick={nextSlide} className="px-10 py-5 rounded-full bg-white text-black font-extrabold hover:scale-105 transition-all outline-none">
                     Lanjut Tahap
                   </button>
                 )}
                 <button onClick={prevSlide} disabled={currentQuizIndex===0} className="px-8 py-5 rounded-full text-gray-500 font-bold hover:bg-white/5 transition-colors disabled:opacity-0">Kembali</button>
               </div>
             </motion.div>
           )}

           {builderStep === 'generating' && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-10 w-full max-w-lg mx-auto text-center">
                <div className="w-24 h-24 relative mb-12 flex items-center justify-center">
                   <motion.div className="absolute inset-0 rounded-full border-4 border-white/20 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                   <Layers className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-white mb-3">{modelSelection === 'PRD Thinking Max' ? 'Deep Thinking Mode...' : modelSelection === 'PRD Thinking Standard' ? 'Advanced Analysis...' : 'Membangun Fondasi...'}</h3>
                <p className="text-gray-500 text-sm font-medium mb-6">{modelSelection === 'PRD Thinking Max' ? 'Claude Sonnet sedang menganalisis secara mendalam.' : modelSelection === 'PRD Thinking Standard' ? 'GPT-5.5 sedang menganalisis secara mendalam.' : 'Gemini Flash sedang memproses permintaan Anda.'}</p>
                <div className="w-full h-2 rounded-full border border-white/10 bg-[#111111] overflow-hidden mb-6 relative">
                  <motion.div className="absolute top-0 bottom-0 left-0 bg-white text-black" initial={{width: "0%"}} animate={{width: "100%"}} transition={{duration: 10, ease: "linear"}} />
                </div>
                <div className="inline-flex px-6 py-2 rounded-full bg-white/5 border border-white/5 text-gray-400 text-sm font-bold">
                  {LOADING_SEQUENCE[loadingStep]}
                </div>
             </motion.div>
           )}

           {builderStep === 'result' && prdResult && (
             <motion.div initial={{opacity:0}} animate={{opacity:1}} className="absolute inset-0 w-full h-full bg-[#000000] overflow-hidden flex flex-col">
                <div className="sticky top-0 z-50 bg-[#000000]/90 backdrop-blur-3xl border-b border-white/5 p-6 px-10 flex flex-col gap-4 shadow-2xl">
                   <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                     <div>
                       <div className="text-gray-300 text-xs font-bold uppercase tracking-widest mb-1">Rencana Aplikasi Lengkap</div>
                       <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">{projectName}</h2>
                     </div>
                     <div className="flex gap-3 flex-wrap">
                       {isEditingPrd ? (
                         <>
                           <button onClick={saveEditedPrdResult}
                             className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-sm transition-colors border border-white/15 flex items-center gap-2">
                             <Save className="w-4 h-4"/> Simpan Edit
                           </button>
                           <button onClick={() => { setIsEditingPrd(false); setEditedPrdContent(prdResult); }}
                             className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full font-bold text-gray-400 text-sm transition-colors border border-white/5">
                             Batal
                           </button>
                         </>
                       ) : (
                         <>
                           {(userProfile?.plan === 'PRO' || userProfile?.plan === 'PRO_MAX') && (
                             <button onClick={() => { setEditedPrdContent(prdResult); setIsEditingPrd(true); }}
                               className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full font-bold text-white text-sm transition-colors border border-white/5 flex items-center gap-2">
                               <Edit2 className="w-4 h-4"/> Edit Manual
                             </button>
                           )}
                           <button onClick={handleCopy}
                             className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full font-bold text-white text-sm transition-colors border border-white/5 flex items-center gap-2">
                             {isCopied ? <Check className="w-4 h-4 text-gray-300"/> : <Copy className="w-4 h-4"/>} {isCopied ? 'Tersalin' : 'Salin'}
                           </button>
                           <button onClick={handleExportText}
                             className="px-5 py-2.5 bg-white text-black hover:bg-gray-200 rounded-full font-extrabold text-sm transition-colors flex items-center gap-2">
                             <Download className="w-4 h-4"/> Unduh .md
                           </button>
                         </>
                         )}
                     </div>
                   </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden">
                   <aside className="w-full xl:w-[380px] shrink-0 border-b xl:border-b-0 xl:border-r border-white/5 bg-[#050505] p-6 lg:p-8 overflow-y-auto custom-scrollbar">
                     <div className="mb-6">
                       <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-4">
                         <Bot className="w-5 h-5 text-gray-300" />
                       </div>
                       <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Revisi AI</div>
                       <h3 className="text-xl font-extrabold tracking-tight text-white">Chat Revisi PRD</h3>
                     </div>

                     {!isEditingPrd ? (
                       <form onSubmit={handleResultRevision} className="space-y-4">
                         <textarea
                           value={resultRevisionPrompt}
                           onChange={(e) => setResultRevisionPrompt(e.target.value)}
                           disabled={isResultRevising}
                           placeholder="Contoh: tambahkan multi-language, ubah arsitektur backend, atau lengkapi flow admin."
                           rows={8}
                           className="w-full resize-none rounded-3xl border border-white/10 bg-[#111] p-4 text-sm font-medium leading-relaxed text-white outline-none placeholder-gray-600 transition-colors focus:border-white/25 disabled:opacity-50"
                         />
                         <button
                           type="submit"
                           disabled={isResultRevising || !resultRevisionPrompt.trim()}
                           className={`w-full rounded-2xl px-5 py-3.5 text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                             resultRevisionPrompt.trim() ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/5 text-gray-600'
                           }`}
                         >
                           {isResultRevising ? <><Loader2 className="w-4 h-4 animate-spin"/> Merevisi...</> : <><Send className="w-4 h-4"/> Kirim Revisi</>}
                         </button>
                       </form>
                     ) : (
                       <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm font-medium leading-relaxed text-gray-500">
                         Mode edit manual sedang aktif. Simpan atau batalkan edit untuk memakai revisi AI.
                       </div>
                     )}

                     <div className="mt-6 rounded-3xl border border-white/5 bg-[#0d0d0d] p-5">
                       <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Dokumen</div>
                       <div className="space-y-3 text-sm font-medium text-gray-400">
                         <div className="flex items-center justify-between gap-3">
                           <span>Mode</span>
                           <span className="text-gray-200">{isEditingPrd ? 'Editor Markdown' : 'Preview Markdown'}</span>
                         </div>
                         <div className="flex items-center justify-between gap-3">
                           <span>Model</span>
                           <span className="text-gray-200">{modelSelection}</span>
                         </div>
                       </div>
                     </div>
                   </aside>

                   <section className="flex-1 min-w-0 overflow-y-visible xl:overflow-y-auto custom-scrollbar p-8 lg:p-12">
                     <div className="max-w-5xl mx-auto">
                       {isEditingPrd ? (
                         <textarea
                           value={editedPrdContent}
                           onChange={(e) => setEditedPrdContent(e.target.value)}
                           className="w-full h-full min-h-[70vh] bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 text-[14px] text-gray-300 font-mono leading-relaxed resize-none outline-none focus:border-white/20 transition-colors"
                           placeholder="Edit Markdown PRD langsung di sini..."
                         />
                       ) : (
                         <div className="prose prose-invert prose-lg max-w-none prose-headings:tracking-tight prose-headings:font-extrabold prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-12 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-4 prose-a:text-gray-300 prose-pre:bg-[#111111] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-3xl prose-code:font-mono prose-code:text-gray-300">
                           <Markdown components={{ code({ node, inline, className, children, ...props }:any) { const match = /language-(\w+)/.exec(className||''); if (!inline && match && match[1] === 'mermaid') return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />; return <code className={`${className} bg-white/5 px-1.5 py-0.5 rounded font-bold text-gray-300`} {...props}>{children}</code>; } }}>
                             {prdResult}
                           </Markdown>
                         </div>
                       )}
                     </div>
                   </section>
                </div>
             </motion.div>
           )}
         </AnimatePresence>

      </div>
      )}
    </div>
  );

  const mainContent = (
    <div className="flex h-screen w-full bg-[#000000] text-white font-sans selection:bg-white selection:text-black relative">
      {/* SIDEBAR */}
      <div className={`${isSidebarOpen ? 'w-24 lg:w-72 border-r border-white/5' : 'w-0 overflow-hidden'} bg-[#000000] flex flex-col shrink-0 transition-all duration-300 relative`}>
        {isSidebarOpen && (
           <button onClick={() => setIsSidebarOpen(false)} className="absolute right-4 top-7 p-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white z-50 transition-colors hidden lg:flex">
             <ChevronLeft className="w-4 h-4" />
           </button>
        )}
        <div className="h-20 lg:h-24 px-6 flex items-center gap-4 shrink-0 transition-all border-b border-white/5 mb-4 whitespace-nowrap overflow-hidden">
           <div className="w-10 h-10 rounded-[14px] bg-[#111111] overflow-hidden border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)] shrink-0">
             <img src="/logo.png?v=2" alt="Logo" className="w-7 h-7 object-contain" />
           </div>
           <span className="hidden lg:block font-extrabold text-xl tracking-tight">VibeCoderz</span>
        </div>

        <div className="flex-1 px-4 py-2 flex flex-col gap-2">
           <div className="hidden lg:block text-xs font-bold text-gray-600 uppercase tracking-widest px-4 mb-2 mt-4">Menu</div>
           <button onClick={() => setActiveView('dashboard')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'dashboard' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
             <Activity className="w-5 h-5" /> <span className="hidden lg:block">Dashboard</span>
           </button>
           <button onClick={() => setActiveView('builder')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'builder' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
             {builderStep === 'generating' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
             <span className="hidden lg:block">Build Project</span>
             {builderStep === 'generating' && (
               <span className="ml-auto hidden lg:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-gray-300">
                 Running
               </span>
             )}
           </button>
           <button onClick={() => setActiveView('build_code')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'build_code' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
             <Code2 className="w-5 h-5" /> <span className="hidden lg:block">Build Code</span>
           </button>

           {userProfile?.role === 'ADMIN' && (
             <button onClick={() => setActiveView('admin')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'admin' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
               <User className="w-5 h-5" /> <span className="hidden lg:block">Admin Ops</span>
             </button>
           )}

           <button onClick={() => setActiveView('settings')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'settings' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
             <Settings className="w-5 h-5" /> <span className="hidden lg:block">Settings</span>
           </button>
        </div>

        <div className="p-4 border-t border-white/5 mt-auto">
          <button onClick={async () => { await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem('isLoggedIn'); localStorage.removeItem('user'); navigate('/'); }} className="w-full flex items-center justify-center lg:justify-start gap-4 px-4 py-3.5 rounded-2xl text-gray-500 hover:text-white hover:bg-white/5 transition-all font-bold text-[15px]">
            <LogOut className="w-5 h-5" /> <span className="hidden lg:block">Keluar Sesi</span>
          </button>
        </div>
      </div>

      <main className="flex-1 h-screen overflow-y-auto custom-scrollbar flex flex-col relative z-0">
         {!isSidebarOpen && (
           <button onClick={() => setIsSidebarOpen(true)} className="absolute top-6 left-6 z-50 p-2.5 rounded-xl bg-[#111] border border-white/10 hover:bg-white/10 text-white shadow-2xl transition-all flex items-center justify-center">
             <Menu className="w-5 h-5" />
           </button>
         )}
         {activeView === 'dashboard' && renderDashboardHome()}
         {activeView === 'builder' && renderBuilder()}
         {activeView === 'admin' && renderAdmin()}
         {activeView === 'build_code' && (
           <React.Suspense fallback={<div className="flex-1 grid place-items-center text-gray-500 font-bold">Memuat editor kode...</div>}>
             <BuildCode />
           </React.Suspense>
         )}

         {activeView === 'upgrade' && (
           <div className="p-8 lg:p-14 text-white max-w-6xl w-full">
             <div className="mb-12 border-b border-white/5 pb-8">
               <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2">Paket Langganan PRD</h1>
               <p className="text-gray-400 text-lg font-medium">Billing otomatis belum aktif. Perubahan plan dilakukan manual lewat Admin Ops.</p>
             </div>

             <div className="grid md:grid-cols-3 gap-8 items-stretch">

               {/* PRD TRIAL */}
               <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="p-8 rounded-[32px] bg-[#111111] border border-white/5 hover:border-white/10 transition-colors flex flex-col">
                 <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/5 text-gray-400 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/10">Gratis</div>
                 <h3 className="text-2xl font-bold mb-2">PRD Trial</h3>
                 <div className="text-5xl font-black mb-10 flex items-end gap-2">Rp 0 <span className="text-xl font-bold text-gray-500 pb-1 opacity-0">/bulan</span></div>
                 <div className="space-y-4 mb-8 font-medium text-gray-400 flex-1">
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>1x PRD per hari</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>AI Model Standar</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>Download File .MD</span></div>
                 </div>
                 <button className="w-full py-3.5 rounded-full bg-white/5 text-gray-400 font-bold border border-white/5 cursor-default mt-auto">Plan Saat Ini</button>
               </motion.div>

               {/* PRD PRO */}
               <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }} className="p-8 rounded-[32px] bg-gradient-to-b from-white/10 to-[#111111] border border-white/20 relative scale-[1.03] shadow-[0_20px_50px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col z-10">
                 <div className="absolute top-4 right-[-30px] bg-white text-black text-[11px] font-bold px-10 py-1.5 rotate-45 uppercase tracking-widest shadow-lg">Populer</div>
                 <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/20">Rekomendasi</div>
                 <h3 className="text-2xl font-bold mb-2">PRD Pro</h3>
                 <div className="text-5xl font-black mb-1 flex items-end gap-2">Rp20K <span className="text-xl font-bold text-gray-400 pb-1">/bulan</span></div>
                 <div className="space-y-4 mb-8 font-medium mt-10 flex-1">
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>AI Model Premium</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>5x PRD setiap hari</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Revisi PRD</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>20 Request Chat Revisi</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Tidak ada expiry</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Download File .MD</span></div>
                 </div>
                 <button type="button" onClick={() => requestManualUpgrade('PRO')} className="w-full py-3.5 rounded-full bg-white text-black font-bold hover:shadow-[0_8px_25px_rgba(255,255,255,0.2)] transition-all hover:-translate-y-1 mt-auto">Minta Admin Aktifkan</button>
               </motion.div>

               {/* PRD PRO MAX */}
               <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} className="p-8 rounded-[32px] bg-[#111111] border border-white/5 hover:border-white/20 transition-colors flex flex-col">
                 <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/20">Unlimited</div>
                 <h3 className="text-2xl font-bold mb-2">PRD Pro Max</h3>
                 <div className="text-5xl font-black mb-1 flex items-end gap-2">Rp75K <span className="text-xl font-bold text-gray-400 pb-1">/bulan</span></div>
                 <div className="space-y-4 mb-8 mt-10 font-medium flex-1">
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>AI Model Premium+</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Unlimited PRD</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Revisi PRD Unlimited</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>100++ Chat Revisi PRD</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Tidak ada expiry</span></div>
                   <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span className="font-bold text-gray-300">Bonus Kursus VibeCoding</span></div>
                 </div>
                 <button type="button" onClick={() => requestManualUpgrade('PRO_MAX')} className="w-full py-3.5 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-colors hover:-translate-y-1 mt-auto">Minta Admin Aktifkan</button>
               </motion.div>

             </div>
           </div>
         )}
         {activeView === 'settings' && (
           <div className="p-8 lg:p-14 text-white max-w-4xl w-full">
             <div className="mb-12 border-b border-white/5 pb-8">
               <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2">Settings</h1>
               <p className="text-gray-400 text-lg font-medium">Kelola profil dan langgananmu.</p>
             </div>
             <div className="space-y-8">
               <div className="p-8 rounded-[30px] bg-[#111111] border border-white/5">
                 <h3 className="text-lg font-bold mb-6 flex items-center gap-3"><User className="w-5 h-5 text-gray-400" /> Profil</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div><div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nama</div><div className="text-lg font-semibold">{userProfile?.name || '-'}</div></div>
                   <div><div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email</div><div className="text-lg font-semibold">{userProfile?.email || '-'}</div></div>
                   <div><div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Role</div><div className="text-lg font-semibold capitalize">{userProfile?.role?.toLowerCase() || '-'}</div></div>
                   <div><div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Plan</div><div className="text-lg font-semibold">{getPlanInfo()}</div></div>
                 </div>
               </div>
               <div className="p-8 rounded-[30px] bg-[#111111] border border-white/5">
                 <h3 className="text-lg font-bold mb-6 flex items-center gap-3"><Activity className="w-5 h-5 text-gray-400" /> Kuota Hari Ini</h3>
                 <div className="flex items-center gap-6">
                   <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                     <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${userProfile?.quota?.limit ? ((userProfile.quota.limit - (userProfile.quota.remaining || 0)) / userProfile.quota.limit) * 100 : 0}%` }} />
                   </div>
                   <div className="text-sm font-bold text-gray-300 shrink-0">{getQuotaInfo()}</div>
                 </div>
               </div>
               <div className="flex gap-4">
                 <button onClick={() => setActiveView('upgrade')} className="px-8 py-4 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-all">Lihat Opsi Plan</button>
               </div>
             </div>
           </div>
         )}
      </main>

      {/* Blueprint Viewer Modal */}
      <AnimatePresence>
        {viewingBlueprint && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex flex-col">
            <div className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 px-8 md:px-12 py-6 flex justify-between items-center shadow-2xl">
              <div>
                <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Blueprint Tersimpan</div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{viewingBlueprint.name}</h2>
              </div>
              <div className="flex gap-3">
                {(userProfile?.plan === 'PRO' || userProfile?.plan === 'PRO_MAX') && (
                  isEditingBlueprint ? (
                    <button onClick={saveEditedBlueprint} className="px-5 py-2.5 bg-white hover:bg-gray-200 rounded-full font-bold text-black text-sm transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Simpan Perubahan</button>
                  ) : (
                    <button onClick={() => setIsEditingBlueprint(true)} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-full font-bold text-white text-sm transition-colors border border-white/10 flex items-center gap-2"><Edit2 className="w-4 h-4" /> Edit Manual</button>
                  )
                )}
                <button onClick={() => { navigator.clipboard.writeText(viewingBlueprint.content); }} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full font-bold text-white text-sm transition-colors border border-white/5 flex items-center gap-2"><Copy className="w-4 h-4" /> Salin</button>
                <button onClick={() => downloadBlueprint(viewingBlueprint.id, viewingBlueprint.name, 'md')} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-full font-bold text-white text-sm transition-colors border border-white/10 flex items-center gap-2"><Download className="w-4 h-4" /> MD</button>
                <button onClick={() => downloadBlueprint(viewingBlueprint.id, viewingBlueprint.name, 'html')} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-full font-bold text-white text-sm transition-colors border border-white/10 flex items-center gap-2"><Download className="w-4 h-4" /> HTML</button>
                <button onClick={() => setViewingBlueprint(null)} className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-full font-bold text-red-400 text-sm transition-colors border border-red-500/20">Tutup</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden">
              <aside className="w-full xl:w-[400px] shrink-0 border-b xl:border-b-0 xl:border-r border-white/5 bg-[#050505] p-6 lg:p-8 overflow-y-auto custom-scrollbar">
                {(userProfile?.plan === 'PRO' || userProfile?.plan === 'PRO_MAX') && (
                  <div className="mb-6">
                    <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-4">
                      <Bot className="w-5 h-5 text-gray-300" />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Revisi AI</div>
                    <h3 className="text-xl font-extrabold tracking-tight text-white mb-4">Chat Revisi Blueprint</h3>
                    {!isEditingBlueprint ? (
                      <form onSubmit={handleReviseBlueprint} className="space-y-4">
                        <textarea
                          disabled={isRevising}
                          value={revisionPrompt}
                          onChange={(e) => setRevisionPrompt(e.target.value)}
                          placeholder="Contoh: tambahkan payment gateway, ubah role admin, atau detailkan modul notifikasi."
                          rows={8}
                          className="w-full resize-none rounded-3xl border border-white/10 bg-[#111] p-4 text-sm font-medium leading-relaxed text-white outline-none placeholder-gray-600 transition-colors focus:border-white/25 disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={isRevising || !revisionPrompt.trim()}
                          className={`w-full rounded-2xl px-5 py-3.5 text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                            revisionPrompt.trim() ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/5 text-gray-600'
                          }`}
                        >
                          {isRevising ? <><Loader2 className="w-4 h-4 animate-spin" /> Merevisi...</> : <><Send className="w-4 h-4" /> Kirim Revisi</>}
                        </button>
                      </form>
                    ) : (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm font-medium leading-relaxed text-gray-500">
                        Mode edit manual sedang aktif. Simpan atau batalkan edit untuk memakai revisi AI.
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-3xl border border-white/5 bg-[#111] p-5 mb-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Metadata</div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5" /> Folder
                      </label>
                      <input
                        type="text"
                        value={editedBlueprintFolder}
                        onChange={(e) => setEditedBlueprintFolder(e.target.value)}
                        maxLength={60}
                        placeholder="Client Work, SaaS, Internal"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5" /> Tag
                      </label>
                      <input
                        type="text"
                        value={editedBlueprintTags}
                        onChange={(e) => setEditedBlueprintTags(e.target.value)}
                        placeholder="mvp, backend, mobile"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                      />
                    </div>
                    <button
                      onClick={saveBlueprintMetadata}
                      className="w-full px-5 py-3 rounded-2xl bg-white text-black hover:bg-gray-200 font-extrabold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Simpan Metadata
                    </button>
                  </div>
                </div>

                {blueprintVersions.length > 0 && (
                  <div className="rounded-3xl border border-white/5 bg-[#111] p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Version History</div>
                        <div className="text-sm font-bold text-gray-300">{blueprintVersions.length} versi</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {blueprintVersions.slice(0, 8).map((version) => (
                        <button
                          key={version.id}
                          onClick={() => restoreBlueprintVersion(version.id)}
                          className="w-full rounded-2xl border border-white/5 bg-black/40 p-3 text-left hover:bg-white/10 transition-colors"
                          title="Restore versi ini"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-black">v{version.version}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">{version.source}</div>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-2">{new Date(version.createdAt).toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </aside>

              <section className="flex-1 min-w-0 overflow-y-visible xl:overflow-y-auto custom-scrollbar p-8 md:p-12">
                <div className="max-w-4xl mx-auto">
                  {isEditingBlueprint ? (
                    <textarea
                      value={editedBlueprintContent}
                      onChange={(e) => setEditedBlueprintContent(e.target.value)}
                      className="w-full h-[70vh] bg-[#111] text-gray-300 font-mono text-sm p-6 rounded-2xl border border-white/10 focus:border-white/30 focus:outline-none resize-none"
                      placeholder="Edit Markdown PRD di sini..."
                    />
                  ) : (
                    <div className="prose prose-invert prose-lg max-w-none prose-headings:tracking-tight prose-headings:font-extrabold prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-12 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-4 prose-pre:bg-[#111111] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-3xl">
                      <Markdown components={{ code({ node, inline, className, children, ...props }:any) { const match = /language-(\w+)/.exec(className||''); if (!inline && match && match[1] === 'mermaid') return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />; return <code className={`${className} bg-white/5 px-1.5 py-0.5 rounded font-bold text-gray-300`} {...props}>{children}</code>; } }}>
                        {viewingBlueprint.content}
                      </Markdown>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {mainContent}
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-8 right-8 z-[99999] px-6 py-4 bg-[#111] border border-white/10 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-3 backdrop-blur-xl">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
