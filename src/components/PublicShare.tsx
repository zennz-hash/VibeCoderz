import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { apiFetch, readApiError, userFacingError } from '../utils/api';

type MermaidModule = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidModule> | null = null;

function loadMermaid(): Promise<MermaidModule> {
  mermaidPromise ??= import('mermaid').then((mod) => {
    const instance = mod.default;
    instance.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'strict',
    });
    return instance;
  });
  return mermaidPromise;
}

type SharedBlueprint = {
  name: string;
  type: string;
  content: string;
  author?: {
    name?: string;
    picture?: string;
  };
  createdAt: string;
};

const sanitizeSvg = (svgString: string): string => {
  let safe = svgString.replace(/<script[\s\S]*?<\/script>/gi, '');
  safe = safe.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  safe = safe.replace(/javascript\s*:/gi, 'blocked:');
  return safe;
};

function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('');
  const [hasError, setHasError] = useState(false);
  const baseId = useId().replace(/:/g, '');
  const id = useMemo(() => `share-mermaid-${baseId}-${Math.random().toString(36).slice(2, 8)}`, [baseId]);

  useEffect(() => {
    let mounted = true;

    setSvg('');
    setHasError(false);
    loadMermaid()
      .then(mermaid => mermaid.render(id, chart))
      .then(result => {
        if (mounted) setSvg(sanitizeSvg(result.svg));
      })
      .catch(() => {
        if (mounted) setHasError(true);
        const phantom = document.getElementById('d' + id);
        if (phantom) phantom.remove();
      });

    return () => {
      mounted = false;
    };
  }, [chart, id]);

  if (hasError) {
    return (
      <pre className="my-8 overflow-x-auto rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
        {chart}
      </pre>
    );
  }

  return (
    <div
      className="my-10 overflow-x-auto rounded-3xl border border-white/10 bg-black p-6"
      dangerouslySetInnerHTML={{ __html: svg || '<div class="text-gray-400">Memproses diagram...</div>' }}
    />
  );
}

export default function PublicShare() {
  const { token } = useParams();
  const [blueprint, setBlueprint] = useState<SharedBlueprint | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Token share tidak valid.');
      setIsLoading(false);
      return;
    }

    apiFetch(`/api/share/${encodeURIComponent(token)}`)
      .then(async response => {
        if (!response.ok) throw new Error(await readApiError(response, 'Blueprint tidak ditemukan.'));
        const data = await response.json();
        setBlueprint(data);
      })
      .catch(err => setError(userFacingError(err, 'Gagal memuat blueprint.')))
      .finally(() => setIsLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            VibeCoderz
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
            <FileText className="h-3.5 w-3.5" />
            Public PRD
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-100">
            <h1 className="mb-2 text-2xl font-black">Share tidak tersedia</h1>
            <p className="text-sm text-red-100/80">{error}</p>
          </div>
        )}

        {!isLoading && blueprint && (
          <article>
            <div className="mb-10 border-b border-white/10 pb-8">
              <div className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">{blueprint.type}</div>
              <h1 className="mb-4 text-4xl font-black tracking-tight md:text-5xl">{blueprint.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <span>{new Date(blueprint.createdAt).toLocaleDateString('id-ID')}</span>
                {blueprint.author?.name && <span>oleh {blueprint.author.name}</span>}
              </div>
            </div>

            <div className="prose prose-invert prose-lg max-w-none prose-headings:font-black prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-3 prose-pre:rounded-2xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-[#0f0f0f]">
              <Markdown
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (!inline && match?.[1] === 'mermaid') {
                      return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {blueprint.content}
              </Markdown>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
