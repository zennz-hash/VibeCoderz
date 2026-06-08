import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Image as ImageIcon, FileText, File, Loader2, Download, Terminal, ChevronRight, Code2, MonitorPlay, PanelLeftClose, PanelLeftOpen, ChevronDown, LayoutTemplate, BrainCircuit, Wrench, Zap, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackFileExplorer,
  useSandpack,
  useSandpackClient
} from "@codesandbox/sandpack-react";
import { apiFetch, readApiError, userFacingError } from '../utils/api';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  attachedFiles?: string[];
};

type GenStatus = 'idle' | 'analyzing' | 'building' | 'done';

/* Catatan: komponen prebuilt di src/components/ui/** TIDAK lagi diinjeksikan ke Sandpack.
   File-file itu butuh dependency berat (ogl, three, postprocessing, dll.) yang membuat
   preview gagal/lambat. AI diarahkan menulis komponennya sendiri agar hasil pasti runnable. */

const DEFAULT_FILES = {
  /* Override the template's ROOT /index.html (vite-react-ts uses this, NOT /public/index.html).
     Inject Tailwind CDN so all generated Tailwind classes actually render in the preview. */
  "/index.html": {
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
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`,
    hidden: true
  },
  /* Template's /index.tsx imports "./styles.css" — provide it so the import resolves. */
  "/styles.css": {
    code: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { min-height: 100%; background: #0a0a0a; }
body { font-family: system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }`,
    hidden: true
  },
  /* Alias umum kalau AI mengimpor "./index.css" dari App.tsx. */
  "/index.css": {
    code: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { min-height: 100%; background: #0a0a0a; }
body { font-family: system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }`,
    hidden: true
  },
  /* Entry eksplisit + ErrorBoundary: jika App error, tampilkan pesan (BUKAN blank putih). */
  "/index.tsx": {
    code: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: any){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error){ return { error }; }
  render(){
    if (this.state.error) {
      return (
        <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'system-ui', padding:'32px', display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ color:'#f87171', fontWeight:700, fontSize:'18px' }}>⚠ Runtime Error</div>
          <pre style={{ color:'#fca5a5', whiteSpace:'pre-wrap', fontSize:'13px', lineHeight:1.6 }}>{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary><App /></ErrorBoundary>
);`,
    hidden: true
  },
  "/App.tsx": {
    code: `import React from 'react';

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <h1 className="text-2xl font-bold text-white">
        Builder siap. Tulis instruksi Anda untuk membuat aplikasi.
      </h1>
    </div>
  );
}
`
  }
};

// ============================================================
// BRAND MARK — monogram bersih (pengganti logo bintang/AI generik)
// ============================================================
const BrandMark = ({ size = 32, className = '' }: { size?: number; className?: string }) => (
  <div
    className={`relative flex items-center justify-center rounded-xl bg-white text-black ${className}`}
    style={{ width: size, height: size }}
  >
    <span className="font-black tracking-tighter" style={{ fontSize: size * 0.42 }}>VC</span>
  </div>
);

// ============================================================
// AUTO-CORRECTION: Sandpack Error Interceptor (with debounce)
// ============================================================
const SandpackErrorInterceptor = ({ onAutoFix, onTerminalLog }: { onAutoFix: (errorMsg: string) => void, onTerminalLog: (entry: {type: 'error'|'warn'|'info', msg: string}) => void }) => {
  const { sandpack } = useSandpack();
  const lastErrorRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentErrorText = sandpack.error?.message;
    if (currentErrorText && currentErrorText !== lastErrorRef.current) {
      lastErrorRef.current = currentErrorText;
      onTerminalLog({ type: 'error', msg: currentErrorText });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (currentErrorText.toLowerCase().includes('error') || currentErrorText.includes('Could not find')) {
          onAutoFix(currentErrorText);
        }
      }, 3000);
    } else if (!currentErrorText) {
      if (lastErrorRef.current) {
        onTerminalLog({ type: 'info', msg: '✅ Compiled successfully.' });
      }
      lastErrorRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [sandpack.error, onAutoFix, onTerminalLog]);

  return null;
};

