"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWebData = generateWebData;
const sources_1 = require("../config/sources");
function formatChange(change) {
    return {
        period: `${change.from} → ${change.to}`,
        percent: parseFloat(change.percent.toFixed(2)),
        type: change.type
    };
}
function createExclusionItem(item, reason) {
    const base = {
        symbol: item.name,
        cusip: item.cusip,
        reason,
        changes: item.changes.slice(0, 4).map(formatChange)
    };
    if (reason === 'CONSECUTIVE_DECREASE') {
        return {
            ...base,
            detail: `${item.consecutiveDecreases}분기 연속 감축`,
            severity: item.consecutiveDecreases >= 3 ? 'HIGH' : 'MEDIUM',
            currentShares: item.currentShares,
            currentValueK: item.currentValue
        };
    }
    return {
        ...base,
        detail: '완전 청산',
        severity: 'HIGH',
        currentShares: 0,
        previousValueK: item.history[1]?.value || 0
    };
}
function createWatchlistItem(item, signal) {
    const base = {
        symbol: item.name,
        cusip: item.cusip,
        signal,
        currentShares: item.currentShares,
        currentValueK: item.currentValue
    };
    if (signal === 'NEW_POSITION') {
        return {
            ...base,
            detail: '신규 편입'
        };
    }
    return {
        ...base,
        detail: `${item.consecutiveIncreases}분기 연속 증가`,
        changes: item.changes.slice(0, 4).map(formatChange)
    };
}
function generateWebData(analysisResult) {
    const { analysis, quarterlyData, source } = analysisResult;
    const items = Object.values(analysis);
    const dates = quarterlyData.map(q => q.date);
    const exclusionList = [];
    items.filter(i => i.consecutiveDecreases >= 2).forEach(item => {
        exclusionList.push(createExclusionItem(item, 'CONSECUTIVE_DECREASE'));
    });
    items.filter(i => i.changes[0]?.type === 'LIQUIDATED').forEach(item => {
        exclusionList.push(createExclusionItem(item, 'LIQUIDATED'));
    });
    const watchlist = [];
    items.filter(i => i.changes[0]?.type === 'NEW').forEach(item => {
        watchlist.push(createWatchlistItem(item, 'NEW_POSITION'));
    });
    items.filter(i => i.consecutiveIncreases >= 2 && i.currentShares > 0).forEach(item => {
        watchlist.push(createWatchlistItem(item, 'CONSECUTIVE_INCREASE'));
    });
    const portfolio = items
        .filter(i => i.currentShares > 0)
        .map(item => ({
        symbol: item.name,
        cusip: item.cusip,
        shares: item.currentShares,
        valueK: item.currentValue,
        valueMillion: parseFloat((item.currentValue / 1000).toFixed(2)),
        recentChange: item.changes[0] ? {
            percent: parseFloat(item.changes[0].percent.toFixed(2)),
            type: item.changes[0].type
        } : null
    }))
        .sort((a, b) => b.valueK - a.valueK);
    const sourceKey = Object.keys(sources_1.SOURCES).find(k => sources_1.SOURCES[k].name === source.name);
    const metadata = {
        source: source.name,
        sourceKey,
        flag: source.flag,
        cik: source.cik,
        generatedAt: new Date().toISOString(),
        analyzedQuarters: dates,
        latestFiling: dates[0],
        totalPositions: portfolio.length
    };
    return { metadata, exclusionList, watchlist, portfolio };
}
//# sourceMappingURL=data-generator.service.js.map