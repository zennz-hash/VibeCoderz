import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Box, Target, Layers, Play, Check, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import PillNav from './PillNav';
import Silk from './Silk';

type Lang = 'id' | 'en';

const dict = {
  id: {
    nav_index: 'Fitur Sistem',
    nav_pricing: 'Kapasitas',
    build_btn: 'Build',
    hero_badge: 'APA YANG KITA BANGUN',
    hero_title_1: 'Merakit Ekosistem',
    hero_title_2: 'Arsitektur Aplikasi',
    hero_desc: 'Mengurangi waktu perencanaan infrastruktur dari berminggu-minggu menjadi hitungan detik dengan AI yang dirancang untuk developer dan tech-founder sejati.',
    hero_cta: 'Cobain VibeCoderz →',
    feat1_title: 'Arsitektur Presisi',
    feat1_desc: 'Pilihan stack teknologi yang efisien dan kokoh tanpa tebakan acak.',
    feat2_title: 'Visualisasi Skema',
    feat2_desc: 'Diagram ER dan alur data langsung jadi dalam format gambar.',
    feat3_title: 'Siap Deploy',
    feat3_desc: 'Instruksi bertahap yang paling mengerti instrumen kopilot Anda.',
    footer: 'Copyright © 2026 VibeCoderz Labs All trademarks belong to their respective owners.',
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
  const [activeNav, setActiveNav] = useState('Home');
  const [showIntro, setShowIntro] = useState(true);

  const text = dict[lang];

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoggingIn(true);
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResponse.access_token })
        });
        
        if (!res.ok) throw new Error('Login failed');
        
        const data = await res.json();
        
        // Save auth data
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        
        navigate('/dashboard');
      } catch (err) {
        console.error('Login Error:', err);
        setIsLoggingIn(false);
      }
    },
    onError: () => setIsLoggingIn(false)
  });

  return (
    <>
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            key="intro-video"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
          >
            <video
              src="/intro.mp4"
              autoPlay
              muted
              playsInline
              onEnded={() => setShowIntro(false)}
              className="w-full h-full object-cover"
            />
            <button 
              onClick={() => setShowIntro(false)}
              className="absolute bottom-8 right-8 md:bottom-10 md:right-10 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all font-medium z-10"
            >
              Skip Intro
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    <div className={`min-h-screen bg-[#000000] text-white font-sans selection:bg-white selection:text-black relative overflow-x-hidden ${showIntro ? 'h-screen overflow-hidden' : ''}`}>
      
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
        <nav className="w-full bg-[#f8f9fa] pt-4 pb-8 rounded-b-[40px] md:rounded-b-[80px] shadow-2xl relative z-10 text-black">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <img src="/logo.png?v=2" alt="VibeCoderz" className="w-8 h-8 object-contain" />
              <span className="font-extrabold text-[22px] tracking-tight">VibeCoderz</span>
              <div className="w-2 h-2 rounded-full bg-white text-black"></div>
            </div>
            
            <div className="hidden md:flex flex-1 justify-center z-[90]">
               <PillNav
                 items={[
                   { label: 'Home', href: '/' },
                   { label: 'How to work', href: '#fitur' },
                   { label: 'Subscribe', href: '#harga' }
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
                  className="font-bold text-[14px] hover:text-gray-300 transition-colors uppercase"
               >
                 {lang}
               </button>
               <button 
                 onClick={() => setShowLoginModal(true)}
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
           
           <div className="flex flex-col md:flex-row justify-center items-center gap-12 mt-16 border-t border-white/10 pt-12 relative z-10">
              <div className="text-center">
                 <div className="text-4xl md:text-5xl font-black mb-2">12K+</div>
                 <div className="text-[15px] text-gray-400 font-medium">Pengguna Aktif</div>
              </div>
              <div className="hidden md:block w-px h-16 bg-white/10"></div>
              <div className="text-center">
                 <div className="text-4xl md:text-5xl font-black mb-2">1M+</div>
                 <div className="text-[15px] text-gray-400 font-medium">Barris Kode Diselamatkan</div>
              </div>
              <div className="hidden md:block w-px h-16 bg-white/10"></div>
              <div className="text-center">
                 <div className="text-4xl md:text-5xl font-black mb-2">Model</div>
                 <div className="text-[15px] text-gray-400 font-medium">Llama 70B Turbo</div>
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
               onClick={() => setShowLoginModal(true)}
               className="px-10 py-4 rounded-full bg-white text-black font-bold text-lg hover:shadow-[0_8px_30px_rgba(255,255,255,0.2)] transition-all hover:scale-[1.02]"
            >
              {text.hero_cta}
            </button>
         </motion.div>
      </main>

      {/* BENTO GRID FEATURES */}
      <section id="fitur" className="relative z-10 w-full bg-[#f8f9fa] pt-32 pb-40 rounded-t-[40px] md:rounded-t-[80px] text-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Cara VibeCoderz <br/>Bantu Kamu Berkembang</h2>
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
      <section id="harga" className="relative z-10 w-full bg-[#000000] py-32 rounded-t-[40px] md:rounded-t-[80px] -mt-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Pilih Paket PRD</h2>
            <p className="text-xl text-gray-400 font-medium">Skalakan output arsitektur sesuai kebutuhan timmu.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            
            {/* PRD TRIAL */}
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="p-10 rounded-[40px] bg-[#111111] border border-white/5 hover:border-white/10 transition-colors flex flex-col">
               <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/5 text-gray-400 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/10">Gratis</div>
               <h3 className="text-2xl font-bold mb-2">PRD Trial</h3>
               <div className="text-5xl font-black mb-10">Rp 0</div>
               <div className="space-y-5 mb-12 font-medium text-gray-400 flex-1">
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>1x PRD per hari</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>AI Model Standar</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" /> <span>Download File .MD</span></div>
               </div>
            </motion.div>

            {/* PRD STARTER */}
            <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }} className="p-10 rounded-[40px] bg-gradient-to-b from-white/10 to-[#111111] border border-white/20 relative scale-[1.03] shadow-[0_20px_50px_rgba(255,255,255,0.05)] overflow-hidden flex flex-col">
               <div className="absolute top-0 right-0 bg-gradient-to-l from-gray-300 to-white text-white text-[12px] font-bold px-5 py-2.5 rounded-bl-3xl rounded-tr-[40px] uppercase tracking-widest">Populer</div>
               <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/20">Rekomendasi</div>
               <h3 className="text-2xl font-bold mb-2">PRD Starter</h3>
               <div className="text-5xl font-black mb-1 flex items-end gap-2">Rp20K <span className="text-xl font-bold text-gray-400 pb-1">/bulan</span></div>
               <div className="space-y-5 mb-12 font-medium mt-10 flex-1">
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>AI Model Premium</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>5x PRD setiap hari</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Revisi PRD</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>20 Request Chat Revisi</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Tidak ada expiry</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Download File .MD</span></div>
               </div>
            </motion.div>

            {/* PRD PRO */}
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} className="p-10 rounded-[40px] bg-[#111111] border border-white/5 hover:border-white/20 transition-colors flex flex-col">
               <div className="inline-flex self-start items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[12px] uppercase tracking-widest mb-6 border border-white/20">Unlimited</div>
               <h3 className="text-2xl font-bold mb-2">PRD Pro</h3>
               <div className="text-5xl font-black mb-1 flex items-end gap-2">Rp75K <span className="text-xl font-bold text-gray-400 pb-1">/bulan</span></div>
               <div className="space-y-5 mb-12 mt-10 font-medium flex-1">
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>AI Model Premium+</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Unlimited PRD</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Revisi PRD Unlimited</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>100++ Chat Revisi PRD</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span>Tidak ada expiry</span></div>
                  <div className="flex items-start gap-4 py-2 border-b border-white/10"><Check className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" /> <span className="font-bold text-gray-300">Bonus Kursus VibeCoding</span></div>
               </div>
            </motion.div>

          </div>
        </div>
      </section>

      <footer className="w-full bg-[#000000] p-10 border-t border-white/5 z-10 relative text-gray-400">
        <div className="max-w-6xl mx-auto flex flex-col justify-center items-center font-bold text-[15px] space-y-2">
          <div>Sosial Media Developer</div>
          <div className="text-white text-lg">Ikhwanda Pratama</div>
          <div className="text-gray-500">Instagram: <a href="https://instagram.com/zennz_466" className="text-white hover:underline">@zennz_466</a></div>
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
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-white/10 to-white/10 flex items-center justify-center mb-6">
                <Layers className="w-8 h-8 text-gray-300" />
              </div>
              
              <h3 className="text-3xl font-extrabold text-black mb-2 tracking-tight text-center">Masuk ke Ruang Builder</h3>
              <p className="text-[15px] font-medium text-gray-500 text-center mb-8">
                Autorisasi akun Anda untuk mengakses sistem pembentukan arsitektur.
              </p>

              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-full bg-white border border-gray-300 text-black font-bold text-[15px] hover:bg-gray-50 hover:-translate-y-1 transition-all disabled:opacity-50 shadow-sm"
              >
                {!isLoggingIn && (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {isLoggingIn ? 'Memproses Identitas...' : 'Login Menggunakan Google'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
