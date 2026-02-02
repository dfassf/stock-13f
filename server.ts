import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { SOURCES } from './src/config/sources';
import { analyzeSource } from './src/services/analyzer.service';
import { generateWebData } from './src/services/data-generator.service';
import { getCache, setCache } from './src/utils/cache';
import { SourceKey, WebData } from './src/types/interfaces';

const app = new Hono();

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes('SEC API') || message.includes('XML') || message.includes('시간 초과')) {
      return message;
    }
  }
  return '데이터를 가져오는 중 오류가 발생했습니다';
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
    return c.json({ error: 'Invalid source' }, 400);
  }
  
  try {
    const data = await getData(source);
    return c.json(data);
  } catch (error) {
    const errorMessage = sanitizeError(error);
    return c.json({ error: errorMessage }, 500);
  }
});

app.post('/api/refresh/:source', async (c) => {
  const source = c.req.param('source') as SourceKey;
  
  if (!SOURCES[source]) {
    return c.json({ error: 'Invalid source' }, 400);
  }
  
  try {
    const data = await getData(source, true);
    return c.json({ success: true, data });
  } catch (error) {
    const errorMessage = sanitizeError(error);
    return c.json({ error: errorMessage }, 500);
  }
});

app.get('/api/sources', (c) => {
  return c.json(SOURCES);
});

app.use('/*', serveStatic({ root: './' }));

const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port
}, (info) => {
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
