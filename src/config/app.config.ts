export const APP_CONFIG = {
  NUM_QUARTERS: parseInt(process.env.NUM_QUARTERS || '4'),
  CACHE_MAX_AGE: parseInt(process.env.CACHE_MAX_AGE || '3600000'), // 1시간
  API_TIMEOUT: parseInt(process.env.API_TIMEOUT || '30000'), // 30초
  USER_AGENT: process.env.USER_AGENT || '13F-Signal-Tracker contact@example.com'
};
