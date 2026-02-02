import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { SOURCES } from './src/config/sources';
import { analyzeSource } from './src/services/analyzer.service';
import { generateWebData } from './src/services/data-generator.service';
import { getCache, setCache } from './src/utils/cache';
import { SourceKey, WebData } from './src/types/interfaces';
import { AppError, ValidationError } from './src/errors/app.error';
import { ENV_CONFIG } from './src/config/env.config';
import logger from './src/utils/logger';

const app = new Hono();

function handleError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof AppError) {
    logger.error({ 
      code: error.code, 
      message: error.message, 
      statusCode: error.statusCode 
    }, '애플리케이션 에러');
    return { message: error.message, statusCode: error.statusCode };
  }
  
  logger.error({ error }, '예상치 못한 에러');
  return { 
    message: '데이터를 가져오는 중 오류가 발생했습니다', 
    statusCode: 500 
  };
}

async function getData(sourceKey: SourceKey, forceRefresh = false): Promise<WebData> {
  if (!forceRefresh) {
    const cached = getCache(sourceKey);
    if (cached) return cached;
  }
  
  const analysisResult = await analyzeSource(sourceKey);
  const data = generateWebData(analysisResult);
  
  setCache(sourceKey, data);
  
  return data;
}

app.get('/api/signals/:source', async (c) => {
  const source = c.req.param('source') as SourceKey;
  
  if (!SOURCES[source]) {
    logger.warn({ source }, '잘못된 소스 요청');
    throw new ValidationError(`Invalid source: ${source}`);
  }
  
  try {
    logger.info({ source }, '시그널 데이터 요청');
    const data = await getData(source);
    return c.json(data);
  } catch (error) {
    const { message, statusCode } = handleError(error);
    return c.json({ error: message }, statusCode as any);
  }
});

app.post('/api/refresh/:source', async (c) => {
  const source = c.req.param('source') as SourceKey;
  
  if (!SOURCES[source]) {
    logger.warn({ source }, '잘못된 소스 요청');
    throw new ValidationError(`Invalid source: ${source}`);
  }
  
  try {
    logger.info({ source }, '데이터 새로고침 요청');
    const data = await getData(source, true);
    return c.json({ success: true, data });
  } catch (error) {
    const { message, statusCode } = handleError(error);
    return c.json({ error: message }, statusCode as any);
  }
});

app.get('/api/sources', (c) => {
  return c.json(SOURCES);
});

app.use('/*', serveStatic({ root: './' }));

serve({
  fetch: app.fetch,
  port: ENV_CONFIG.PORT
}, (info) => {
  logger.info({ 
    port: info.port, 
    url: `http://localhost:${info.port}` 
  }, '서버 시작');
  
  console.log(`
🚀 13F Signal Tracker 서버 시작!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 URL: http://localhost:${info.port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 API:
   GET  /api/signals/:source  - 시그널 데이터
   POST /api/refresh/:source  - 데이터 새로고침
   GET  /api/sources          - 소스 목록
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
