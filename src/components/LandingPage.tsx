import { motion, AnimatePresence } from 'motion/react';
import { Box, Target, Layers, Play, Check, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import PillNav from './PillNav';
import Silk from './Silk';
import { apiFetch, readApiError, userFacingError } from '../utils/api';

type Lang = 'id' | 'en';

const dict = {
  id: {
    nav_index: 'Fitur Aplikasi',
    nav_pricing: 'Pilihan Paket',
    build_btn: 'Mulai Buat',
    hero_badge: 'BISA BANTU APA?',
    hero_title_1: 'Bikin Rencana Aplikasi',
    hero_title_2: 'Jadi Instan Pakai AI',
    hero_desc: 'Nggak perlu pusing mikirin cara bikin website atau sistem database. Cukup tulis ide aplikasi yang kamu inginkan, dan AI kami akan membuatkan rencana desain, gambar alur data, hingga kode pemrogramannya dalam hitungan detik!',
    hero_cta: 'Mulai Buat Sekarang (Gratis) →',
    feat1_title: 'Rekomendasi Sistem Terbaik',
    feat1_desc: 'Dapatkan daftar alat dan bahasa pemrograman terbaik yang paling cocok untuk mewujudkan ide aplikasimu secara otomatis.',
    feat2_title: 'Gambar Diagram Alur',
    feat2_desc: 'Lihat bagaimana data di aplikasimu saling terhubung lewat gambar diagram yang simpel dan mudah dipahami.',
    feat3_title: 'Panduan & Kode Siap Pakai',
    feat3_desc: 'Dapatkan petunjuk langkah demi langkah beserta kode pemrograman yang sudah siap dijalankan untuk aplikasi kamu.',
    footer: 'Copyright © 2026 VibeCoderz Labs. Hak cipta dilindungi undang-undang.',
  },
  en: {
    nav_index: 'System Features',
    nav_pricing: 'Capacity',
    build_btn: 'Build',
    hero_badge: 'WHAT WE BUILD',
    hero_title_1: 'Crafting the Ecosystem of',
    hero_title_2: 'App Architecture',
    hero_desc: 'Reduce infrastructure planning cycles from weeks to seconds with an AI engine designed for true developers and tech-founders.',
    hero_cta: 'Try VibeCoderz →',
    feat1_title: 'Precision Architecture',
    feat1_desc: 'Efficient and robust tech stack selection without random guesswork.',
    feat2_title: 'Schema Visualization',
    feat2_desc: 'Instantly rendered ER graphs and data flow diagrams.',
    feat3_title: 'Ready to Deploy',
    feat3_desc: 'Step-by-step instructions that your copilot instruments actually understand.',
    footer: 'Copyright © 2026 VibeCoderz Labs All trademarks belong to their respective owners.',
  }
};



export default function LandingPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('id');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState('Home');

  const text = dict[lang];
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const isGoogleConfigured = Boolean(googleClientId && googleClientId !== 'dummy_client_id');

  const handleGoogleCredential = async (credential?: string) => {
    if (!isGoogleConfigured) {
      setLoginError('Login Google belum dikonfigurasi. Set VITE_GOOGLE_CLIENT_ID di environment.');
      return;
    }
    if (!credential) {
      setLoginError('Autentikasi Google tidak mengirim credential.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          id_token: credential,
          idToken: credential,
          token: credential,
        })
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, 'Login failed'));
      }

      const data = await res.json();
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login Error:', err);
      setLoginError(`Login gagal: ${userFacingError(err, 'Login gagal.')}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openLoginModal = () => {
    setLoginError(null);
    setShowLoginModal(true);
  };

  // Lock body scroll when login modal is open
  useEffect(() => {
    if (showLoginModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showLoginModal]);

  return (
    <>
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-white selection:text-black relative overflow-x-hidden">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <Silk
          color="#f7f3f3"
          speed={9.7}
          scale={0.9}
          noiseIntensity={6.9}
          rotation={2.59}
        />
      </div>
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] bg-white/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />

      {/* HEADER NAVBAR (Light overlapping Dark) */}
      <div className="fixed top-0 w-full z-50 transition-all duration-300">
        <nav className="w-full bg-[#f8f9fa]/90 backdrop-blur-md pt-4 pb-4 rounded-b-[20px] md:rounded-b-[40px] shadow-lg relative z-10 text-black border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 flex justify-between items-center h-14">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
              <img src="/logo.png?v=2" alt="VibeCoderz" className="w-8 h-8 object-contain" />
              <span className="font-extrabold text-[22px] tracking-tight">VibeCoderz</span>
              <div className="w-2 h-2 rounded-full bg-white text-black"></div>
            </div>
            
            <div className="hidden md:flex flex-1 justify-center z-[90]">
               <PillNav
                 items={[
                   { label: 'Beranda', href: '/' },
                   { label: 'Cara Kerja', href: '#fitur' },
                   { label: 'Paket Layanan', href: '#harga' }
                 ]}
                 baseColor="#111111"
                 pillColor="#ffffff"
                 pillTextColor="#9ca3af" // Tailwind gray-400
                 hoveredPillTextColor="#000000"
               />
            </div>

            <div className="flex items-center gap-6">
               <button 
                  onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
                  className="flex items-center gap-1 font-bold text-[14px] hover:text-gray-500 transition-colors uppercase px-2 py-1 rounded-md hover:bg-gray-200/50"
               >
                 {lang} <span className="text-[10px] opacity-60">▼</span>
               </button>
               <button 
                 onClick={openLoginModal}
                 className="hidden md:flex px-6 py-2.5 rounded-full bg-transparent border-2 border-black text-black hover:bg-black hover:text-white font-bold text-[15px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-0.5"
               >
                 {text.build_btn}
               </button>
            </div>
          </div>
        </nav>
      </div>

      {/* HERO BANNER SECTION */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-40 pb-32 flex flex-col items-center">
         
         <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
           className="w-full bg-black/60 shadow-2xl rounded-[40px] md:rounded-[60px] border border-white/5 backdrop-blur-xl mt-12 p-10 md:p-20 text-center relative overflow-hidden"
         >
           <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none"></div>
           
           <h1 className="text-5xl md:text-[70px] font-extrabold tracking-tight leading-[1.1] mb-6 relative z-10 flex flex-col items-center gap-3">
              <motion.span 
                initial={{ opacity: 0, x: -100, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.2, type: "spring", damping: 15 }}
                className="inline-block"
              >
                {text.hero_title_1}
              </motion.span>
              <motion.span 
                initial={{ opacity: 0, x: 100, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.4, type: "spring", damping: 15 }}
                className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-white to-gray-400 pb-2" 
              >
                {text.hero_title_2}
              </motion.span>
           </h1>
           
           <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-12 mt-12 border-t border-white/10 pt-8 relative z-10">
              <div className="text-center">
                 <div className="text-4xl md:text-5xl font-black mb-1">PRD</div>
                 <div className="text-[14px] text-gray-400 font-medium">Blueprint Teknis</div>
              </div>
              <div className="hidden md:block w-px h-12 bg-white/10"></div>
              <div className="text-center">
                 <div className="text-4xl md:text-5xl font-black mb-1">Code</div>
                 <div className="text-[14px] text-gray-400 font-medium">Preview Sandpack</div>
              </div>
              <div className="hidden md:block w-px h-12 bg-white/10"></div>
              <div className="text-center">
                 <div className="text-4xl md:text-5xl font-black mb-1">Model</div>
                 <div className="text-[14px] text-gray-400 font-medium">Llama 70B Turbo</div>
              </div>
           </div>
         </motion.div>
         
         <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
           className="mt-20 max-w-3xl text-center"
         >
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[13px] mb-8 uppercase tracking-widest border border-white/20">
              {text.hero_badge}
            </div>
            <p className="text-xl md:text-2xl font-medium leading-relaxed text-gray-300 mb-10">
              {text.hero_desc}
            </p>
            <button 
               onClick={openLoginModal}
               className="px-10 py-4 rounded-full bg-white text-black font-bold text-lg hover:shadow-[0_8px_30px_rgba(255,255,255,0.2)] transition-all hover:scale-[1.02]"
            >
              {text.hero_cta}
            </button>
         </motion.div>
      </main>

      {/* BENTO GRID FEATURES */}
      <section id="fitur" className="relative z-10 w-full bg-[#f8f9fa] pt-24 pb-24 rounded-t-[40px] md:rounded-t-[60px] text-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center md:text-left">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">Cara VibeCoderz <br className="hidden md:block" />Bantu Kamu Berkembang</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <motion.div 
               initial={{ opacity: 0, y: 50 }} 
               whileInView={{ opacity: 1, y: 0 }} 
               viewport={{ once: true, margin: "-100px" }} 
               transition={{ duration: 0.6 }} 
               className="lg:col-span-2 p-10 md:p-14 bg-white rounded-[40px] shadow-xl border border-gray-200 flex flex-col justify-between hover:-translate-y-1 transition-transform"
            >
               <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mb-8">
                  <Box className="w-8 h-8 text-black" />
               </div>
               <h3 className="text-3xl font-bold tracking-tight mb-4 text-black">{text.feat1_title}</h3>
               <p className="text-lg text-gray-600 font-medium leading-relaxed">{text.feat1_desc}</p>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 50 }} 
               whileInView={{ opacity: 1, y: 0 }} 
               viewport={{ once: true, margin: "-100px" }} 
               transition={{ duration: 0.6, delay: 0.2 }} 
               className="p-10 md:p-14 bg-black text-white rounded-[40px] shadow-xl border border-white/20 flex flex-col justify-between hover:-translate-y-1 transition-transform relative overflow-hidden"
            >
               <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-white/10 blur-[40px] rounded-full pointer-events-none" />
               <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mb-8 relative z-10">
                  <Target className="w-8 h-8 text-white" />
               </div>
               <div className="relative z-10">
                  <h3 className="text-2xl font-bold tracking-tight mb-4">{text.feat2_title}</h3>
                  <p className="text-[16px] text-gray-400 font-medium leading-relaxed">{text.feat2_desc}</p>
               </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 50 }} 
               whileInView={{ opacity: 1, y: 0 }} 
               viewport={{ once: true, margin: "-100px" }} 
               transition={{ duration: 0.6, delay: 0.4 }} 
               className="lg:col-span-3 p-10 md:p-14 bg-[#111] text-white rounded-[40px] shadow-xl border border-white/10 flex flex-col md:flex-row items-center justify-between hover:-translate-y-1 transition-transform overflow-hidden relative"
            >
               <div className="absolute bottom-0 right-0 w-1/2 h-full bg-gradient-to-l from-white/10 to-transparent blur-[50px] pointer-events-none" />
               <div className="md:w-1/2 mb-8 md:mb-0 relative z-10">
                  <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-white font-bold text-[13px] mb-6 uppercase tracking-widest border border-white/20">
                    <Play className="w-3.5 h-3.5 mr-2 fill-current" /> Auto Execution
                  </div>
                  <h3 className="text-4xl font-extrabold tracking-tight mb-4">{text.feat3_title}</h3>
                  <p className="text-xl text-gray-400 font-medium leading-relaxed">{text.feat3_desc}</p>
               </div>
               <div className="md:w-1/3 relative z-10 border-4 border-white/10 rounded-3xl p-6 bg-black">
                 <div className="flex gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                 </div>
                 <div className="space-y-3 font-mono text-xs text-gray-300">
                    <p className="text-gray-300">&gt; Npx create-next-app@latest</p>
                    <p>✔ Success! Created proj-v01.</p>
                    <p className="text-gray-400">&gt; Generating schema.prisma...</p>
                    <p>✔ Database relations aligned.</p>
                 </div>
               </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* PRICING PLANS */}
      <section id="harga" className="relative z-10 w-full bg-[#000000] py-24 rounded-t-[40px] md:rounded-t-[60px] -mt-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Pilih Paket Desain Aplikasi</h2>
            <p className="text-xl text-gray-400 font-medium">Billing otomatis belum aktif. Admin dapat mengubah plan akun secara manual.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            
            {/* PRD TRIAL */}
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="p-8 rounded-[32px] bg-[#111111] border border-white/5 hover:border-white/10 transition-colors flex flex-col">
               <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/5 text-gray-400 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/10">Gratis</div>
               <h3 className="text-2xl font-bold mb-2">Paket Uji Coba</h3>
               <div className="text-5xl font-black mb-10 flex items-end gap-2">Rp 0 <span className="text-xl font-bold text-gray-500 pb-1 opacity-0">/bulan</span></div>
               <div className="space-y-4 mb-8 font-medium text-gray-400 flex-1">
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>1x Rencana Aplikasi per hari</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>Model AI Standar</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>Unduh Dokumen (.MD)</span></div>
               </div>
            </motion.div>

            {/* PRD PRO */}
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }} className="p-8 rounded-[32px] bg-gradient-to-b from-white/10 to-[#111111] border border-white/20 relative scale-[1.03] shadow-[0_20px_50px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col z-10">
               <div className="absolute top-4 right-[-30px] bg-white text-black text-[11px] font-bold px-10 py-1.5 rotate-45 uppercase tracking-widest shadow-lg">Populer</div>
               <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/20">Rekomendasi</div>
               <h3 className="text-2xl font-bold mb-2">Paket Pro</h3>
               <div className="text-5xl font-black mb-1 flex items-end gap-2">Rp20K <span className="text-xl font-bold text-gray-400 pb-1">/bulan</span></div>
               <div className="space-y-4 mb-8 font-medium mt-10 flex-1">
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Model AI Premium (Lebih Pintar)</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>5x Rencana Aplikasi setiap hari</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Bisa Revisi Rencana Aplikasi</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>20x Chat Revisi dengan AI</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Akses Selamanya (Tanpa Kedaluwarsa)</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Unduh Dokumen (.MD)</span></div>
               </div>
            </motion.div>

            {/* PRD PRO MAX */}
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} className="p-8 rounded-[32px] bg-[#111111] border border-white/5 hover:border-white/20 transition-colors flex flex-col">
               <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/20">Unlimited</div>
               <h3 className="text-2xl font-bold mb-2">Paket Pro Max</h3>
               <div className="text-5xl font-black mb-1 flex items-end gap-2">Rp75K <span className="text-xl font-bold text-gray-400 pb-1">/bulan</span></div>
               <div className="space-y-4 mb-8 mt-10 font-medium flex-1">
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Model AI Paling Cerdas (God Mode)</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Bikin Rencana Aplikasi Sepuasnya</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Revisi Rencana Sepuasnya</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Ratusan Chat Revisi AI</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Akses Selamanya (Tanpa Kedaluwarsa)</span></div>
                  <div className="flex items-start gap-3 py-2 border-b border-white/5"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span className="font-bold text-gray-300">Bonus Kelas Coding Eksklusif</span></div>
               </div>
            </motion.div>

          </div>
        </div>
      </section>

      <footer className="w-full bg-[#000000] p-12 border-t border-white/10 z-10 relative text-gray-400 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-[14px]">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
             <img src="/logo.png?v=2" alt="VibeCoderz" className="w-6 h-6 object-contain opacity-50 grayscale" />
             <span className="font-bold tracking-tight text-white/50">VibeCoderz</span>
          </div>
          <div className="text-center md:text-left mb-4 md:mb-0 text-white/40">
            {text.footer}
          </div>
          <div className="flex gap-4">
            <a href="https://instagram.com/zennz_466" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white transition-colors">Instagram</a>
            <a href="#" className="text-white/40 hover:text-white transition-colors">Twitter</a>
            <a href="#" className="text-white/40 hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-[#000000]/80 backdrop-blur-md"
              onClick={() => !isLoggingIn && setShowLoginModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white text-black rounded-[40px] p-10 flex flex-col items-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-6">
                <Layers className="w-8 h-8 text-gray-600" />
              </div>
              
              <h3 className="text-3xl font-extrabold text-black mb-2 tracking-tight text-center">Masuk ke Ruang Pembuat</h3>
              <p className="text-[15px] font-medium text-gray-500 text-center mb-8">
                Login untuk mulai merancang dan membuat rancangan aplikasimu secara otomatis.
              </p>

              {isGoogleConfigured ? (
                <div className={`w-full flex justify-center ${isLoggingIn ? 'pointer-events-none opacity-50' : ''}`}>
                  <GoogleLogin
                    onSuccess={(credentialResponse) => handleGoogleCredential(credentialResponse.credential)}
                    onError={() => {
                      setLoginError('Autentikasi Google dibatalkan atau gagal.');
                      setIsLoggingIn(false);
                    }}
                    theme="outline"
                    size="large"
                    shape="pill"
                    text="signin_with"
                    width="320"
                  />
                </div>
              ) : (
                <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 text-center">
                  Login Google belum dikonfigurasi.
                </div>
              )}
              {isLoggingIn && (
                <div className="mt-4 text-sm font-bold text-gray-500">Memproses identitas...</div>
              )}
              {loginError && (
                <div className="mt-4 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 text-center">
                  {loginError}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
