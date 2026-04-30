import { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import mermaid from 'mermaid';
import { useNavigate } from 'react-router-dom';
import { Layers, Activity, Search, Clock, LogOut, ArrowRight, Settings, Check, Download, Copy, Play, Code2, Menu, ChevronLeft, Megaphone, Bot } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import BuildCode from './BuildCode';
import AutoPromotion from './AutoPromotion';

mermaid.initialize({
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
  securityLevel: 'loose',
});

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
  const id = `mermaid-${baseId}-${Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    const renderChart = async () => {
      try {
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
    return () => { isMounted = false; };
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

const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 1, title: "Apa bentuk akhir dari platform teknologimu?", type: 'single', options: ["Aplikasi Web", "Aplikasi Mobile", "Ekstensi Browser", "Aplikasi Desktop", "Lainnya"] },
  { id: 2, title: "Siapa segmentasi pengguna utamamu?", type: 'single', options: ["Retail (B2C)", "Institusi (B2B)", "Developer (B2D)", "Internal Enterprise", "Lainnya"] },
  { id: 3, title: "Metode otentikasi (login) apa yang digunakan?", type: 'multi', options: ["Email/Sandi", "Social Web2 (Google/X)", "Web3 Wallet (MetaMask)", "Biometrik", "Lainnya"] },
  { id: 4, title: "Pilih infrastruktur fitur prioritas yang krusial:", type: 'multi', options: ["Payment Gateway", "Sistem Real-time Chat", "Modul AI / LLM", "Dasbor Analisis Data", "Penyimpanan Berkas Terdistribusi", "Lainnya"] },
  { id: 5, title: "Bagaimana arsitektur penyimpanan datamu?", type: 'single', options: ["Relasional DB (PostgeSQL)", "NoSQL (MongoDb)", "Desentralisasi (IPFS)", "Hybrid Architecture", "Lainnya"] },
  { id: 6, title: "Pilih paradigma struktur backend-mu:", type: 'single', options: ["Monolithic Server", "Microservices via Kubernetes", "Serverless Functions", "Edge Computing", "Lainnya"] },
  { id: 7, title: "Mekanisme utama aliran pendapatan (Monetisasi)?", type: 'input' }
];

const LOADING_SEQUENCE = [
  "Menyinkronkan Parameter Infrastruktur...",
  "Merakit Matriks Relasional Database...",
  "Memetakan Aliran Data Pengguna...",
  "Mengekstrak Dokumen Teknis...",
  "Finalisasi Blueprints..."
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'dashboard' | 'builder' | 'history' | 'upgrade' | 'build_code' | 'auto_promo'>('dashboard');
  const [builderStep, setBuilderStep] = useState<'standby' | 'quiz' | 'generating' | 'result'>('standby');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [projectType, setProjectType] = useState('Fullstack Web App');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isAiChoice, setIsAiChoice] = useState(true);
  const [techStack, setTechStack] = useState({ frontend: 'Next.js', backend: 'Node.js/Express', database: 'PostgreSQL', deployment: 'Vercel' });
  
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string | string[]>>({});
  const [loadingStep, setLoadingStep] = useState(0);
  const [prdResult, setPrdResult] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        setTimeout(() => setCurrentQuizIndex(c => (c < QUIZ_QUESTIONS.length - 1 ? c + 1 : c)), 250);
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

  const nextSlide = () => setCurrentQuizIndex(c => (c < QUIZ_QUESTIONS.length - 1 ? c + 1 : c));
  const prevSlide = () => setCurrentQuizIndex(c => (c > 0 ? c - 1 : c));

  const handleFinalSubmit = async () => {
    setBuilderStep('generating');
    setPrdResult('');
    setLoadingStep(0);

    let compiledDescription = projectDescription + "\n\nKonteks Kebutuhan Tambahan:\n";
    QUIZ_QUESTIONS.forEach(q => {
      const ans = quizAnswers[q.id];
      if (ans) compiledDescription += `- ${q.title}: ${Array.isArray(ans) ? ans.join(', ') : ans}\n`;
    });

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/generate-prd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ projectType, projectName, projectDescription: compiledDescription, isAiChoice, techStack }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Mesin Gagal Menyinkronkan Data.' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setPrdResult(data.markdown);
      setBuilderStep('result');

      // Update quota info from server response
      if (data.quota) {
        setUserProfile((prev: any) => prev ? { ...prev, quota: data.quota } : prev);
      }

      // Refresh blueprints list (PRD was auto-saved server-side)
      fetchBlueprints();

    } catch (error: any) {
      setPrdResult(`### ERROR SYSTEM KONEKSI\n\n${error.message}`);
      setBuilderStep('result');
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

  /* ====================== RENDERERS ====================== */
  
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch fresh user profile from server (not stale localStorage)
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await fetch('/api/blueprints', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
  }, []);

  const dummyBlueprints = [
     { id: 1, name: "Sistem Inventori Desentralisasi", type: "Fullstack Web App", time: "2 jam lalu" },
     { id: 2, name: "Web3 Wallet Tracker", type: "Mobile App", time: "Kemarin" },
     { id: 3, name: "API Node Runner", type: "API Service", time: "3 hari lalu" },
  ];

  const allBlueprints = blueprints.length > 0 ? blueprints.map(b => ({
     id: b.id, name: b.name, type: b.type, time: new Date(b.createdAt).toLocaleDateString()
  })) : dummyBlueprints;

  const displayBlueprints = searchQuery.trim()
    ? allBlueprints.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allBlueprints;

  const getPlanInfo = () => {
     const plan = userProfile?.plan;
     if (!plan) return 'PRD Starter';
     if (plan === 'STARTER') return 'PRD Starter';
     if (plan === 'PRO') return 'PRD Pro';
     if (plan === 'FREE') return 'PRD Free';
     return plan;
  };

  const getQuotaInfo = () => {
     if (userProfile?.quota && typeof userProfile.quota === 'object') {
       return `(Sisa ${userProfile.quota.remaining}/${userProfile.quota.limit} PRD hari ini)`;
     }
     if (typeof userProfile?.quota === 'number') {
       return `(Sisa ${userProfile.quota} PRD hari ini)`;
     }
     return '(Memuat kuota...)';
  };

  const renderDashboardHome = () => (
    <div className="p-8 lg:p-14 text-white max-w-6xl mx-auto w-full flex-1 flex flex-col">
       <div className="mb-12 border-b border-white/5 pb-8 flex justify-between items-end shrink-0">
          <div>
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2">Pusat Blueprints</h1>
            <p className="text-gray-400 text-lg font-medium">Buka dan tinjau kembali arsitektur proyekmu sebelumnya.</p>
          </div>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Temukan nama proyek..." className="bg-[#111111] border border-white/5 rounded-full pl-12 pr-6 py-4 text-sm font-medium w-72 focus:outline-none focus:border-white/20 transition-colors text-white" />
          </div>
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 shrink-0 pb-12">
          
          {/* Status Akun */}
          <div className="xl:col-span-4 p-8 lg:p-10 rounded-[40px] bg-[#111111] border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between relative overflow-hidden shadow-xl self-start">
             <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 blur-[50px] rounded-full pointer-events-none" />
             <div className="flex justify-between items-center mb-6 relative z-10 w-full">
                <div className="text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Status Akun Aktif {userProfile?.name ? `- ${userProfile.name}` : ''}</div>
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-gray-300 font-bold text-[10px] md:text-[12px] uppercase tracking-widest border border-white/20">
                  <Activity className="w-3.5 h-3.5 mr-2" /> {getPlanInfo()}
                </div>
             </div>
             <div className="relative z-10 mt-auto pt-8">
                <div className="text-4xl md:text-5xl font-extrabold text-white mb-3">Rp20.000 <span className="text-xl md:text-2xl text-gray-500 font-medium">/bln</span></div>
                <div className="text-xs md:text-sm font-medium text-gray-400 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white text-black animate-pulse"></div> Modul AI Premium aktif {getQuotaInfo()}
                </div>
             </div>
          </div>

          {/* Telemetry Stream Chart */}
          <div className="xl:col-span-8 p-8 lg:p-10 rounded-[40px] bg-[#0A0A0A] backdrop-blur-2xl border border-white/5 shadow-2xl relative overflow-hidden flex flex-col h-full group">
            <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[150%] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 relative z-10 gap-6 shrink-0">
               <div className="shrink-0">
                 <div className="text-gray-500 font-extrabold uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Telemetry Stream
                 </div>
                 <h3 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 flex items-center gap-3">
                   <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl shadow-inner shrink-0">
                     <Activity className="w-5 h-5 text-cyan-400" />
                   </div>
                   <span className="truncate">Network Traffic & Operations</span>
                 </h3>
               </div>
               <div className="flex gap-4 md:gap-6 p-4 bg-black/40 border border-white/5 rounded-2xl shadow-inner shrink-0 overflow-x-auto custom-scrollbar">
                 <div className="flex items-center gap-3 shrink-0">
                   <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                     <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]"></span>
                   </div>
                   <div>
                     <div className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Successful</div>
                     <div className="text-xs md:text-sm font-black text-white">Payloads</div>
                   </div>
                 </div>
                 <div className="w-px bg-white/10 shrink-0"></div>
                 <div className="flex items-center gap-3 shrink-0">
                   <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-violet-500/10 border border-violet-500/20 shrink-0">
                     <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-violet-400 shadow-[0_0_15px_rgba(167,139,250,0.8)]"></span>
                   </div>
                   <div>
                     <div className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Rejected</div>
                     <div className="text-xs md:text-sm font-black text-white">Rate Limits</div>
                   </div>
                 </div>
               </div>
            </div>
            
            <div className="min-h-[250px] md:min-h-[280px] w-full relative z-10 flex-1 pt-4" style={{ filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' }}>
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={[
                    { time: '00:00', sent: 120, failed: 5, active: 40 },
                    { time: '04:00', sent: 340, failed: 22, active: 85 },
                    { time: '08:00', sent: 1100, failed: 65, active: 150 },
                    { time: '12:00', sent: 1800, failed: 88, active: 200 },
                    { time: '16:00', sent: 2350, failed: 120, active: 175 },
                    { time: '20:00', sent: 3800, failed: 215, active: 120 },
                    { time: '24:00', sent: 4200, failed: 180, active: 60 },
                 ]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorSentPremium" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4}/>
                       <stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorFailedPremium" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                       <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.06)" vertical={false} />
                   <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={11} fontWeight="bold" tickMargin={15} axisLine={false} tickLine={false} />
                   <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={(val) => `${val}`} />
                   <RechartsTooltip 
                     contentStyle={{ backgroundColor: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                     itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: '900' }}
                     labelStyle={{ color: '#888', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}
                     cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }}
                   />
                   <Area type="monotone" dataKey="sent" name="Successful" stroke="#22d3ee" strokeWidth={4} fillOpacity={1} fill="url(#colorSentPremium)" style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.5))' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#22d3ee', style: { filter: 'drop-shadow(0 0 10px rgba(34,211,238,1))' } }} />
                   <Area type="monotone" dataKey="failed" name="Failed" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorFailedPremium)" style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.5))' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#8b5cf6', style: { filter: 'drop-shadow(0 0 10px rgba(139,92,246,1))' } }} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Project Entities Table */}
          <div className="xl:col-span-12 bg-[#111111] rounded-[40px] border border-white/5 flex flex-col shadow-2xl relative overflow-hidden">
             <div className="grid grid-cols-12 px-6 md:px-10 py-6 border-b border-white/5 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest bg-black/20">
               <div className="col-span-1">No</div>
               <div className="col-span-6 md:col-span-5">Entitas Proyek</div>
               <div className="col-span-5 md:col-span-3 text-right md:text-left">Tipe Platform</div>
               <div className="hidden md:block col-span-3 text-right">Rekam Waktu</div>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar">
               {displayBlueprints.map((item, i) => (
                 <div key={item.id} className="grid grid-cols-12 px-6 md:px-10 py-6 md:py-8 border-b border-white/5 items-center hover:bg-white/5 transition-colors cursor-pointer group">
                   <div className="col-span-1 text-gray-500 font-bold text-sm">{i+1}</div>
                   <div className="col-span-6 md:col-span-5 font-bold text-sm md:text-lg text-gray-200 group-hover:text-gray-300 transition-colors pr-4">{item.name}</div>
                   <div className="col-span-5 md:col-span-3 text-xs md:text-sm font-medium text-gray-400 text-right md:text-left">
                     <span className="px-3 md:px-5 py-1.5 md:py-2.5 bg-black/40 rounded-full border border-white/5 inline-block text-center">{item.type}</span>
                   </div>
                   <div className="hidden md:block col-span-3 text-sm font-medium text-gray-500 text-right">{item.time}</div>
                 </div>
               ))}
             </div>
          </div>

       </div>
    </div>
  );



  const renderBuilder = () => (
    <div className="h-full flex flex-col lg:flex-row w-full bg-[#000000]">
      {/* FORM KIRI */}
      <div className={`w-full lg:w-[500px] border-r border-white/5 bg-[#0A0A0A] flex flex-col flex-shrink-0 z-20 ${builderStep !== 'standby' ? 'opacity-30 pointer-events-none' : ''}`}>
         <div className="p-8 lg:p-10 border-b border-white/5 shrink-0 bg-[#000000] flex justify-between items-center">
            <div>
               <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">Build Project</h2>
               <p className="text-gray-400 font-medium text-sm">Persiapkan parameter sebelum AI memprosesnya ke tingkat lanjut.</p>
            </div>
            <button type="button" onClick={() => setActiveView('upgrade')} className="px-5 py-2 bg-white hover:bg-gray-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] text-[11px] font-bold uppercase tracking-widest rounded-full transition-all">
               Upgrade Plan
            </button>
         </div>
         <form onSubmit={handleSetupSubmit} className="flex-1 p-8 lg:p-10 flex flex-col gap-10 overflow-y-auto">
            <div className="space-y-4">
               <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Platform Utama</label>
               <div className="grid grid-cols-2 gap-3">
                 {['Fullstack Web App', 'Frontend Only', 'Mobile App', 'API Service Only'].map((type) => (
                   <button key={type} type="button" onClick={() => setProjectType(type)}
                     className={`px-4 py-4 rounded-2xl border text-sm font-bold transition-all text-left ${projectType === type ? 'border-white/20 bg-white/10 text-white' : 'border-white/5 bg-[#111111] text-gray-400 hover:text-white'}`}
                   >
                     {type}
                   </button>
                 ))}
               </div>
            </div>

            <div className="space-y-4">
               <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Identitas Entitas</label>
               <input type="text" required value={projectName} onChange={(e)=>setProjectName(e.target.value)}
                  placeholder="Beri nama proyekmu..."
                  className="w-full bg-[#111111] border border-white/5 rounded-2xl p-5 text-[15px] text-white focus:outline-none focus:border-white/20 transition-colors font-medium"
               />
            </div>

            <div className="space-y-4">
               <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Deskripsi Inti Basis Kode</label>
               <textarea required rows={5} value={projectDescription} onChange={(e)=>setProjectDescription(e.target.value)}
                  placeholder="Ceritakan fitur utama, tujuan platform, dsb..."
                  className="w-full bg-[#111111] border border-white/5 rounded-3xl p-5 text-[15px] text-white focus:outline-none focus:border-white/20 transition-colors font-medium resize-none leading-relaxed"
               />
            </div>

            <div className="space-y-4 opacity-90">
               <div className="flex items-center justify-between">
                 <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Penentu Tumpukan (Tech-Stack)</label>
                 <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-full border border-white/5">
                   <button type="button" onClick={() => setIsAiChoice(true)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors ${isAiChoice ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>Otomatis via AI</button>
                   <button type="button" onClick={() => setIsAiChoice(false)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors ${!isAiChoice ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>Pilih Terpisah</button>
                 </div>
               </div>

               <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ${isAiChoice ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                 <div>
                   <label className="text-[11px] font-bold text-gray-600 block mb-2">Frontend</label>
                   <select value={techStack.frontend} onChange={(e)=>handleStackChange('frontend', e.target.value)}
                     className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-white/20 appearance-none font-bold"
                   >
                     <option>React / Vite</option>
                     <option>Next.js</option>
                     <option>Vue.js / Nuxt</option>
                     <option>SvelteKit</option>
                     <option>Native (Android/iOS)</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-gray-600 block mb-2">Backend</label>
                   <select value={techStack.backend} onChange={(e)=>handleStackChange('backend', e.target.value)}
                     className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-white/20 appearance-none font-bold"
                   >
                     <option>Node.js/Express</option>
                     <option>Python/Django</option>
                     <option>Go / Fiber</option>
                     <option>PHP / Laravel</option>
                     <option>Serverless (Edge)</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-gray-600 block mb-2">Database</label>
                   <select value={techStack.database} onChange={(e)=>handleStackChange('database', e.target.value)}
                     className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-white/20 appearance-none font-bold"
                   >
                     <option>PostgreSQL</option>
                     <option>MySQL</option>
                     <option>MongoDB</option>
                     <option>Redis</option>
                     <option>Firebase / Supabase</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-[11px] font-bold text-gray-600 block mb-2">Deployment</label>
                   <select value={techStack.deployment} onChange={(e)=>handleStackChange('deployment', e.target.value)}
                     className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-white/20 appearance-none font-bold"
                   >
                     <option>Vercel</option>
                     <option>AWS / EC2</option>
                     <option>DigitalOcean (VPS)</option>
                     <option>Railway / Render</option>
                     <option>Cloudflare Pages</option>
                   </select>
                 </div>
               </div>
            </div>

            <button type="submit" disabled={!projectName || !projectDescription} className="mt-8 w-full py-5 rounded-full bg-white text-black font-extrabold hover:scale-105 transition-transform disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2">
              Lanjutkan Evaluasi <ArrowRight className="w-5 h-5 ml-1" />
            </button>
         </form>
      </div>

      {/* DASH KANAN (Dinamic) */}
      <div className="flex-1 h-full bg-[#000000] relative z-10 overflow-hidden flex flex-col justify-center">
         
         <AnimatePresence mode="wait">
           {builderStep === 'standby' && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-10 text-center w-full flex flex-col items-center">
               <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                 <Settings className="w-8 h-8 text-gray-400" />
               </div>
               <h3 className="text-2xl font-bold tracking-tight text-white mb-3">Menunggu Masukan Data</h3>
               <p className="text-gray-500 font-medium max-w-sm">Berikan rincian proyek pada panel kiri agar sistem dapat merespon komputasi arsitektur Anda.</p>
             </motion.div>
           )}

           {builderStep === 'quiz' && (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full h-full max-w-4xl mx-auto flex flex-col pb-20 justify-center px-10">
               <div className="mb-14">
                 <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 text-gray-300 font-bold text-xs uppercase tracking-widest mb-6 border border-white/10">
                   Fase Integrasi Ke {currentQuizIndex + 1}/{QUIZ_QUESTIONS.length}
                 </div>
                 <h2 className="text-4xl lg:text-[44px] font-extrabold tracking-tight text-white leading-tight mb-4">
                   {QUIZ_QUESTIONS[currentQuizIndex].title}
                 </h2>
                 {QUIZ_QUESTIONS[currentQuizIndex].type === 'multi' && <p className="text-gray-500 font-medium text-lg">Pilihan ganda diizinkan.</p>}
               </div>

               <div className="mb-16 min-h-[140px]">
                 {QUIZ_QUESTIONS[currentQuizIndex].type === 'input' ? (
                   <textarea rows={3} value={(quizAnswers[QUIZ_QUESTIONS[currentQuizIndex].id] as string)||''} onChange={(e)=>handleQuizAnswer(QUIZ_QUESTIONS[currentQuizIndex].id, e.target.value, 'input')}
                     className="w-full bg-[#111111] border-2 border-white/5 rounded-3xl p-6 text-xl text-white focus:outline-none focus:border-white/20 transition-colors resize-none"
                     placeholder="Tulis pemikiranmu secara leluasa..."
                   />
                 ) : (
                   <div className="flex flex-wrap gap-4">
                     {QUIZ_QUESTIONS[currentQuizIndex].options?.map(opt => {
                       const isSel = QUIZ_QUESTIONS[currentQuizIndex].type === 'single' ? quizAnswers[QUIZ_QUESTIONS[currentQuizIndex].id] === opt : ((quizAnswers[QUIZ_QUESTIONS[currentQuizIndex].id] as string[]) || []).includes(opt);
                       return (
                         <button key={opt} onClick={() => handleQuizAnswer(QUIZ_QUESTIONS[currentQuizIndex].id, opt, QUIZ_QUESTIONS[currentQuizIndex].type)}
                           className={`px-8 py-5 rounded-[24px] border border-white/5 font-bold text-lg transition-all shadow-sm ${isSel ? 'bg-white text-black border-white/20' : 'bg-[#111111] text-gray-400 hover:bg-white/10 hover:text-white'}`}
                         >
                           {opt}
                         </button>
                       )
                     })}
                   </div>
                 )}
               </div>

               <div className="flex items-center gap-6">
                 {currentQuizIndex === QUIZ_QUESTIONS.length - 1 ? (
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
                <h3 className="text-2xl font-bold tracking-tight text-white mb-6">Membangun Fondasi...</h3>
                <div className="w-full h-2 rounded-full border border-white/10 bg-[#111111] overflow-hidden mb-6 relative">
                  <motion.div className="absolute top-0 bottom-0 left-0 bg-white text-black" initial={{width: "0%"}} animate={{width: "100%"}} transition={{duration: 10, ease: "linear"}} />
                </div>
                <div className="inline-flex px-6 py-2 rounded-full bg-white/5 border border-white/5 text-gray-400 text-sm font-bold">
                  {LOADING_SEQUENCE[loadingStep]}
                </div>
             </motion.div>
           )}

           {builderStep === 'result' && prdResult && (
             <motion.div initial={{opacity:0}} animate={{opacity:1}} className="absolute inset-0 w-full h-full bg-[#000000] overflow-y-auto custom-scrollbar flex flex-col">
                <div className="sticky top-0 z-50 bg-[#000000]/90 backdrop-blur-3xl border-b border-white/5 p-8 px-12 flex flex-col lg:flex-row justify-between items-center gap-6 shadow-2xl">
                   <div>
                     <div className="text-gray-300 text-xs font-bold uppercase tracking-widest mb-1">Blueprint Lengkap</div>
                     <h2 className="text-3xl font-extrabold text-white tracking-tight">{projectName}</h2>
                   </div>
                   <div className="flex gap-4">
                     <button onClick={handleCopy} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full font-bold text-white text-sm transition-colors border border-white/5 flex items-center gap-2">
                        {isCopied ? <Check className="w-4 h-4 text-gray-300"/> : <Copy className="w-4 h-4"/>} {isCopied ? 'Tersalin' : 'Salin Semua'}
                     </button>
                     <button onClick={handleExportText} className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-full font-extrabold text-sm transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4"/> Unduh (.md)
                     </button>
                   </div>
                </div>

                <div className="p-12 lg:p-20 max-w-5xl mx-auto w-full">
                   <div className="prose prose-invert prose-lg max-w-none prose-headings:tracking-tight prose-headings:font-extrabold prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-12 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-4 prose-a:text-gray-300 prose-pre:bg-[#111111] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-3xl prose-code:font-mono prose-code:text-gray-300">
                     <Markdown components={{ code({ node, inline, className, children, ...props }:any) { const match = /language-(\w+)/.exec(className||''); if (!inline && match && match[1] === 'mermaid') return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />; return <code className={`${className} bg-white/5 px-1.5 py-0.5 rounded font-bold text-gray-300`} {...props}>{children}</code>; } }}>
                       {prdResult}
                     </Markdown>
                   </div>
                </div>
             </motion.div>
           )}
         </AnimatePresence>

      </div>
    </div>
  );

  return (
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
           <button onClick={() => {setActiveView('builder'); setBuilderStep('standby');}} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'builder' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
             <Layers className="w-5 h-5" /> <span className="hidden lg:block">Build Project</span>
           </button>
           <button onClick={() => setActiveView('build_code')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'build_code' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
             <Code2 className="w-5 h-5" /> <span className="hidden lg:block">Build Code</span>
           </button>
           <button onClick={() => setActiveView('auto_promo')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-[15px] ${activeView === 'auto_promo' ? 'bg-white/10 text-gray-300' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
             <Megaphone className="w-5 h-5" /> <span className="hidden lg:block">Auto Promotion</span>
           </button>
        </div>

        <div className="p-4 border-t border-white/5 mt-auto">
          <button onClick={() => { localStorage.removeItem('isLoggedIn'); localStorage.removeItem('auth_token'); localStorage.removeItem('user'); navigate('/'); }} className="w-full flex items-center justify-center lg:justify-start gap-4 px-4 py-3.5 rounded-2xl text-gray-500 hover:text-white hover:bg-white/5 transition-all font-bold text-[15px]">
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
         {activeView === 'build_code' && <BuildCode />}
         {activeView === 'auto_promo' && <AutoPromotion />}
         {activeView === 'upgrade' && (
           <div className="p-8 lg:p-14 text-white max-w-6xl mx-auto w-full">
             <div className="mb-12 border-b border-white/5 pb-8">
               <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2">Paket Langganan PRD</h1>
               <p className="text-gray-400 text-lg font-medium">Pilih kapasitas engine yang sesuai dengan kebutuhanmu.</p>
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
                 <button className="w-full py-4 rounded-full bg-white/5 text-gray-400 font-bold border border-white/5 cursor-default">Plan Saat Ini</button>
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
                 <button className="w-full py-4 rounded-full bg-white text-black font-bold hover:shadow-[0_8px_25px_rgba(255,255,255,0.2)] transition-all hover:-translate-y-1">Dapatkan Starter</button>
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
                 <button className="w-full py-4 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-colors hover:-translate-y-1">Beli Paket Pro</button>
               </motion.div>

             </div>
           </div>
         )}
      </main>
    </div>
  );
}
