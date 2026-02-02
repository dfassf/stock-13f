"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeSource = analyzeSource;
const sources_1 = require("../config/sources");
const app_config_1 = require("../config/app.config");
const sec_edgar_service_1 = require("./sec-edgar.service");
const parser_service_1 = require("./parser.service");
const app_error_1 = require("../errors/app.error");
const logger_1 = __importDefault(require("../utils/logger"));
async function analyzeSource(sourceKey) {
    const source = sources_1.SOURCES[sourceKey];
    logger_1.default.info({ sourceKey, cik: source.cik }, `분석 시작: ${source.name}`);
    const filings = await (0, sec_edgar_service_1.get13FFilings)(source.cik);
    const numQuarters = app_config_1.APP_CONFIG.NUM_QUARTERS;
    const recentFilings = filings.slice(0, numQuarters);
    if (recentFilings.length === 0) {
        logger_1.default.error({ sourceKey, cik: source.cik }, '분석할 13F 파일이 없음');
        throw new app_error_1.AppError(app_error_1.ErrorCode.NO_FILINGS_FOUND, '분석할 13F 파일이 없습니다', 404);
    }
    logger_1.default.info({ sourceKey }, `${recentFilings.length}개 분기 데이터 수집 시작`);
    const quarterlyDataPromises = recentFilings.map(async (filing) => {
        const parsed = await (0, sec_edgar_service_1.download13F)(source.cik, filing.accessionNumber);
        const holdings = (0, parser_service_1.aggregateHoldings)(parsed);
        return { date: filing.filingDate, holdings };
    });
    const quarterlyData = await Promise.all(quarterlyDataPromises);
    logger_1.default.info({ sourceKey, quarters: quarterlyData.length }, '분기 데이터 수집 완료');
    const allCusips = new Set();
    quarterlyData.forEach(q => Object.keys(q.holdings).forEach(k => allCusips.add(k)));
    logger_1.default.debug({ sourceKey }, `총 ${allCusips.size}개 종목 발견`);
    const analysis = {};
    for (const cusip of allCusips) {
        const history = quarterlyData.map(q => ({
            date: q.date,
            shares: q.holdings[cusip]?.shares || 0,
            value: q.holdings[cusip]?.value || 0,
            name: q.holdings[cusip]?.name || null
        }));
        const name = history.find(h => h.name)?.name || 'UNKNOWN';
        const changes = [];
        for (let i = 0; i < history.length - 1; i++) {
            const curr = history[i].shares;
            const prev = history[i + 1].shares;
            let type;
            let percent;
            if (prev === 0 && curr > 0) {
                type = 'NEW';
                percent = 100;
            }
            else if (prev > 0 && curr === 0) {
                type = 'LIQUIDATED';
                percent = -100;
            }
            else if (prev > 0) {
                percent = ((curr - prev) / prev) * 100;
                type = percent > 0 ? 'INCREASE' : percent < 0 ? 'DECREASE' : 'UNCHANGED';
            }
            else {
                type = 'UNCHANGED';
                percent = 0;
            }
            changes.push({ type, percent, from: history[i + 1].date, to: history[i].date });
        }
        let consecutiveDecreases = 0;
        let consecutiveIncreases = 0;
        for (const c of changes) {
            if (c.type === 'DECREASE' || c.type === 'LIQUIDATED')
                consecutiveDecreases++;
            else
                break;
        }
        for (const c of changes) {
            if (c.type === 'INCREASE' || c.type === 'NEW')
                consecutiveIncreases++;
            else
                break;
        }
        analysis[cusip] = {
            name, cusip, history, changes,
            consecutiveDecreases, consecutiveIncreases,
            currentShares: history[0].shares,
            currentValue: history[0].value
        };
    }
    logger_1.default.info({
        sourceKey,
        totalPositions: Object.keys(analysis).length,
        quarters: quarterlyData.length
    }, '분석 완료');
    return { quarterlyData, analysis, source };
}
//# sourceMappingURL=analyzer.service.js.map