const CleanSandpackPreview = () => {
  const { sandpack, iframe } = useSandpackClient({ startRoute: '/' });

  const isBooting = sandpack.status !== 'running';
  const errorMessage = sandpack.error?.message;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0a]">
      <iframe
        ref={iframe}
        title="Sandpack Preview"
        className="h-full w-full border-0 bg-[#0a0a0a]"
      />

      {isBooting && !errorMessage && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            <div>
              <div className="text-sm font-extrabold text-white">Menyiapkan preview...</div>
              <div className="mt-1 text-xs font-medium text-gray-500">App sedang dikompilasi di sandbox.</div>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0a0a0a] p-6 text-white">
          <div className="max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-5">
            <div className="mb-3 text-sm font-extrabold text-red-200">Preview compile error</div>
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-red-100">{errorMessage}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default function BuildCode() {
  const getUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id || user.email || 'guest';
    } catch {
      return 'guest';
    }
  };

  const getUserName = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.name || user.email || 'Developer';
    } catch {
      return 'Developer';
    }
  };

  const storageUserId = React.useMemo(() => getUserId(), []);

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(`vc_buildcode_msgs_${storageUserId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{
      id: 'welcome',
      role: 'ai' as const,
      content: 'Halo! IDE AI VibeCoderz sudah aktif. Pilih model di bawah, lalu bangun aplikasi React lengkap dari instruksi Anda, atau dari referensi dokumen (.md/.txt) yang Anda unggah. Coba berikan instruksi spesifik!'
    }];
  });

  type ProjectHistoryItem = {
    id: string;
    name: string;
    timestamp: number;
    files?: any;
    messages?: Message[];
  };

  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => {
    return [];
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [genStatus, setGenStatus] = useState<GenStatus>('idle');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'terminal'>('code');
  const [terminalLogs, setTerminalLogs] = useState<{type: 'error'|'warn'|'info', msg: string, ts: number}[]>([]);
  /* Terminal sessions dari event compile/runtime Sandpack. */
  type TermLine = { text: string; tone?: 'dim' | 'accent' | 'ok' | 'warn' | 'err' };
  type TermSession = { id: number; name: string; lines: TermLine[]; running: boolean };
  const [termSessions, setTermSessions] = useState<TermSession[]>([]);
  const [activeSession, setActiveSession] = useState<number>(0);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [attachedFilesData, setAttachedFilesData] = useState<{name: string, content: string}[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoFixCount, setAutoFixCount] = useState(0);
  const [sandboxFiles, setSandboxFiles] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(`vc_buildcode_files_${storageUserId}`);
      if (saved) { const parsed = JSON.parse(saved); return { ...DEFAULT_FILES, ...parsed }; }
    } catch {}
    return DEFAULT_FILES;
  });
  const [sandpackKey, setSandpackKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // App State modifications for Claude-like UI
  const [selectedPlatform, setSelectedPlatform] = useState('Web');
  const [selectedModel, setSelectedModel] = useState('Gemini 3.5 Flash');
  const [selectedTech, setSelectedTech] = useState('React + Vite');
  const [showDropdown, setShowDropdown] = useState<'platform' | 'model' | 'tech' | null>(null);

  const isInitialState = messages.length <= 1 && genStatus === 'idle';

  const getSavableFiles = React.useCallback(() => {
    const filesToSave: Record<string, any> = {};
    Object.entries(sandboxFiles).forEach(([path, data]: [string, any]) => {
      if (!path.startsWith('/components/ui/')) filesToSave[path] = data;
    });
    return filesToSave;
  }, [sandboxFiles]);

  const getProjectName = React.useCallback(() => {
    const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Untitled Project';
    return firstUserMsg.replace(/\[Platform:.*\]\n\n/, '').substring(0, 60) || 'Untitled Project';
  }, [messages]);

  /* ═══════════ SESSION PERSISTENCE ═══════════ */
  useEffect(() => {
    apiFetch('/api/code-projects')
      .then(async (res) => {
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows)) return;
        setProjectHistory(rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          timestamp: new Date(row.updatedAt || row.createdAt || Date.now()).getTime(),
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      /* Only save user-generated files, not the huge prebuilt UI components */
      localStorage.setItem(`vc_buildcode_files_${storageUserId}`, JSON.stringify(getSavableFiles()));
    } catch {}
  }, [sandboxFiles, getSavableFiles, storageUserId]);

  useEffect(() => {
    try {
      if (messages.length > 1) {
        localStorage.setItem(`vc_buildcode_msgs_${storageUserId}`, JSON.stringify(messages.slice(-20)));
      }
    } catch {}
  }, [messages, storageUserId]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setTimeout(async () => {
      const name = getProjectName();
      const res = await apiFetch('/api/code-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentProjectId || undefined,
          name,
          files: getSavableFiles(),
          messages: messages.slice(-20),
        }),
      }).catch(() => null);
      if (!res?.ok) return;
      const saved = await res.json().catch(() => null);
      if (!saved?.id) return;
      setCurrentProjectId(saved.id);
      setProjectHistory(prev => {
        const next = [
          { id: saved.id, name: saved.name || name, timestamp: Date.now(), files: getSavableFiles(), messages },
          ...prev.filter(item => item.id !== saved.id),
        ];
        return next.slice(0, 12);
      });
    }, 1600);
    return () => clearTimeout(timer);
  }, [messages, getSavableFiles, getProjectName, currentProjectId]);

  const handleNewProject = async () => {
    if (messages.length > 1) {
      const name = getProjectName();
      const snapshotFiles = getSavableFiles();
      const snapshotMessages = messages.slice(-20);
      const snapshotProjectId = currentProjectId;
      apiFetch('/api/code-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: snapshotProjectId || undefined,
          name,
          files: snapshotFiles,
          messages: snapshotMessages,
        }),
      }).then(async (res) => {
        if (!res.ok) return;
        const saved = await res.json().catch(() => null);
        if (!saved?.id) return;
        setProjectHistory(prev => [
          { id: saved.id, name: saved.name || name, timestamp: Date.now(), files: snapshotFiles, messages: snapshotMessages },
          ...prev.filter(item => item.id !== saved.id),
        ].slice(0, 12));
      }).catch(() => {});
    }

    setCurrentProjectId(null);
    setMessages([{
      id: 'welcome',
      role: 'ai',
      content: 'Halo! IDE AI VibeCoderz sudah aktif. Pilih model di bawah, lalu bangun aplikasi React lengkap dari instruksi Anda, atau dari referensi dokumen (.md/.txt) yang Anda unggah. Coba berikan instruksi spesifik!'
    }]);
    setSandboxFiles(DEFAULT_FILES);
    setGenStatus('idle');
    localStorage.removeItem(`vc_buildcode_msgs_${storageUserId}`);
    localStorage.removeItem(`vc_buildcode_files_${storageUserId}`);
    setSandpackKey(prev => prev + 1);
  };

  const loadProject = async (proj: ProjectHistoryItem) => {
    let project = proj;
    if (!project.files || !project.messages) {
      const res = await apiFetch(`/api/code-projects/${proj.id}`).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        project = {
          id: data.id,
          name: data.name,
          timestamp: new Date(data.updatedAt || Date.now()).getTime(),
          files: data.files,
          messages: data.messages,
        };
      }
    }
    if (!project.files || !project.messages) return;
    setCurrentProjectId(project.id);
    setMessages(project.messages);
    setSandboxFiles({ ...DEFAULT_FILES, ...project.files });
    setGenStatus('done');
    setSandpackKey(prev => prev + 1);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const handleTerminalLog = React.useCallback((entry: {type: 'error'|'warn'|'info', msg: string}) => {
    setTerminalLogs(prev => [...prev.slice(-200), { ...entry, ts: Date.now() }]);
    // Tulis juga ke sesi terminal aktif dari event compile/runtime Sandpack.
    setTermSessions(prev => {
      if (prev.length === 0) return prev;
      const targetId = prev.some(s => s.id === activeSession) ? activeSession : prev[prev.length - 1].id;
      const ts = new Date().toLocaleTimeString();
      const line: TermLine = entry.type === 'error'
        ? { text: `${ts} [sandpack] ✘ ${entry.msg}`, tone: 'err' }
        : entry.type === 'warn'
          ? { text: `${ts} [sandpack] ⚠ ${entry.msg}`, tone: 'warn' }
          : { text: `${ts} [sandpack] runtime event — ${entry.msg}`, tone: 'ok' };
      return prev.map(s => s.id === targetId ? { ...s, lines: [...s.lines, line] } : s);
    });
  }, [activeSession]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, logs]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        if (!file.name.match(/\.(md|txt)$/i)) {
          handleTerminalLog({ type: 'warn', msg: `File ${file.name} dilewati. Hanya .md dan .txt yang didukung.` });
          return;
        }
        if (file.size > 250_000) {
          handleTerminalLog({ type: 'warn', msg: `File ${file.name} terlalu besar. Maksimal 250KB.` });
          return;
        }
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
  // UTILITY: Summarize PRD to essential info only (save tokens)
  // ============================================================
  const summarizePrdForCodeGen = (prdText: string): string => {
    if (prdText.length < 2000) return prdText;

    let summary = prdText;
    /* Strip mermaid diagram blocks (huge token waste) */
    summary = summary.replace(/```mermaid[\s\S]*?```/g, '[DIAGRAM DIHAPUS]');
    /* Strip large code blocks */
    summary = summary.replace(/```[\s\S]*?```/g, '[KODE DIHAPUS]');
    /* Strip markdown tables */
    summary = summary.replace(/\|[^\n]*\|\n(\|[-:| ]+\|\n)?(\|[^\n]*\|\n)*/g, '[TABEL DIHAPUS]\n');
    /* Strip excessive whitespace / blank lines */
    summary = summary.replace(/\n{3,}/g, '\n\n');
    /* Keep only first 4000 chars after cleanup */
    if (summary.length > 4000) {
      summary = summary.substring(0, 4000) + '\n\n[...DIPOTONG UNTUK EFISIENSI TOKEN...]';
    }
    return summary;
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
  // UTILITY: Attempt to repair truncated JSON (missing closing braces)
  // ============================================================
  const repairTruncatedJson = (broken: string): string => {
    let s = broken.trim();
    /* If it doesn't even start with {, bail */
    if (!s.startsWith('{')) return s;

    /* Count open vs close braces and brackets */
    let braces = 0, brackets = 0, inString = false, escape = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') braces++;
      if (c === '}') braces--;
      if (c === '[') brackets++;
      if (c === ']') brackets--;
    }

    /* Remove any trailing incomplete string value */
    if (inString) {
      /* Find the last complete key-value pair */
      const lastCompleteComma = s.lastIndexOf('",');
      const lastCompleteClose = s.lastIndexOf('"}')
      const cutPoint = Math.max(lastCompleteComma, lastCompleteClose);
      if (cutPoint > s.length * 0.3) {
        s = s.substring(0, cutPoint + 1);
        /* Recount */
        braces = 0; brackets = 0; inString = false; escape = false;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (escape) { escape = false; continue; }
          if (c === '\\') { escape = true; continue; }
          if (c === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (c === '{') braces++;
          if (c === '}') braces--;
          if (c === '[') brackets++;
          if (c === ']') brackets--;
        }
      }
    }

    /* Remove trailing comma */
    s = s.replace(/,\s*$/, '');

    /* Close open brackets then braces */
    while (brackets > 0) { s += ']'; brackets--; }
    while (braces > 0) { s += '}'; braces--; }

    return s;
  };

  // ============================================================
  // UTILITY: Multi-stage JSON parsing with recovery
  // ============================================================
  const robustJsonParse = (raw: string): any => {
    /* Stage 1: Direct parse */
    try { return JSON.parse(raw); } catch {}

    /* Stage 2: Clean fences, comments, trailing commas */
    const cleaned = cleanJsonResponse(raw);
    try { return JSON.parse(cleaned); } catch {}

    /* Stage 3: Fix common LLM escape issues */
    try {
      const escaped = cleaned
        .replace(/,\s*([}\]])/g, '$1')
        /* Fix unescaped newlines inside strings */
        .replace(/([^\\])\\n/g, '$1\\\\n')
        /* Fix unescaped tabs */
        .replace(/([^\\])\\t/g, '$1\\\\t');
      return JSON.parse(escaped);
    } catch {}

    /* Stage 4: Repair truncated JSON (auto-close braces) */
    try {
      const repaired = repairTruncatedJson(cleaned);
      return JSON.parse(repaired);
    } catch {}

    /* Stage 5: Last resort — try to extract any valid file entries */
    try {
      const repaired = repairTruncatedJson(cleaned);
      /* Even more aggressive: fix ALL literal newlines inside string values */
      const aggressive = repaired.replace(/(["'])([^"']*?)\n([^"']*?)\1/g, (_, q, a, b) => `${q}${a}\\n${b}${q}`);
      return JSON.parse(aggressive);
    } catch {}

    /* All stages failed */
    return null;
  };

  // ============================================================
  // UTILITY: Sanitize generated files for Sandpack compatibility
  // ============================================================
  const sanitizeForSandpack = (files: Record<string, any>): Record<string, {code: string}> => {
    const sandpackFormat: Record<string, {code: string}> = {};
    const blockedPrefixes = ['/server/', '/api/', '/node_modules/', '/dist/', '/build/', '/prisma/'];
    const blockedFiles = ['/package.json', '/tsconfig.json', '/vite.config.ts', '/next.config.js', '/tailwind.config.js', '/postcss.config.js', '/package-lock.json'];
    const allowedImportRoots = new Set(['react', 'react-dom', 'lucide-react', 'framer-motion', 'clsx']);

    const importRoot = (specifier: string) => {
      if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
      return specifier.split('/')[0];
    };

    const isAllowedImport = (specifier: string) => {
      if (specifier.startsWith('.') || specifier.startsWith('/')) return true;
      if (/^(https?:|data:|blob:)/i.test(specifier)) return false;
      return allowedImportRoots.has(importRoot(specifier));
    };

    const stripDisallowedImports = (source: string, filePath: string) => {
      const blocked = new Set<string>();
      const specifierRegexes = [
        /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
        /\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g,
        /\brequire\(\s*["']([^"']+)["']\s*\)/g,
        /\bimport\(\s*["']([^"']+)["']\s*\)/g,
      ];

      for (const regex of specifierRegexes) {
        let match;
        while ((match = regex.exec(source)) !== null) {
          const specifier = match[1];
          if (specifier && !isAllowedImport(specifier)) blocked.add(specifier);
        }
      }

      if (blocked.size === 0) return source;
      addLog(`[SANITIZE] ${filePath}: import diblokir (${Array.from(blocked).join(', ')}).`);
      return source
        .split('\n')
        .filter((line) => !Array.from(blocked).some((specifier) => line.includes(`'${specifier}'`) || line.includes(`"${specifier}"`)))
        .join('\n');
    };

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
      finalCode = stripDisallowedImports(finalCode, formattedPath);

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

    /* Ensure /styles.css exists (template's /index.tsx imports "./styles.css"). */
    if (!sandpackFormat['/styles.css'] && !sandpackFormat['/index.css'] && !sandpackFormat['/globals.css']) {
      sandpackFormat['/styles.css'] = {
        code: '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\nhtml, body, #root { min-height: 100%; background: #0a0a0a; }\nbody { font-family: system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }'
      };
    }

    return sandpackFormat;
  };

  // ============================================================
  // CORE: fetchCodeStream - Streaming AI Code Generation Engine
  // Architecture inspired by Bolt.new (XML artifact + SSE stream)
  // ============================================================
  const fetchCodeStream = async (prompt: string, fileData: {name: string, content: string}[] = []) => {

    addLog(`Membangun sambungan streaming ke ${selectedModel}...`);
    const systemInstruction = `Kamu adalah mesin generator kode React (Vite + TypeScript) untuk Sandpack browser runtime. Output HARUS berupa satu atau beberapa file menggunakan format tag:
<vcFile path="/App.tsx">
kode lengkap di sini
</vcFile>
<vcFile path="/components/NamaKomponen.tsx">
kode lengkap di sini
</vcFile>

ATURAN WAJIB (PATUHI SEMUA):
1. Hasilkan "/App.tsx" dan boleh tambah file komponen di "/components/*.tsx" bila aplikasi lebih rapi dengan pemisahan komponen.
2. File diawali persis: import React from 'react'; (boleh tambah { useState } dst dari 'react').
3. WAJIB ada "export default function App()" sebagai komponen utama yang merender seluruh halaman.
4. Komponen pembantu boleh berada di file yang sama atau di "/components/*.tsx" dan diimport relatif dari App.
5. Styling pakai Tailwind CSS utility classes (className). Desain modern, rapi, responsif, dark mode.
6. Data contoh inline hanya untuk preview. DILARANG fetch API/asset eksternal. Untuk ikon boleh: import { Nama } from 'lucide-react'.
7. HANYA boleh import dari file lokal yang dibuat sendiri dan package: 'react', 'react-dom', 'lucide-react', 'framer-motion', 'clsx'. JANGAN import library/file lain.
8. Tulis kode LENGKAP sampai tag penutup </vcFile>. DILARANG placeholder, "// ...", atau "lanjutkan".
9. Buat ringkas tapi UTUH agar tidak terpotong. JANGAN menulis penjelasan apa pun di luar tag.
10. Mulai langsung dengan tag <vcFile ...> dan akhiri setiap file dengan </vcFile>.`;

    /* BUG FIX: Limit history to last 2 messages to save tokens for output */
    const allMsgs = messages
      .filter(m => m.id !== 'welcome')
      .slice(-2)
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content.substring(0, 300) /* Aggressively truncate history */
      }));

    /* Summarize the prompt if it looks like a PRD (long markdown) */
    let finalPrompt = prompt;
    if (prompt.length > 2000) {
       addLog(`[OPT] Input terlalu panjang (${prompt.length} karakter), meringkas...`);
       finalPrompt = summarizePrdForCodeGen(prompt);
       addLog(`[OPT] Diringkas menjadi ${finalPrompt.length} karakter.`);
    }

    // Attach file contents directly into the prompt
    if (fileData && fileData.length > 0) {
       finalPrompt += "\n\n<knowledge_base>\n";
       fileData.forEach(file => {
          /* Summarize large file attachments too */
          const content = file.content.length > 2000 ? summarizePrdForCodeGen(file.content) : file.content;
          finalPrompt += `--- FILE: ${file.name} ---\n${content}\n--- END ---\n\n`;
       });
       finalPrompt += "</knowledge_base>";
    }

    allMsgs.push({ role: 'user', content: finalPrompt });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
       addLog(`Streaming real-time dari ${selectedModel}...`);

       const controller = new AbortController();
       abortRef.current = controller;
       timeoutId = setTimeout(() => {
         controller.abort(new DOMException('Request timeout setelah 120 detik. Server sedang sibuk, coba lagi.', 'AbortError'));
       }, 120000);

       const res = await apiFetch("/api/generate-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction,
            messages: allMsgs,
            useStreaming: true,
            modelSelection: selectedModel
          }),
          signal: controller.signal
        });

       if (!res.ok) {
          throw new Error(await readApiError(res, `Server error (${res.status})`));
       }

       // ═══════════ SSE STREAM PARSER ═══════════
       const reader = res.body!.getReader();
       const decoder = new TextDecoder();
       let fullContent = '';
       let sseBuffer = '';
       let filesParsedSoFar = 0;

       addLog("📡 Stream aktif — menerima data...");

       while (true) {
         const { done, value } = await reader.read();
         if (done) break;

         sseBuffer += decoder.decode(value, { stream: true });
         const lines = sseBuffer.split('\n');
         sseBuffer = lines.pop() || '';

         for (const line of lines) {
           if (!line.startsWith('data: ')) continue;
           const data = line.slice(6).trim();
           if (data === '[DONE]') continue;

           try {
             const parsed = JSON.parse(data);
             if (parsed.type === 'chunk') {
               fullContent += parsed.content;
               const currentFileCount = (fullContent.match(/<vcFile\s+path=/g) || []).length;
               if (currentFileCount > filesParsedSoFar) {
                 filesParsedSoFar = currentFileCount;
                 const pathMatches = [...fullContent.matchAll(/<vcFile\s+path=["']([^"']+)["']/g)];
                 const latestPath = pathMatches[pathMatches.length - 1]?.[1] || '';
                 addLog(`📄 [${filesParsedSoFar}] Streaming file: ${latestPath}`);
               }
            } else if (parsed.type === 'finish') {
               addLog(`✅ Stream selesai (reason: ${parsed.reason})`);
             } else if (parsed.type === 'model') {
               if (parsed.requested && parsed.usedLabel && parsed.requested !== parsed.usedLabel) {
                 addLog(`[MODEL] ${parsed.requested} tidak tersedia, fallback ke ${parsed.usedLabel}.`);
               } else if (parsed.usedLabel) {
                 addLog(`[MODEL] Menggunakan ${parsed.usedLabel}.`);
               }
             } else if (parsed.type === 'error') {
               throw new Error(parsed.message);
             }
           } catch (e: any) {
             if (e.message && !e.message.includes('JSON')) throw e;
           }
         }
       }

       addLog(`📦 Total stream: ${fullContent.length} chars`);

       // ═══════════ PARSE XML ARTIFACT TAGS ═══════════
       const parsedFiles: Record<string, string> = {};
       const fileRegex = /<vcFile\s+path=["']([^"']+)["']>\s*([\s\S]*?)\s*<\/vcFile>/g;
       let match;
       while ((match = fileRegex.exec(fullContent)) !== null) {
         const filePath = match[1];
         const fileCode = match[2].trim();
         if (filePath && fileCode) parsedFiles[filePath] = fileCode;
       }

       let fileCount = Object.keys(parsedFiles).length;
       addLog(`🔍 Parsed ${fileCount} files dari XML artifact tags`);

       // Fallback: try legacy JSON parsing if XML fails
       if (fileCount === 0) {
         addLog('[FALLBACK] XML tags tidak ditemukan, mencoba JSON parser...');
         const jsonPayload = robustJsonParse(fullContent);
         if (jsonPayload) {
           const structure = jsonPayload.files || jsonPayload;
           if (typeof structure === 'object') {
             Object.entries(structure).forEach(([path, code]) => {
               if (typeof code === 'string') parsedFiles[path] = code;
             });
             fileCount = Object.keys(parsedFiles).length;
             addLog(`[FALLBACK] JSON parser: ${fileCount} files`);
           }
         }
       }

       if (fileCount === 0) {
         addLog('[FATAL] Tidak ada file yang bisa di-extract.');
         throw new Error('AI tidak menghasilkan file yang valid. Coba sederhanakan instruksi Anda.');
       }

       addLog("Sanitasi path file untuk kompatibilitas Sandpack...");
       const sandpackFormat = sanitizeForSandpack(parsedFiles);
       const finalVirtualFileSystem = { ...DEFAULT_FILES, ...sandpackFormat };
       const finalFileCount = Object.keys(sandpackFormat).length;
       addLog(`✅ Injeksi ${finalFileCount} berkas ke Sandpack selesai!`);
       setSandboxFiles(finalVirtualFileSystem);
       setSandpackKey(prev => prev + 1);

       setGenStatus('done');
       setActiveTab('preview');

       setMessages(prev => [...prev, {
         id: Date.now().toString(),
         role: 'ai',
         content: `✅ Berhasil! ${finalFileCount} file telah di-generate via streaming. Klik tab "Preview" untuk melihat hasilnya, atau "Code" untuk menelusuri kode.`
       }]);

    } catch (err: any) {
       const abortReason = abortRef.current?.signal.reason;
       const stoppedByUser = abortReason instanceof DOMException && abortReason.message.includes('dihentikan');
       const errorMsg = err.name === 'AbortError'
         ? (stoppedByUser ? '⏹️ Generate dihentikan oleh pengguna.' : userFacingError(err, 'Request timeout setelah 120 detik. Server sedang sibuk, coba lagi.'))
         : userFacingError(err, 'Gagal generate kode.');
       addLog(`[FATAL] Mesin gagal: ${errorMsg}`);
       setMessages(prev => [...prev, {
         id: Date.now().toString(),
         role: 'ai',
         content: `❌ ${errorMsg}`
       }]);
       setGenStatus('done');
    } finally {
       if (timeoutId) clearTimeout(timeoutId);
       abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort(new DOMException('Generate dihentikan oleh pengguna.', 'AbortError'));
    setGenStatus('done');
    addLog('⏹️ Membatalkan proses generate...');
  };

  /* ═══════════ TERMINAL PREVIEW SESSIONS ═══════════
     Menampilkan output event Sandpack di tab Terminal (BUKAN di preview). */
  const sessionSeq = useRef(0);
  const sessionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const appendSessionLine = (id: number, line: TermLine) => {
    setTermSessions(prev => prev.map(s => s.id === id ? { ...s, lines: [...s.lines, line] } : s));
  };

  const startDevSession = (id: number) => {
    const boot: { delay: number; line: TermLine }[] = [
      { delay: 150,  line: { text: '$ sandpack preview session', tone: 'dim' } },
      { delay: 500,  line: { text: '' } },
      { delay: 350,  line: { text: '> browser runtime', tone: 'dim' } },
      { delay: 700,  line: { text: '' } },
      { delay: 400,  line: { text: '  Sandpack preview ready', tone: 'accent' } },
      { delay: 200,  line: { text: '' } },
      { delay: 150,  line: { text: '  Runtime: isolated browser iframe', tone: 'ok' } },
      { delay: 150,  line: { text: '  Logs below come from Sandpack compile/runtime events', tone: 'dim' } },
    ];
    let acc = 0;
    boot.forEach(({ delay, line }) => {
      acc += delay;
      const t = setTimeout(() => appendSessionLine(id, line), acc);
      sessionTimers.current.push(t);
    });
    const tDone = setTimeout(() => {
      setTermSessions(prev => prev.map(s => s.id === id ? { ...s, running: true } : s));
    }, acc + 100);
    sessionTimers.current.push(tDone);
  };

  const newTerminalSession = (activate = true) => {
    sessionSeq.current += 1;
    const id = sessionSeq.current;
    setTermSessions(prev => [...prev, { id, name: `preview ${id}`, lines: [], running: false }]);
    setActiveSession(id);
    if (activate) setActiveTab('terminal');
    startDevSession(id);
  };

  // Buat sesi pertama otomatis saat generate selesai, tapi jangan ambil alih tab Preview.
  useEffect(() => {
    if (genStatus === 'done' && termSessions.length === 0) {
      newTerminalSession(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genStatus]);

  useEffect(() => () => { sessionTimers.current.forEach(clearTimeout); }, []);

  const handleSend = () => {
    if (!inputValue.trim() && attachedFiles.length === 0) return;

    // Reset autofix counter on a new manual user request
    setAutoFixCount(0);

    const promptContext = isInitialState
      ? `[Platform: ${selectedPlatform}, Model: ${selectedModel}, Tech: ${selectedTech}]\n\n`
      : '';

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptContext + inputValue,
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    const currentPrompt = promptContext + inputValue;
    const capturedFileData = [...attachedFilesData];

    setInputValue('');
    setAttachedFiles([]);
    setAttachedFilesData([]);
    setLogs([]);

    setGenStatus('building');
    addLog('Memuat & membuat website...');
    fetchCodeStream(currentPrompt, capturedFileData);
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

    const fixPrompt = `Perbaiki ERROR berikut pada Sandpack:\n${errorMsg}\nKembalikan HANYA file-file yang diperbaiki dalam format tag <vcFile path="...">...</vcFile>. JANGAN basa-basi, langsung tulis tag file.`;
    /* BUG FIX: Pass empty array instead of stale attachedFilesData reference */
    fetchCodeStream(fixPrompt, []);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getFileIcon = (filename: string) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return <ImageIcon className="w-3.5 h-3.5 text-gray-400" />;
    if (filename.match(/\.(pdf)$/i)) return <FileText className="w-3.5 h-3.5 text-gray-400" />;
    if (filename.match(/\.(docx|doc)$/i)) return <FileText className="w-3.5 h-3.5 text-gray-400" />;
    if (filename.match(/\.(md|txt)$/i)) return <FileText className="w-3.5 h-3.5 text-gray-300" />;
    return <File className="w-3.5 h-3.5 text-gray-300" />;
  };

  const X_Icon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );

  /* Export ZIP handler */
  const handleExportZip = async () => {
    try {
      const zip = new JSZip();
      const written = new Set<string>();
      Object.entries(sandboxFiles).forEach(([filePath, fileData]: [string, any]) => {
        const code = typeof fileData === 'string' ? fileData : fileData?.code;
        if (code && !filePath.includes('/ui/')) {
          const rel = filePath.replace(/^\//, '');
          zip.file(rel, code);
          written.add(rel);
        }
      });

      /* Entry HTML (root) with Tailwind CDN — runnable with Vite */
      if (!written.has('index.html')) {
        zip.file('index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VibeCoderz Export</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`);
      }

      /* Bootstrap entry if AI didn't produce one */
      if (!written.has('index.tsx') && !written.has('index.jsx')) {
        zip.file('index.tsx', `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);`);
      }
      if (!written.has('styles.css') && !written.has('index.css')) {
        zip.file('styles.css', `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }`);
      }

      zip.file('vite.config.ts', `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });`);

      zip.file('tsconfig.json', JSON.stringify({
        compilerOptions: {
          target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext',
          moduleResolution: 'bundler', jsx: 'react-jsx', strict: false,
          esModuleInterop: true, skipLibCheck: true, noEmit: true
        },
        include: ['.']
      }, null, 2));

      zip.file('README.md', `# VibeCoderz Export

\`\`\`bash
npm install
npm run dev
\`\`\`

Tailwind dimuat via CDN di \`index.html\` (zero-config).`);

      /* package.json */
      zip.file('package.json', JSON.stringify({
        name: 'vibecoderz-export',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^18', 'react-dom': '^18', 'lucide-react': 'latest', 'framer-motion': 'latest', clsx: 'latest' },
        devDependencies: { '@types/react': '^18', '@types/react-dom': '^18', '@vitejs/plugin-react': 'latest', typescript: 'latest', vite: 'latest' }
      }, null, 2));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vibecoderz-project.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export ZIP error:', err);
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col md:flex-row bg-[#0A0A0A] overflow-hidden text-gray-200" onClick={() => { if(showDropdown) setShowDropdown(null) }}>

      {isInitialState ? (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-[#070707] overflow-hidden">
          {/* Background: grid halus monokrom + vignette */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, #000 35%, transparent 100%)' }} />

          <div className="relative max-w-3xl w-full flex flex-col items-center gap-8 z-10">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center text-center gap-5">
              <BrandMark size={48} />
              <h1 className="text-4xl md:text-[3.2rem] leading-[1.08] font-bold tracking-tight text-white">
                Bangun aplikasi dalam<br />hitungan detik.
              </h1>
              <p className="text-gray-400 text-base md:text-lg max-w-lg font-normal leading-relaxed">
                Halo <span className="text-white font-medium">{getUserName()}</span>, jelaskan ide Anda. Builder menulis kodenya dan menjalankannya langsung di sini.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="w-full bg-[#0E0E0E] border border-white/10 rounded-[24px] shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)] focus-within:border-white/25 transition-colors relative z-20">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 p-4 pb-0">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-300">
                      {getFileIcon(file)}
                      <span className="truncate max-w-[150px] font-medium">{file}</span>
                      <button onClick={(e) => { e.stopPropagation(); setAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); setAttachedFilesData(prev => prev.filter((_, idx) => idx !== i)); }} className="ml-1 text-gray-500 hover:text-white">
                        <X_Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buatkan landing page e-commerce dengan tema gelap..."
                className="w-full max-h-64 min-h-[140px] bg-transparent text-white text-[15px] resize-none outline-none p-5 placeholder-gray-600 font-normal leading-relaxed"
              />

              <div className="flex items-center justify-between gap-3 p-3 border-t border-white/[0.06] bg-white/[0.015] rounded-b-[24px]">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="p-2.5 cursor-pointer text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors shrink-0" onClick={e => e.stopPropagation()}>
                    <input type="file" multiple className="hidden" accept=".txt,.md" onChange={handleFileUpload} />
                    <Paperclip className="w-[18px] h-[18px]" />
                  </label>

                  <div className="w-px h-6 bg-white/10 shrink-0" />

                  {/* Dropdowns */}
                  <div className="flex flex-wrap gap-1.5 relative z-50">
                    {/* Platform */}
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowDropdown(showDropdown === 'platform' ? null : 'platform'); }} className={`flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-lg text-[12px] font-medium transition-colors border ${showDropdown === 'platform' ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        {selectedPlatform} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown === 'platform' ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showDropdown === 'platform' && (
                          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.12 }} className="absolute bottom-full left-0 mb-2 w-44 bg-[#0E0E0E] border border-white/10 rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.7)] p-1 z-50">
                            {['Web'].map(opt => (
                              <button key={opt} onClick={() => { setSelectedPlatform(opt); setShowDropdown(null); }} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium flex items-center justify-between transition-colors ${selectedPlatform === opt ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'}`}>
                                {opt}{selectedPlatform === opt && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Model */}
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowDropdown(showDropdown === 'model' ? null : 'model'); }} className={`flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-lg text-[12px] font-medium transition-colors border ${showDropdown === 'model' ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
                        <BrainCircuit className="w-3.5 h-3.5" />
                        {selectedModel} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown === 'model' ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showDropdown === 'model' && (
                          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.12 }} className="absolute bottom-full left-0 mb-2 w-60 bg-[#0E0E0E] border border-white/10 rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.7)] p-1 z-50">
                            {[
                              { name: 'Gemini 3.5 Flash', available: true, fallback: false },
                              { name: 'Gemini 3.1 Pro', available: true, fallback: true },
                              { name: 'GPT-5.5', available: true, fallback: true },
                              { name: 'Claude Sonnet 4.6', available: true, fallback: true },
                              { name: 'Claude Opus 4.6', available: true, fallback: true },
                            ].map(opt => (
                              <button
                                key={opt.name}
                                onClick={(e) => { e.stopPropagation(); if(opt.available) { setSelectedModel(opt.name); setShowDropdown(null); } }}
                                disabled={!opt.available}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium flex items-center justify-between transition-colors ${!opt.available ? 'text-gray-600 cursor-not-allowed' : selectedModel === opt.name ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'}`}
                              >
                                <span>{opt.name}</span>
                                {!opt.available
                                  ? <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wider">Soon</span>
                                  : selectedModel === opt.name
                                    ? <Check className="w-3.5 h-3.5" />
                                    : opt.fallback
                                      ? <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-amber-300 font-bold uppercase tracking-wider">Auto fallback</span>
                                      : null}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Tech */}
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setShowDropdown(showDropdown === 'tech' ? null : 'tech'); }} className={`flex items-center gap-2 pl-2.5 pr-2 py-2 rounded-lg text-[12px] font-medium transition-colors border ${showDropdown === 'tech' ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
                        <Wrench className="w-3.5 h-3.5" />
                        {selectedTech} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown === 'tech' ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showDropdown === 'tech' && (
                          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.12 }} className="absolute bottom-full left-0 mb-2 w-56 bg-[#0E0E0E] border border-white/10 rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.7)] p-1 z-50">
                            {['React + Vite'].map(opt => (
                              <button key={opt} onClick={() => {
                                setSelectedTech(opt);
                                setShowDropdown(null);
                              }} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium flex items-center justify-between transition-colors ${selectedTech === opt ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'}`}>
                                {opt}{selectedTech === opt && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleSend(); }}
                  disabled={!inputValue.trim() && attachedFiles.length === 0}
                  className={`shrink-0 px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 font-semibold text-sm ${
                    inputValue.trim() || attachedFiles.length > 0
                      ? 'bg-white text-black hover:bg-gray-200'
                      : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'
                  }`}
                >
                  Buat <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: '🛍️', label: 'Landing page SaaS', prompt: 'Buat landing page SaaS modern: navbar, hero dengan CTA, 6 kartu fitur, pricing 3 tier, dan footer. Dark mode, animasi halus.' },
                { icon: '📊', label: 'Dashboard analitik', prompt: 'Buat dashboard analitik: sidebar, header, 4 kartu statistik, dan grafik. Tema gelap, rapi, responsif.' },
                { icon: '✅', label: 'Aplikasi To-Do', prompt: 'Buat aplikasi to-do list interaktif: tambah, hapus, tandai selesai, dan filter. Desain minimalis modern.' },
                { icon: '🏪', label: 'Toko online', prompt: 'Buat halaman toko online: grid produk dengan kartu visual sederhana, tombol keranjang, dan filter kategori. Modern e-commerce.' },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={(e) => { e.stopPropagation(); setInputValue(s.prompt); }}
                  className="group flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 text-[12.5px] font-medium text-gray-300 hover:text-white transition-all"
                >
                  <span className="text-sm">{s.icon}</span> {s.label}
                </button>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }} className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 font-semibold tracking-wide uppercase">
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Instant Build</span>
              <span className="text-white/10">•</span>
              <span className="flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" /> Sandpack</span>
              <span className="text-white/10">•</span>
              <span className="flex items-center gap-1.5"><MonitorPlay className="w-3.5 h-3.5" /> Live Preview</span>
            </motion.div>

            {projectHistory.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="w-full mt-6">
                <h3 className="text-[11px] font-bold text-gray-500 mb-3 uppercase tracking-widest text-center">Riwayat Project Terakhir</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectHistory.slice(0, 3).map(proj => (
                    <div key={proj.id} onClick={() => loadProject(proj)} className="p-3.5 rounded-2xl bg-[#111] border border-white/5 hover:border-white/20 hover:bg-[#151515] cursor-pointer transition-all flex items-center gap-3.5 group shadow-sm">
                       <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                         <Code2 className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                       </div>
                       <div className="min-w-0 flex-1">
                         <div className="text-[13px] font-semibold text-gray-200 truncate group-hover:text-white transition-colors">{proj.name}</div>
                         <div className="text-[11px] text-gray-500 mt-0.5 font-medium">{new Date(proj.timestamp).toLocaleDateString()} {new Date(proj.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                       </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        <>
      {/* ------------------------------------------- */}
      {/* LEFT PANE: CHAT & PROMPT (W-96) */}
      {/* ------------------------------------------- */}
      <div className={`${isChatOpen ? 'w-full md:w-[380px] lg:w-[420px] border-r border-white/5' : 'w-0 overflow-hidden'} flex flex-col bg-[#050505] shrink-0 relative z-10 box-border transition-all duration-300`}>
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-5 bg-black/60 shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <h2 className="font-bold text-[14px] text-white tracking-tight">VibeCoderz Builder</h2>
          </div>
          <button onClick={handleNewProject} className="text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-white/10">
             + Project Baru
          </button>
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
                  <BrandMark size={30} className="shrink-0 mt-0.5" />
                )}

                <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <span className="text-[11px] font-semibold text-gray-500 tracking-wide pl-0.5">Builder</span>
                  )}
                  {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end w-full">
                      {msg.attachedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-gray-300 max-w-full">
                          {getFileIcon(file)}
                          <span className="truncate max-w-[150px]">{file}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === 'user' ? (
                     <div className="px-4 py-2.5 rounded-2xl bg-white text-black text-[13px] leading-relaxed rounded-br-md font-medium">
                       {msg.content}
                     </div>
                  ) : (
                     <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-[13px] leading-relaxed text-gray-200 rounded-tl-md font-normal whitespace-pre-wrap">
                       {msg.content}
                     </div>
                  )}
                </div>
              </motion.div>
            ))}

            {genStatus === 'building' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <BrandMark size={32} className="shrink-0 animate-pulse" />
                <div className="px-1 py-1.5 flex items-center gap-2">
                  <span className="text-[13px] text-gray-300 font-medium tracking-tight">generate code waiting</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
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
                  <button onClick={() => { setAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); setAttachedFilesData(prev => prev.filter((_, idx) => idx !== i)); }} className="ml-1 text-gray-500 hover:text-white shrink-0">
                    <X_Icon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end bg-white/[0.04] border border-white/10 rounded-2xl p-1.5 focus-within:border-white/25 transition-colors">
            <label className="p-3 cursor-pointer text-gray-500 hover:text-white transition-colors shrink-0">
               <input type="file" multiple className="hidden" accept=".txt,.md" onChange={handleFileUpload} />
               <Paperclip className="w-4 h-4" />
            </label>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={genStatus === 'building'}
              placeholder="Ceritakan aplikasi seperti apa yang ingin Anda buat..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent text-white text-[13px] resize-none outline-none py-3 px-1 placeholder-gray-500 font-medium disabled:opacity-50"
              rows={inputValue.split('\n').length > 1 ? Math.min(5, inputValue.split('\n').length) : 1}
            />
            {genStatus === 'building' ? (
              <button
                onClick={handleStop}
                className="p-3 rounded-2xl transition-all shrink-0 mb-0.5 mr-0.5 bg-white text-black hover:bg-gray-200"
                title="Hentikan generate"
              >
                <span className="block w-3.5 h-3.5 bg-black rounded-[2px]" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() && attachedFiles.length === 0}
                className={`p-3 rounded-2xl transition-all shrink-0 mb-0.5 mr-0.5 shadow-xl ${
                  inputValue.trim() || attachedFiles.length > 0
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-white/5 text-gray-600'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
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
          {/* TAB TOGGLES */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
             <button
               onClick={() => setActiveTab('code')}
               className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${activeTab === 'code' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
             >
               <Code2 className="w-3.5 h-3.5" /> Code
             </button>
             <button
               onClick={() => setActiveTab('preview')}
               className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${activeTab === 'preview' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
             >
               <MonitorPlay className="w-3.5 h-3.5" /> Preview
             </button>
             <button
               onClick={() => setActiveTab('terminal')}
               className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${activeTab === 'terminal' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
             >
               <Terminal className="w-3.5 h-3.5" /> Terminal
             </button>
          </div>

          <div className="flex items-center gap-2 px-2 z-10 pointer-events-none">
            <div className="flex gap-1.5 items-center pointer-events-auto opacity-50 hover:opacity-90 transition-opacity mr-4">
               <div className="w-3 h-3 rounded-full bg-white/20"></div>
               <div className="w-3 h-3 rounded-full bg-white/15"></div>
               <div className="w-3 h-3 rounded-full bg-white/10"></div>
            </div>

            <div className="pointer-events-auto">
              {genStatus === 'done' && (
                <button
                  onClick={handleExportZip}
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

          {/* LOADING OVERLAY — sederhana */}
          <AnimatePresence>
            {genStatus === 'building' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-[#050505]/90 backdrop-blur-xl flex flex-col p-8 items-center justify-center"
              >
                <div className="flex flex-col items-center gap-7 max-w-md text-center">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-2xl border border-white/10" />
                    <div className="absolute inset-0 rounded-2xl border-t-2 border-white/70 border-transparent animate-spin" />
                    <BrandMark size={44} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
                      generate code waiting
                      <span className="inline-flex gap-1 ml-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 font-medium">Menyusun & menjalankan kode aplikasi Anda di browser.</p>
                  </div>
                  {/* indeterminate progress bar */}
                  <div className="w-56 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-1/3 bg-white/80 rounded-full animate-[loadingbar_1.2s_ease-in-out_infinite]" />
                  </div>
                  <div ref={messagesEndRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SANDPACK MOUNT - USING CSS DISPLAY INSTEAD OF CONDITIONAL RENDER TO PRESERVE VM STATE */}
          <div className="absolute inset-0 flex flex-col">
            <style>{`
              @keyframes loadingbar {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(150%); }
                100% { transform: translateX(400%); }
              }
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
              key={sandpackKey}
              template="vite-react-ts"
              theme="dark"
              files={sandboxFiles}
              customSetup={{
                dependencies: {
                  "lucide-react": "latest",
                  "framer-motion": "latest",
                  "clsx": "latest"
                }
              }}
              options={{
                activeFile: "/App.tsx"
              }}
            >
              <SandpackErrorInterceptor onAutoFix={handleAutoFix} onTerminalLog={handleTerminalLog} />
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
                  <CleanSandpackPreview />
                </div>

              </SandpackLayout>
            </SandpackProvider>

            {/* SPLIT 3: TERMINAL CONSOLE (Sandpack preview sessions) */}
            <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', position: 'absolute', inset: 0, zIndex: 10 }} className="flex-col bg-[#0a0a0a]">
              {/* Tab bar sesi */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-[#050505] shrink-0 overflow-x-auto">
                <Terminal className="w-4 h-4 text-gray-300 shrink-0 mr-1" />
                {termSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSession(s.id)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-colors border ${activeSession === s.id ? 'bg-[#1a1a1a] text-white border-white/10' : 'text-gray-500 hover:text-gray-300 border-transparent hover:bg-white/5'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.running ? 'bg-white' : 'bg-gray-500 animate-pulse'}`} />
                    {s.name}
                    <span
                      onClick={(e) => { e.stopPropagation(); setTermSessions(prev => prev.filter(x => x.id !== s.id)); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity"
                    >
                      <X_Icon className="w-3 h-3" />
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => newTerminalSession()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 whitespace-nowrap transition-colors shrink-0"
                  title="Buka sesi terminal baru"
                >
                  <span className="text-base leading-none">+</span> New Session
                </button>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {(() => { const s = termSessions.find(x => x.id === activeSession); return s ? (
                    <button onClick={() => setTermSessions(prev => prev.map(x => x.id === s.id ? { ...x, lines: [] } : x))} className="text-[11px] font-bold text-gray-500 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-all uppercase tracking-widest">Clear</button>
                  ) : null; })()}
                </div>
              </div>

              {/* Body terminal */}
              <div className="flex-1 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed bg-[#0a0a0a]">
                {termSessions.length === 0 ? (
                  <div className="flex flex-col items-start gap-3 text-gray-600">
                    <span className="italic">Belum ada sesi. Klik "New Session" untuk menjalankan dev server.</span>
                    <button onClick={() => newTerminalSession()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                      <span className="text-base leading-none">+</span> New Session
                    </button>
                  </div>
                ) : (() => {
                  const s = termSessions.find(x => x.id === activeSession) || termSessions[termSessions.length - 1];
                  const toneClass = (t?: string) => t === 'accent' ? 'text-white font-bold' : t === 'ok' ? 'text-gray-200' : t === 'warn' ? 'text-gray-300' : t === 'err' ? 'text-white font-semibold' : t === 'dim' ? 'text-gray-500' : 'text-gray-300';
                  return (
                    <div className="space-y-0.5">
                      {s.lines.map((ln, i) => (
                        <div key={i} className={`whitespace-pre-wrap break-all ${toneClass(ln.tone)}`}>{ln.text || '\u00A0'}</div>
                      ))}
                      {s.running && (
                        <div className="flex items-center gap-2 text-gray-500 mt-2">
                          <span className="text-gray-400">➜</span>
                          <span className="w-2 h-4 bg-gray-400 animate-pulse inline-block" />
                        </div>
                      )}
                      <div ref={terminalEndRef} />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

        </div>
      </div>
        </>
      )}
    </div>
  );
}
