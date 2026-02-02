import pino from 'pino';
import { ENV_CONFIG } from '../config/env.config';

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: ENV_CONFIG.LOG_LEVEL,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  base: {
    service: '13f-signal-tracker'
  }
});

export default logger;
