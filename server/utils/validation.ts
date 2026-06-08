export class ValidationError extends Error {
  statusCode = 400;
}

function invalid(message: string): never {
  throw new ValidationError(message);
}

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readString(source: Record<string, unknown>, key: string, options: {
  required?: boolean;
  max?: number;
  min?: number;
} = {}): string {
  const value = source[key];
  if (value === undefined || value === null) {
    if (options.required) invalid(`${key} wajib diisi.`);
    return '';
  }
  if (typeof value !== 'string') invalid(`${key} harus berupa teks.`);

  const trimmed = value.trim();
  if (options.required && !trimmed) invalid(`${key} wajib diisi.`);
  if (options.min !== undefined && trimmed.length < options.min) invalid(`${key} terlalu pendek.`);
  if (options.max !== undefined && trimmed.length > options.max) invalid(`${key} terlalu panjang. Maksimal ${options.max} karakter.`);
  return trimmed;
}

export function readBoolean(source: Record<string, unknown>, key: string, defaultValue = false): boolean {
  const value = source[key];
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== 'boolean') invalid(`${key} harus berupa boolean.`);
  return value;
}

export function readStringRecord(source: Record<string, unknown>, key: string): Record<string, string> {
  const value = source[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: Record<string, string> = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue !== 'string') invalid(`${key}.${field} harus berupa teks.`);
    result[field] = fieldValue.trim();
  }
  return result;
}

export type ChatMessageInput = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function readChatMessages(source: Record<string, unknown>, key = 'messages'): ChatMessageInput[] {
  const value = source[key];
  if (!Array.isArray(value) || value.length === 0) invalid(`${key} wajib berupa array pesan.`);
  if (value.length > 20) invalid(`${key} terlalu banyak. Maksimal 20 pesan.`);

  return value.map((item, index) => {
    const obj = asObject(item);
    if (!obj) invalid(`${key}[${index}] harus berupa objek.`);
    const role = readString(obj, 'role', { required: true, max: 20 });
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      invalid(`${key}[${index}].role tidak valid.`);
    }
    const content = readString(obj, 'content', { required: true, max: 12000 });
    return { role, content };
  });
}
