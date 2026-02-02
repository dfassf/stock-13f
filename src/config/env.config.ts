import dotenv from 'dotenv';

dotenv.config();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = getEnv(key, defaultValue?.toString());
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`환경 변수 ${key}는 숫자여야 합니다: ${value}`);
  }
  return parsed;
}

export const ENV_CONFIG = {
  PORT: getEnvNumber('PORT', 3000),
  NUM_QUARTERS: getEnvNumber('NUM_QUARTERS', 4),
  CACHE_MAX_AGE: getEnvNumber('CACHE_MAX_AGE', 3600000),
  API_TIMEOUT: getEnvNumber('API_TIMEOUT', 30000),
  USER_AGENT: getEnv('USER_AGENT', '13F-Signal-Tracker contact@example.com'),
  LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),
  LOG_FILE: getEnv('LOG_FILE', 'logs/app.log')
};
