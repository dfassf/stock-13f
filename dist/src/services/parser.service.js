"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateHoldings = aggregateHoldings;
const type_guards_1 = require("../utils/type-guards");
const logger_1 = __importDefault(require("../utils/logger"));
function extractHoldings(parsed) {
    if (parsed.informationTable?.infoTable) {
        const holdings = parsed.informationTable.infoTable;
        return Array.isArray(holdings) ? holdings : [holdings];
    }
    if (parsed.infoTable) {
        return Array.isArray(parsed.infoTable) ? parsed.infoTable : [parsed.infoTable];
    }
    if (parsed['ns1:informationTable']?.['ns1:infoTable']) {
        const ns1Holdings = parsed['ns1:informationTable']['ns1:infoTable'];
        return Array.isArray(ns1Holdings) ? ns1Holdings : [ns1Holdings];
    }
    return [];
}
function extractHoldingValue(holding) {
    const valueStr = holding.value || holding['ns1:value'];
    return (0, type_guards_1.safeParseInt)(valueStr, 0);
}
function extractHoldingShares(holding) {
    const shrsOrPrnAmt = holding.shrsOrPrnAmt || holding['ns1:shrsOrPrnAmt'] || {};
    const sharesStr = shrsOrPrnAmt.sshPrnamt || shrsOrPrnAmt['ns1:sshPrnamt'];
    return (0, type_guards_1.safeParseInt)(sharesStr, 0);
}
function aggregateHoldings(parsed) {
    const holdings = extractHoldings(parsed);
    if (holdings.length === 0) {
        logger_1.default.warn({}, '보유 종목 데이터가 없음');
        return {};
    }
    const aggregated = {};
    for (const h of holdings) {
        const name = h.nameOfIssuer || h['ns1:nameOfIssuer'] || 'UNKNOWN';
        const cusip = h.cusip || h['ns1:cusip'] || 'UNKNOWN';
        const value = extractHoldingValue(h);
        const shares = extractHoldingShares(h);
        if (!aggregated[cusip]) {
            aggregated[cusip] = { name, cusip, value: 0, shares: 0 };
        }
        aggregated[cusip].value += value;
        aggregated[cusip].shares += shares;
    }
    logger_1.default.debug({ count: Object.keys(aggregated).length }, '보유 종목 집계 완료');
    return aggregated;
}
//# sourceMappingURL=parser.service.js.map