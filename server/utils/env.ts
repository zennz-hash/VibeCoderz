type EnvCheck = {
  name: string;
  required?: boolean;
  minLength?: number;
  productionOnly?: boolean;
};

const ENV_CHECKS: EnvCheck[] = [
  { name: 'JWT_SECRET', required: true, minLength: 32 },
  { name: 'VITE_GOOGLE_CLIENT_ID', required: true },
  { name: 'SQLITE_URL', required: true },
  { name: 'FRONTEND_URL', required: true, productionOnly: true },
];

export function validateEnvironment(env = process.env): string[] {
  const isProduction = env.NODE_ENV === 'production';
  const errors: string[] = [];

  for (const check of ENV_CHECKS) {
    if (check.productionOnly && !isProduction) continue;
    // SQLITE_URL is optional when Turso is configured
    if (check.name === 'SQLITE_URL' && env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN) continue;
    const value = env[check.name];
    if (check.required && !value) {
      errors.push(`${check.name} wajib diisi.`);
      continue;
    }
    if (value && check.minLength && value.length < check.minLength) {
      errors.push(`${check.name} minimal ${check.minLength} karakter.`);
    }
  }

  // ROUTER9 bukan hard requirement — fitur AI tidak berfungsi tanpa ini, tapi app tetap bisa start
  if (!env.ROUTER9_API_KEY) {
    console.warn('⚠️  WARNING: ROUTER9_API_KEY tidak diset. Fitur generate AI akan gagal.');
  }

  if (env.ROUTER9_API_KEY && !env.ROUTER9_BASE_URL) {
    errors.push('ROUTER9_BASE_URL wajib diisi bila ROUTER9_API_KEY digunakan.');
  }

  return errors;
}

export function assertValidEnvironment() {
  const errors = validateEnvironment();
  if (errors.length === 0) return;

  errors.forEach((error) => console.error(`ENV ERROR: ${error}`));
  throw new Error(`Konfigurasi environment belum valid (${errors.length} error).`);
}
