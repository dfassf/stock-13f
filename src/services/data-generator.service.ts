import { SOURCES } from '../config/sources';
import { AnalysisResult, WebData, SourceKey, ExclusionItem, WatchlistItem } from '../types/interfaces';

export function generateWebData(analysisResult: AnalysisResult): WebData {
  const { analysis, quarterlyData, source } = analysisResult;
  const items = Object.values(analysis);
  const dates = quarterlyData.map(q => q.date);
  
  const exclusionList: ExclusionItem[] = [];
  
  items.filter(i => i.consecutiveDecreases >= 2).forEach(item => {
    exclusionList.push({
      symbol: item.name,
      cusip: item.cusip,
      reason: 'CONSECUTIVE_DECREASE',
      detail: `${item.consecutiveDecreases}분기 연속 감축`,
      severity: item.consecutiveDecreases >= 3 ? 'HIGH' : 'MEDIUM',
      currentShares: item.currentShares,
      currentValueK: item.currentValue,
      changes: item.changes.slice(0, 4).map(c => ({
        period: `${c.from} → ${c.to}`,
        percent: parseFloat(c.percent.toFixed(2)),
        type: c.type
      }))
    });
  });
  
  items.filter(i => i.changes[0]?.type === 'LIQUIDATED').forEach(item => {
    exclusionList.push({
      symbol: item.name,
      cusip: item.cusip,
      reason: 'LIQUIDATED',
      detail: '완전 청산',
      severity: 'HIGH',
      currentShares: 0,
      previousValueK: item.history[1]?.value || 0,
      changes: item.changes.slice(0, 4).map(c => ({
        period: `${c.from} → ${c.to}`,
        percent: parseFloat(c.percent.toFixed(2)),
        type: c.type
      }))
    });
  });
  
  const watchlist: WatchlistItem[] = [];
  
  items.filter(i => i.changes[0]?.type === 'NEW').forEach(item => {
    watchlist.push({
      symbol: item.name,
      cusip: item.cusip,
      signal: 'NEW_POSITION',
      detail: '신규 편입',
      currentShares: item.currentShares,
      currentValueK: item.currentValue
    });
  });
  
  items.filter(i => i.consecutiveIncreases >= 2 && i.currentShares > 0).forEach(item => {
    watchlist.push({
      symbol: item.name,
      cusip: item.cusip,
      signal: 'CONSECUTIVE_INCREASE',
      detail: `${item.consecutiveIncreases}분기 연속 증가`,
      currentShares: item.currentShares,
      currentValueK: item.currentValue,
      changes: item.changes.slice(0, 4).map(c => ({
        period: `${c.from} → ${c.to}`,
        percent: parseFloat(c.percent.toFixed(2)),
        type: c.type
      }))
    });
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
  
  const sourceKey = Object.keys(SOURCES).find(k => SOURCES[k as SourceKey].name === source.name) as SourceKey | undefined;
  
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
