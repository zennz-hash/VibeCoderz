// Model IDs verified against this 9router instance (/v1/models)
// ag/gemini-3.5-flash-low    ✅ Gemini Flash  — fast, default
// cx/gpt-5.5                 ✅ GPT-5.5       — standard/mid-tier
// kr/claude-sonnet-4.5       ⚠️  Claude Sonnet — max tier (may 403)
// kr/claude-opus-4.7         ⚠️  Claude Opus   — max tier (may 403)
const DEFAULT_FAST_MODEL = process.env.ROUTER9_MODEL || 'ag/gemini-3.5-flash-low';

export const ROUTER9_MODEL_MAP: Record<string, string> = {
  // Code generation models
  'Gemini 3.5 Flash':  DEFAULT_FAST_MODEL,
  'Gemini 3.1 Pro':    'ag/gemini-3.1-pro-low',
  'GPT-5.5':           'cx/gpt-5.5',
  'Claude Sonnet 4.6': 'kr/claude-sonnet-4.5',
  'Claude Opus 4.6':   'kr/claude-opus-4.7',
  // PRD generation models
  // PRD Thinking         = Gemini Flash (fast, free tier)
  // PRD Thinking Standard = GPT-5.5     (mid tier)
  // PRD Thinking Max      = Claude Sonnet + Opus fallback (deep thinking)
  'PRD Thinking':          DEFAULT_FAST_MODEL,
  'PRD Thinking Standard': 'cx/gpt-5.5',
  'PRD Thinking Max':      'kr/claude-sonnet-4.5',
};

export type PrdModelAttempt = {
  isPowerModel: boolean;
  label: string;
  maxTokens: number;
  model: string;
  timeoutMs: number;
};

export type CodeModelAttempt = {
  label: string;
  maxTokens: number;
  model: string;
};

// Power models = streaming + higher token limit + longer timeout
const POWER_PRD_MODELS = new Set([
  'cx/gpt-5.5',
  'kr/claude-sonnet-4.5',
  'kr/claude-opus-4.7',
]);

export function getPrdModelAttempts(modelSelection?: string | null): PrdModelAttempt[] {
  const requestedLabel = modelSelection || 'PRD Thinking';
  const requestedModel = ROUTER9_MODEL_MAP[requestedLabel] ?? ROUTER9_MODEL_MAP['PRD Thinking'];
  const fallbackModel = ROUTER9_MODEL_MAP['PRD Thinking'];

  // PRD Thinking Max: try Sonnet first, fallback to Opus, then Gemini
  const ordered: Array<{ label: string; model: string }> =
    requestedLabel === 'PRD Thinking Max'
      ? [
          { label: 'PRD Thinking Max', model: 'kr/claude-sonnet-4.5' },
          { label: 'PRD Thinking Max (Opus)', model: 'kr/claude-opus-4.7' },
          { label: 'PRD Thinking', model: fallbackModel },
        ]
      : [
          { label: requestedLabel, model: requestedModel },
          { label: 'PRD Thinking', model: fallbackModel },
        ];

  const seen = new Set<string>();
  return ordered
    .filter((item) => {
      if (seen.has(item.model)) return false;
      seen.add(item.model);
      return true;
    })
    .map((item) => {
      const isPowerModel = POWER_PRD_MODELS.has(item.model);
      return {
        ...item,
        isPowerModel,
        maxTokens: isPowerModel ? 12000 : 8000,
        timeoutMs: isPowerModel ? 300000 : 120000,
      };
    });
}

export function getCodeModelAttempts(modelSelection?: string | null): CodeModelAttempt[] {
  const requestedLabel = modelSelection || 'Gemini 3.5 Flash';
  const requestedModel = ROUTER9_MODEL_MAP[requestedLabel] ?? ROUTER9_MODEL_MAP['Gemini 3.5 Flash'];
  const fallbackModel = ROUTER9_MODEL_MAP['Gemini 3.5 Flash'];

  const ordered = [
    { label: requestedLabel, model: requestedModel },
    { label: 'Gemini 3.5 Flash', model: fallbackModel },
  ];

  const seen = new Set<string>();
  return ordered
    .filter((item) => {
      if (seen.has(item.model)) return false;
      seen.add(item.model);
      return true;
    })
    .map((item) => ({
      ...item,
      maxTokens: 16384,
    }));
}
