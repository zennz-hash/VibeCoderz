import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Image as ImageIcon, FileText, File, Sparkles, Loader2, Download, Terminal, ChevronRight, Code2, MonitorPlay, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
  useSandpack
} from "@codesandbox/sandpack-react";

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  attachedFiles?: string[];
};

type GenStatus = 'idle' | 'analyzing' | 'building' | 'done';

const uiFilesGlob = import.meta.glob('./ui/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Transform glob format to Sandpack files structure
const prebuiltUiComponents: Record<string, { code: string }> = {};
let availableComponentsList = 'AVAILABLE PRE-BUILT UI COMPONENTS:\n';

Object.entries(uiFilesGlob).forEach(([path, code]) => {
  // Convert './ui/Animations/X/X.tsx' to '/components/ui/Animations/X/X.tsx'
  const sandpackPath = path.replace('./ui/', '/components/ui/');
  prebuiltUiComponents[sandpackPath] = { code, hidden: true };
  availableComponentsList += `- ${sandpackPath}\n`;
});

const DEFAULT_FILES = {
  ...prebuiltUiComponents,
  "/public/index.html": {
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
    hidden: true
  },
  "/App.tsx": {
    code: `import React from 'react';

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
        AI Ready! Silakan instruksikan, UI Components telah termuat.
      </h1>
    </div>
  );
}
`
  }
};

// ============================================================
// AUTO-CORRECTION: Sandpack Error Interceptor (with debounce)
// ============================================================
const SandpackErrorInterceptor = ({ onAutoFix }: { onAutoFix: (errorMsg: string) => void }) => {
  const { sandpack } = useSandpack();
  const lastErrorRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentErrorText = sandpack.error?.message;
    if (currentErrorText && currentErrorText !== lastErrorRef.current) {
      lastErrorRef.current = currentErrorText;
      /* Debounce 3s so that Sandpack finishes bundling before we declare it a real error */
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (currentErrorText.toLowerCase().includes('error') || currentErrorText.includes('Could not find')) {
          onAutoFix(currentErrorText);
        }
      }, 3000);
    } else if (!currentErrorText) {
      lastErrorRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [sandpack.error, onAutoFix]);

  return null;
};

