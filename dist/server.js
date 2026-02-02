"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const node_server_1 = require("@hono/node-server");
const serve_static_1 = require("@hono/node-server/serve-static");
const sources_1 = require("./src/config/sources");
const analyzer_service_1 = require("./src/services/analyzer.service");
const data_generator_service_1 = require("./src/services/data-generator.service");
const cache_1 = require("./src/utils/cache");
const app_error_1 = require("./src/errors/app.error");
const env_config_1 = require("./src/config/env.config");
const logger_1 = __importDefault(require("./src/utils/logger"));
const app = new hono_1.Hono();
function handleError(error) {
    if (error instanceof app_error_1.AppError) {
        logger_1.default.error({
            code: error.code,
            message: error.message,
            statusCode: error.statusCode
        }, '애플리케이션 에러');
        return { message: error.message, statusCode: error.statusCode };
    }
    logger_1.default.error({ error }, '예상치 못한 에러');
    return {
        message: '데이터를 가져오는 중 오류가 발생했습니다',
        statusCode: 500
    };
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
        logger_1.default.warn({ source }, '잘못된 소스 요청');
        throw new app_error_1.ValidationError(`Invalid source: ${source}`);
    }
    try {
        logger_1.default.info({ source }, '시그널 데이터 요청');
        const data = await getData(source);
        return c.json(data);
    }
    catch (error) {
        const { message, statusCode } = handleError(error);
        return c.json({ error: message }, statusCode);
    }
});
app.post('/api/refresh/:source', async (c) => {
    const source = c.req.param('source');
    if (!sources_1.SOURCES[source]) {
        logger_1.default.warn({ source }, '잘못된 소스 요청');
        throw new app_error_1.ValidationError(`Invalid source: ${source}`);
    }
    try {
        logger_1.default.info({ source }, '데이터 새로고침 요청');
        const data = await getData(source, true);
        return c.json({ success: true, data });
    }
    catch (error) {
        const { message, statusCode } = handleError(error);
        return c.json({ error: message }, statusCode);
    }
});
app.get('/api/sources', (c) => {
    return c.json(sources_1.SOURCES);
});
app.use('/*', (0, serve_static_1.serveStatic)({ root: './' }));
(0, node_server_1.serve)({
    fetch: app.fetch,
    port: env_config_1.ENV_CONFIG.PORT
}, (info) => {
    logger_1.default.info({
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
//# sourceMappingURL=server.js.map