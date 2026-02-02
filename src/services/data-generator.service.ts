import { SOURCES } from '../config/sources';
import { AnalysisResult, WebData, SourceKey, ExclusionItem, WatchlistItem, AnalysisItem, ChangeType } from '../types/interfaces';

function formatChange(change: { from: string; to: string; percent: number; type: ChangeType }) {
  return {
    period: `${change.from} → ${change.to}`,
    percent: parseFloat(change.percent.toFixed(2)),
    type: change.type as ChangeType
  };
}

function createExclusionItem(item: AnalysisItem, reason: 'CONSECUTIVE_DECREASE' | 'LIQUIDATED'): ExclusionItem {
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
      severity: item.consecutiveDecreases >= 3 ? 'HIGH' : 'MEDIUM' as const,
      currentShares: item.currentShares,
      currentValueK: item.currentValue
    };
  }

  return {
    ...base,
    detail: '완전 청산',
    severity: 'HIGH' as const,
    currentShares: 0,
    previousValueK: item.history[1]?.value || 0
  };
}

function createWatchlistItem(item: AnalysisItem, signal: 'NEW_POSITION' | 'CONSECUTIVE_INCREASE'): WatchlistItem {
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

export function generateWebData(analysisResult: AnalysisResult): WebData {
  const { analysis, quarterlyData, source } = analysisResult;
  const items = Object.values(analysis);
  const dates = quarterlyData.map(q => q.date);
  
  const exclusionList: ExclusionItem[] = [];
  
  items.filter(i => i.consecutiveDecreases >= 2).forEach(item => {
    exclusionList.push(createExclusionItem(item, 'CONSECUTIVE_DECREASE'));
  });

  items.filter(i => i.changes[0]?.type === 'LIQUIDATED').forEach(item => {
    exclusionList.push(createExclusionItem(item, 'LIQUIDATED'));
  });

  const watchlist: WatchlistItem[] = [];

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