export default function BuildCode() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Halo! IDE AI VibeCoderz sudah aktif. Model: Llama-3.3-70B-Versatile (Groq). Saya bisa membangun aplikasi React lengkap dari instruksi Anda, atau dari referensi dokumen (.md/.txt) yang Anda unggah. Coba berikan instruksi spesifik!'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [genStatus, setGenStatus] = useState<GenStatus>('idle');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('code');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [attachedFilesData, setAttachedFilesData] = useState<{name: string, content: string}[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoFixCount, setAutoFixCount] = useState(0);
  const [sandboxFiles, setSandboxFiles] = useState<any>(DEFAULT_FILES);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, logs]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
         const reader = new FileReader();
         reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
               setAttachedFilesData(prev => [...prev, { name: file.name, content: event.target!.result as string }]);
               setAttachedFiles(prev => [...prev, file.name]);
            }
         };
         reader.readAsText(file);
      });
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  // ============================================================
  // UTILITY: Clean raw AI output to valid JSON string
  // ============================================================
  const cleanJsonResponse = (raw: string): string => {
    let cleaned = raw.trim();
    /* Strip ALL markdown code fences globally */
    cleaned = cleaned.replace(/```(?:json|JSON)?\s*\n?/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.trim();
    /* Remove any leading text before the first '{' (basa-basi) */
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    /* Remove single-line JS comments that break JSON */
    cleaned = cleaned.replace(/\/\/[^\n]*/g, '');
    /* Remove trailing commas before } or ] */
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    return cleaned;
  };

  // ============================================================
  // UTILITY: Sanitize generated files for Sandpack compatibility
  // ============================================================
  const sanitizeForSandpack = (files: Record<string, any>): Record<string, {code: string}> => {
    const sandpackFormat: Record<string, {code: string}> = {};
    const blockedPrefixes = ['/server/', '/api/', '/node_modules/', '/dist/', '/build/', '/prisma/'];
    const blockedFiles = ['/package.json', '/tsconfig.json', '/vite.config.ts', '/next.config.js', '/tailwind.config.js', '/postcss.config.js', '/package-lock.json'];

    for (const [rawPath, codeText] of Object.entries(files)) {
      if (typeof codeText !== 'string') continue;
      
      let formattedPath = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
      /* Strip src/ prefix that AI likes to hallucinate */
      formattedPath = formattedPath.replace(/^\/src\//, '/');
      /* Strip app/ prefix (Next.js hallucination) */
      formattedPath = formattedPath.replace(/^\/app\//, '/components/');
      /* Strip pages/ prefix */
      formattedPath = formattedPath.replace(/^\/pages\//, '/components/');

      if (blockedPrefixes.some(p => formattedPath.startsWith(p))) continue;
      if (blockedFiles.includes(formattedPath)) continue;
      if (formattedPath.endsWith('.json') || formattedPath.endsWith('.lock') || formattedPath.endsWith('.prisma')) continue;

      let finalCode = codeText;

      /* Force React 18 createRoot if AI uses legacy ReactDOM.render */
      if ((formattedPath === '/index.tsx' || formattedPath === '/index.jsx') && finalCode.includes('ReactDOM.render')) {
        finalCode = [
          "import React from 'react';",
          "import { createRoot } from 'react-dom/client';",
          "import App from './App';",
          "import './index.css';",
          "",
          "createRoot(document.getElementById('root')!).render(<App />);"
        ].join('\n');
      }

      sandpackFormat[formattedPath] = { code: finalCode };
    }

    /* Ensure /App.tsx always exists */
    if (!sandpackFormat['/App.tsx'] && !sandpackFormat['/App.jsx']) {
      const componentFiles = Object.keys(sandpackFormat).filter(p => p.startsWith('/components/') && !p.includes('/ui/'));
      if (componentFiles.length > 0) {
        const imports = componentFiles.map(f => {
          const baseName = f.replace('/components/', '').replace(/\.(tsx|jsx)$/, '');
          const safeName = baseName.replace(/[^a-zA-Z0-9]/g, '');
          return { path: f.replace(/\.(tsx|jsx)$/, ''), safeName };
        });
        const importLines = imports.map(i => `import ${i.safeName} from '${i.path.startsWith('.') ? i.path : '.' + i.path}';`).join('\n');
        const mainComp = imports[0].safeName;
        sandpackFormat['/App.tsx'] = {
          code: `import React from 'react';\n${importLines}\n\nexport default function App() {\n  return <${mainComp} />;\n}`
        };
      } else {
        sandpackFormat['/App.tsx'] = {
          code: "import React from 'react';\n\nexport default function App() {\n  return (\n    <div style={{display:'flex',minHeight:'100vh',alignItems:'center',justifyContent:'center',background:'#0a0a0a',color:'#fff'}}>\n      <h1>Error: AI gagal membuat App.tsx</h1>\n    </div>\n  );\n}"
        };
      }
    }

    /* Ensure /index.css exists with Tailwind base */
    if (!sandpackFormat['/index.css'] && !sandpackFormat['/styles.css'] && !sandpackFormat['/globals.css']) {
      sandpackFormat['/index.css'] = {
        code: '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }'
      };
    }

    return sandpackFormat;
  };

  // ============================================================
  // CORE: fetchFromGroq - AI Code Generation Engine
  // ============================================================
  const fetchFromGroq = async (prompt: string, fileData: {name: string, content: string}[] = []) => {

    addLog("Membangun sambungan HTTPS langsung ke api.groq.com...");
    addLog("Mempersiapkan Payload arsitektur JSON-Mode...");

    const systemInstruction = `Lu adalah mesin generator kode React FULL-STACK untuk lingkungan Sandpack (Vite + React + TypeScript). Lu BUKAN chatbot. DILARANG KERAS mengobrol. Output lu SELALU dan HANYA berupa 1 objek JSON MURNI.

<wajib_format>
Output lu HARUS DIMULAI dengan karakter { dan DIAKHIRI dengan karakter }.
TIDAK BOLEH ada teks apapun sebelum { atau sesudah }.
TIDAK BOLEH dibungkus dengan markdown code blocks.

Struktur JSON:
{"project_name": "nama", "files": {"/App.tsx": "kode...", "/components/NamaKomponen.tsx": "kode..."}}
</wajib_format>

<aturan_path>
- Path WAJIB dimulai dengan / (root) atau /components/.
- DILARANG menggunakan awalan /src/, /app/, /pages/, /server/, /api/, /public/.
- File konfigurasi (package.json, tsconfig, vite.config) DILARANG ada di output.
</aturan_path>

<aturan_kode>
1. SETIAP file komponen WAJIB menggunakan DEFAULT EXPORT:
   export default function NamaKomponen() { return (...); }

2. Di /App.tsx, import komponen TANPA kurung kurawal:
   import NamaKomponen from './components/NamaKomponen';
   BUKAN: import { NamaKomponen } from './components/NamaKomponen';

3. Kode WAJIB multi-baris (gunakan \\n). DILARANG menulis semua kode dalam 1 baris.

4. DILARANG menggunakan komentar satu baris (//). Gunakan /* */ jika perlu.

5. Gunakan Tailwind CSS class untuk styling. Buat desain MODERN, PREMIUM, DARK-MODE.

6. Gunakan dummy/mock data array langsung di dalam komponen untuk simulasi data.

7. SEMUA TypeScript type harus inline. Jangan buat file .d.ts terpisah.

8. Paket NPM yang tersedia: react, lucide-react, framer-motion, react-router-dom, clsx, recharts, axios.
   Lu BOLEH import dari paket-paket ini.
</aturan_kode>

<contoh_output_benar>
{"project_name": "dashboard", "files": {"/App.tsx": "import React from 'react';\\nimport Dashboard from './components/Dashboard';\\n\\nexport default function App() {\\n  return <Dashboard />;\\n}", "/components/Dashboard.tsx": "import React from 'react';\\nimport { Activity } from 'lucide-react';\\n\\nexport default function Dashboard() {\\n  return (\\n    <div className=\\\"min-h-screen bg-gray-950 text-white p-8\\\">\\n      <h1 className=\\\"text-3xl font-bold\\\">Dashboard</h1>\\n    </div>\\n  );\\n}"}}
</contoh_output_benar>

<komponen_ui_tersedia>
${availableComponentsList}
Untuk menggunakan komponen di atas, import dari path-nya langsung.
Contoh: import Aurora from './components/ui/Backgrounds/Aurora/Aurora';
</komponen_ui_tersedia>

Susun kode React LENGKAP berdasarkan permintaan user. Kembalikan HANYA objek JSON.`;

    const allMsgs = messages.filter(m => m.id !== 'welcome').map(m => ({
       role: m.role === 'ai' ? 'assistant' : 'user',
       content: m.content
    }));
    
    // Attach file contents directly into the prompt
    let finalPrompt = prompt;
    if (fileData && fileData.length > 0) {
       finalPrompt += "\n\n<knowledge_base>\n";
       fileData.forEach(file => {
          finalPrompt += `--- FILE: ${file.name} ---\n${file.content}\n--- END ---\n\n`;
       });
       finalPrompt += "</knowledge_base>\n\nIngat instruksi JSON di atas!";
    }

    allMsgs.push({ role: 'user', content: finalPrompt });

    try {
       addLog("Menunggu kalkulasi jaringan (Model Llama-3.3-70B via Groq)...");
       
       const res = await fetch("/api/generate-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`
          },
          body: JSON.stringify({
            systemInstruction,
            messages: allMsgs
          })
        });

       if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 200)}`);
       }

       addLog("Data terverifikasi. Transpilasi Token selesai dari Edge Groq...");
       const data = await res.json();
       const rawContent = data.choices[0].message.content;
       
       addLog("Membersihkan JSON response...");
       const jsonCodeStr = cleanJsonResponse(rawContent);
       
       addLog("Parsing JSON Payload...");
       let generatedPayload: any;
       try {
         generatedPayload = JSON.parse(jsonCodeStr);
       } catch (parseErr: any) {
         addLog(`[WARN] JSON parse gagal, mencoba perbaikan lanjutan...`);
         try {
           /* Attempt fix: escape unescaped newlines inside string values */
           const fixedJson = jsonCodeStr
             .replace(/,\s*([}\]])/g, '$1')
             .replace(/([^\\])\\n/g, '$1\\\\n');
           generatedPayload = JSON.parse(fixedJson);
         } catch (e2: any) {
           addLog(`[FATAL] JSON tidak bisa dipulihkan: ${e2.message.substring(0, 100)}`);
           throw new Error('AI menghasilkan JSON yang rusak. Coba ulangi prompt Anda.');
         }
       }

       const generatedStructure = generatedPayload.files || generatedPayload;
       
       addLog("Sanitasi path file untuk kompatibilitas Sandpack...");
       const sandpackFormat = sanitizeForSandpack(generatedStructure);
       
       // SUNTIKKAN KEMBALI UI COMPONENTS KE SANDPACK AGAR BISA DIREKURSIf
       const finalVirtualFileSystem = { ...prebuiltUiComponents, ...sandpackFormat };

       const fileCount = Object.keys(sandpackFormat).length;
       addLog(`Injeksi ${fileCount} berkas virtual ke WebContainers selesai!`);
       setSandboxFiles(finalVirtualFileSystem);
       
       setGenStatus('done');
       setActiveTab('preview');

       setMessages(prev => [...prev, {
         id: Date.now().toString(),
         role: 'ai',
         content: `Berhasil! ${fileCount} file telah di-generate dan diinjeksi ke Sandpack. Klik tab "Preview Frame" untuk melihat hasilnya, atau "Code & Output" untuk menelusuri kodenya.`
       }]);

    } catch (err: any) {
       addLog(`[FATAL] Mesin gagal: ${err.message}`);
       setMessages(prev => [...prev, {
         id: Date.now().toString(),
         role: 'ai',
         content: `Maaf, terjadi error saat generate: ${err.message}. Silakan coba lagi.`
       }]);
       setGenStatus('done');
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() && attachedFiles.length === 0) return;

    // Reset autofix counter on a new manual user request
    setAutoFixCount(0);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const currentPrompt = inputValue;
    const capturedFileData = [...attachedFilesData];
    
    setInputValue('');
    setAttachedFiles([]);
    setAttachedFilesData([]);
    setGenStatus('building');
    setLogs([]);

    // Call the heavy lifter with captured data to avoid race condition
    fetchFromGroq(currentPrompt, capturedFileData);
  };

  const handleAutoFix = (errorMsg: string) => {
    if (autoFixCount >= 2) {
       addLog("[SYSTEM] Permintaan perbaikan otomatis dibatalkan untuk mencegah Infinite Loop (Batas maksimal 2x auto-fix tercapai).");
       return;
    }
    
    setAutoFixCount(prev => prev + 1);
    
    const userMessage: Message = {
      id: Date.now().toString() + "_autofix",
      role: 'user',
      content: `[PESAN SISTEM TEROTOMATISASI]\nAplikasi yang baru saja lu generate mengalami FATAL ERROR pada Sandpack / Vite Compiler:\n\n${errorMsg.slice(0, 300)}...\n\nTolong perbaiki kodenya dan JANGAN ulangi penyebab error yang sama. Ingat aturan Named/Default Export!`
    };

    setMessages(prev => [...prev, userMessage]);
    setGenStatus('building');
    addLog(`[AUTO-FIX] Menjalankan Agen Pemulihan (Mencoba ${autoFixCount + 1}/2)...`);
    
    const fixPrompt = `Perbaiki ERROR berikut pada Sandpack:\n${errorMsg}\nKembalikan HANYA format JSON murni yang berisi seluruh struktur file project tanpa basa-basi!`;
    fetchFromGroq(fixPrompt, attachedFilesData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getFileIcon = (filename: string) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return <ImageIcon className="w-3.5 h-3.5 text-pink-400" />;
    if (filename.match(/\.(pdf)$/i)) return <FileText className="w-3.5 h-3.5 text-red-500" />;
    if (filename.match(/\.(docx|doc)$/i)) return <FileText className="w-3.5 h-3.5 text-blue-500" />;
    if (filename.match(/\.(md|txt)$/i)) return <FileText className="w-3.5 h-3.5 text-gray-300" />;
    return <File className="w-3.5 h-3.5 text-gray-300" />;
  };

  const X_Icon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );

  return (
    <div className="relative h-full w-full flex flex-col md:flex-row bg-[#0A0A0A] overflow-hidden text-gray-200">
      
      {/* --- COMING SOON OVERLAY --- */}
      <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 backdrop-blur-[20px] bg-[#050505]/70 border-l border-white/5">
        <div className="bg-black/60 border border-white/10 rounded-[2rem] p-10 md:p-14 text-center max-w-xl shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
           <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
           
           <div className="relative z-10 flex flex-col items-center">
             <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 mb-4 tracking-tight mt-4">
               Build Code
             </h2>
             
             <div className="inline-flex px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-bold tracking-widest uppercase text-xs mb-6 items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> 
                 Coming Soon
             </div>
             
             <p className="text-gray-400 font-medium leading-relaxed">
               Modul <strong>Autopilot AI Builder</strong> (WebContainer Nodebox) saat ini sedang dalam tahap inspeksi arsitektur keamanan dan pengoptimalan ekosistem serverless.
             </p>
           </div>
        </div>
      </div>
      {/* --------------------------- */}
      
      
      {/* ------------------------------------------- */}
      {/* LEFT PANE: CHAT & PROMPT (W-96) */}
      {/* ------------------------------------------- */}
      <div className={`${isChatOpen ? 'w-full md:w-[380px] lg:w-[420px] border-r border-white/5' : 'w-0 overflow-hidden'} flex flex-col bg-[#050505] shrink-0 relative z-10 box-border transition-all duration-300`}>
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-5 bg-black/60 shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="font-bold text-[14px] text-white">Groq AI Builder (JS)</h2>
          </div>
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5 shadow-2xl">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end w-full">
                      {msg.attachedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#111] border border-white/10 text-gray-300 max-w-full shadow-md">
                          {getFileIcon(file)}
                          <span className="truncate max-w-[150px]">{file}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === 'user' ? (
                     <div className="px-4 py-2.5 rounded-3xl bg-[#EBEBEB] text-black text-[13px] leading-relaxed rounded-tr-sm shadow-xl font-medium">
                       {msg.content}
                     </div>
                  ) : (
                     <div className="px-1 py-1 text-[13.5px] leading-relaxed text-gray-300 font-medium">
                       {msg.content}
                     </div>
                  )}
                </div>
              </motion.div>
            ))}

            {genStatus === 'building' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5 animate-pulse">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="px-1 py-1.5 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                  <span className="text-[13px] text-gray-400 font-mono tracking-tight">Koneksi Groq Live via JSON...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BOX */}
        <div className="p-4 bg-[#0A0A0A] border-t border-white/5">
          {/* UPLOADED FILES CHIPS */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151515] border border-white/10 rounded-lg text-[11px] text-gray-300 max-w-full">
                  <div className="shrink-0">{getFileIcon(file)}</div>
                  <span className="truncate max-w-[150px] font-medium">{file}</span>
                  <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-1 text-gray-500 hover:text-white shrink-0">
                    <X_Icon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="relative flex items-end bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-3xl p-1.5 focus-within:border-white/30 focus-within:bg-[#1A1A1A] transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <label className="p-3 cursor-pointer text-gray-500 hover:text-white transition-colors shrink-0">
               <input type="file" multiple className="hidden" accept=".txt,.pdf,.doc,.docx,.md,image/*" onChange={handleFileUpload} />
               <Paperclip className="w-4 h-4" />
            </label>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={genStatus === 'building'}
              placeholder="Berikan visi kode Anda pada AI Groq..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent text-white text-[13px] resize-none outline-none py-3 px-1 placeholder-gray-500 font-medium disabled:opacity-50"
              rows={inputValue.split('\n').length > 1 ? Math.min(5, inputValue.split('\n').length) : 1}
            />
            <button 
              onClick={handleSend}
              disabled={genStatus === 'building' || (!inputValue.trim() && attachedFiles.length === 0)}
              className={`p-3 rounded-2xl transition-all shrink-0 mb-0.5 mr-0.5 shadow-xl ${
                inputValue.trim() || attachedFiles.length > 0
                  ? 'bg-white text-black hover:bg-gray-200' 
                  : 'bg-white/5 text-gray-600'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- */}
      {/* RIGHT PANE: 100% EXCLUSIVE DISPLAY SPLIT */}
      {/* ------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full bg-[#000]">
          
        {/* HEADER CONTROLS */}
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-3 md:px-5 bg-[#050505] shrink-0 z-20 shadow-sm relative">
          
          <div className="flex items-center gap-2 z-10 pointer-events-auto">
             <button onClick={() => setIsChatOpen(!isChatOpen)} className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/10">
                {isChatOpen ? <PanelLeftClose className="w-4 h-4"/> : <PanelLeftOpen className="w-4 h-4"/>}
             </button>
          </div>

          {/* TAB TOGGLES: COMPLETELY INDEPENDENT VISIBILITY */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-[#111] p-1 rounded-xl border border-white/5 shadow-inner">
             <button 
               onClick={() => setActiveTab('code')}
               className={`flex items-center gap-2 px-6 py-1.5 rounded-lg text-[12px] font-bold transition-all ${activeTab === 'code' ? 'bg-[#222] text-white shadow-[0_4px_15px_rgba(0,0,0,1)] inset-shadow-sm border border-white/5' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <Code2 className="w-3.5 h-3.5" /> Code & Output
             </button>
             <button 
               onClick={() => setActiveTab('preview')}
               className={`flex items-center gap-2 px-6 py-1.5 rounded-lg text-[12px] font-bold transition-all ${activeTab === 'preview' ? 'bg-white text-black shadow-[0_4px_15px_rgba(255,255,255,0.2)]' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <MonitorPlay className="w-3.5 h-3.5" /> Preview Frame
             </button>
          </div>

          <div className="flex items-center gap-2 px-2 z-10 pointer-events-none">
            <div className="flex gap-1.5 items-center pointer-events-auto opacity-70 hover:opacity-100 transition-opacity mr-4">
               <div className="w-3 h-3 rounded-full bg-red-500"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
               <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            
            <div className="pointer-events-auto">
              {genStatus === 'done' && (
                <button 
                  onClick={() => alert("Simulasi: Berkas siap dibungkus dalam root.zip dan diotomasikan pengunduhan pada Browser!")}
                  className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#111] bg-white hover:bg-gray-200 rounded-full transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  <Download className="w-3.5 h-3.5" /> Export .ZIP
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SANDBOX AREA */}
        <div className="flex-1 relative bg-[#000] overflow-hidden">
          
          {/* TERMINAL LOADING OVERLAY */}
          <AnimatePresence>
            {genStatus === 'building' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-[#050505]/90 backdrop-blur-xl flex flex-col p-8 items-center justify-center"
              >
                <div className="max-w-xl w-full">
                  <div className="flex items-center gap-3 mb-6">
                    <Terminal className="w-5 h-5 text-gray-500" />
                    <h3 className="text-lg font-bold text-white tracking-wide">Groq Sub-routing Execution...</h3>
                    <Loader2 className="w-5 h-5 text-white animate-spin ml-auto" />
                  </div>
                  <div className="bg-[#000] border border-white/5 rounded-2xl p-6 min-h-[350px] font-mono text-[13px] space-y-3 shadow-2xl">
                      {logs.map((log, i) => (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className="flex gap-3 text-gray-400">
                          <ChevronRight className="w-4 h-4 shrink-0 text-[#888] mt-0.5" />
                          <span className="leading-relaxed">{log}</span>
                        </motion.div>
                      ))}
                      <div ref={messagesEndRef} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SANDPACK MOUNT - USING CSS DISPLAY INSTEAD OF CONDITIONAL RENDER TO PRESERVE VM STATE */}
          <div className="absolute inset-0 flex flex-col">
            <style>{`
              .sp-wrapper, .sp-layout, .sp-stack {
                height: 100% !important;
                min-height: 100% !important;
              }
              .sp-layout {
                background: transparent !important;
                border: none !important;
                border-radius: 0 !important;
              }
            `}</style>
            <SandpackProvider 
              template="vite-react-ts" 
              theme="dark"
              files={sandboxFiles}
              customSetup={{
                dependencies: {
                  "lucide-react": "latest",
                  "framer-motion": "latest",
                  "tailwindcss": "latest",
                  "react-router-dom": "latest",
                  "clsx": "latest",
                  "tailwind-merge": "latest",
                  "ogl": "latest",
                  "three": "latest",
                  "@react-three/fiber": "latest",
                  "@react-three/drei": "latest",
                  "@react-three/postprocessing": "latest",
                  "gsap": "latest",
                  "@gsap/react": "latest",
                  "motion": "latest",
                  "lenis": "latest",
                  "mathjs": "latest",
                  "matter-js": "latest",
                  "meshline": "latest",
                  "postprocessing": "latest",
                  "react-icons": "latest",
                  "@use-gesture/react": "latest",
                  "face-api.js": "latest",
                  "recharts": "latest",
                  "axios": "latest"
                }
              }}
              options={{
                activeFile: "/App.tsx"
              }}
            >
              <SandpackErrorInterceptor onAutoFix={handleAutoFix} />
              <SandpackLayout style={{ height: "100%", width: "100%", borderRadius: 0, backgroundColor: 'transparent', border: 'none' }}>
                
                {/* SPLIT 1: CODE EXCLUSIVE */}
                <div style={{ display: activeTab === 'code' ? 'flex' : 'none', height: '100%', width: '100%' }}>
                  <SandpackFileExplorer autoHiddenFiles={true} style={{ height: "100%", width: '260px', borderRight: '1px solid rgba(255,255,255,0.05)' }} />
                  <SandpackCodeEditor 
                    showLineNumbers={true} 
                    showTabs={true} 
                    closableTabs={true}
                    style={{ height: "100%", flex: 1 }} 
                  />
                </div>

                {/* SPLIT 2: PREVIEW EXCLUSIVE */}
                <div style={{ display: activeTab === 'preview' ? 'block' : 'none', height: '100%', width: '100%' }}>
                  <SandpackPreview 
                    showNavigator={true} 
                    showOpenInCodeSandbox={false}
                    style={{ height: "100%", width: "100%" }} 
                  />
                </div>

              </SandpackLayout>
            </SandpackProvider>
          </div>

        </div>
      </div>
    </div>
  );
}
