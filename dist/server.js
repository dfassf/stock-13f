"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const node_server_1 = require("@hono/node-server");
const serve_static_1 = require("@hono/node-server/serve-static");
const sources_1 = require("./src/config/sources");
const analyzer_service_1 = require("./src/services/analyzer.service");
const data_generator_service_1 = require("./src/services/data-generator.service");
const cache_1 = require("./src/utils/cache");
const app = new hono_1.Hono();
function sanitizeError(error) {
    if (error instanceof Error) {
        const message = error.message;
        if (message.includes('SEC API') || message.includes('XML') || message.includes('시간 초과')) {
            return message;
        }
    }
    return '데이터를 가져오는 중 오류가 발생했습니다';
}
async function getData(sourceKey, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = (0, cache_1.getCache)(sourceKey);
        if (cached)
            return cached;
    }
    const analysisResult = await (0, analyzer_service_1.analyzeSource)(sourceKey);
    const data = (0, data_generator_service_1.generateWebData)(analysisResult);
    (0, cache_1.setCache)(sourceKey, data);
    return data;
}
app.get('/api/signals/:source', async (c) => {
    const source = c.req.param('source');
    if (!sources_1.SOURCES[source]) {
        return c.json({ error: 'Invalid source' }, 400);
    }
    try {
        const data = await getData(source);
        return c.json(data);
    }
    catch (error) {
        const errorMessage = sanitizeError(error);
        return c.json({ error: errorMessage }, 500);
    }
});
app.post('/api/refresh/:source', async (c) => {
    const source = c.req.param('source');
    if (!sources_1.SOURCES[source]) {
        return c.json({ error: 'Invalid source' }, 400);
    }
    try {
        const data = await getData(source, true);
        return c.json({ success: true, data });
    }
    catch (error) {
        const errorMessage = sanitizeError(error);
        return c.json({ error: errorMessage }, 500);
    }
});
app.get('/api/sources', (c) => {
    return c.json(sources_1.SOURCES);
});
app.use('/*', (0, serve_static_1.serveStatic)({ root: './' }));
const port = parseInt(process.env.PORT || '3000');
(0, node_server_1.serve)({
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
//# sourceMappingURL=server.js.map