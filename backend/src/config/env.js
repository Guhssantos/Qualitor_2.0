import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT || 4000),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 7),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB || 15),
  jobsIntervalSeconds: Number(process.env.JOBS_INTERVAL_SECONDS || 60),
  aiProvider: process.env.AI_PROVIDER || 'rule-based',
  notifyChannels: (process.env.NOTIFY_CHANNELS || '').split(',').map((s) => s.trim()).filter(Boolean),
};

if (env.isProd && env.jwtAccessSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres em produção.');
}
