import { SOURCES } from '../config/sources';
import { APP_CONFIG } from '../config/app.config';
import { get13FFilings, download13F } from './sec-edgar.service';
import { aggregateHoldings } from './parser.service';
import { SourceKey, AnalysisResult, ChangeType, AnalysisItem } from '../types/interfaces';

export async function analyzeSource(sourceKey: SourceKey): Promise<AnalysisResult> {
  const source = SOURCES[sourceKey];
  
  const filings = await get13FFilings(source.cik);
  const numQuarters = APP_CONFIG.NUM_QUARTERS;
  const recentFilings = filings.slice(0, numQuarters);
  
  if (recentFilings.length === 0) {
    throw new Error('분석할 13F 파일이 없습니다');
  }
  
  const quarterlyDataPromises = recentFilings.map(async (filing) => {
    const parsed = await download13F(source.cik, filing.accessionNumber);
    const holdings = aggregateHoldings(parsed);
    return { date: filing.filingDate, holdings };
  });
  
  const quarterlyData = await Promise.all(quarterlyDataPromises);
  
  const allCusips = new Set<string>();
  quarterlyData.forEach(q => Object.keys(q.holdings).forEach(k => allCusips.add(k)));
  
  const analysis: Record<string, AnalysisItem> = {};
  
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
      
      let type: ChangeType;
      let percent: number;
      if (prev === 0 && curr > 0) {
        type = 'NEW'; percent = 100;
      } else if (prev > 0 && curr === 0) {
        type = 'LIQUIDATED'; percent = -100;
      } else if (prev > 0) {
        percent = ((curr - prev) / prev) * 100;
        type = percent > 0 ? 'INCREASE' : percent < 0 ? 'DECREASE' : 'UNCHANGED';
      } else {
        type = 'UNCHANGED'; percent = 0;
      }
      changes.push({ type, percent, from: history[i + 1].date, to: history[i].date });
    }
    
    let consecutiveDecreases = 0;
    let consecutiveIncreases = 0;
    
    for (const c of changes) {
      if (c.type === 'DECREASE' || c.type === 'LIQUIDATED') consecutiveDecreases++;
      else break;
    }
    for (const c of changes) {
      if (c.type === 'INCREASE' || c.type === 'NEW') consecutiveIncreases++;
      else break;
    }
    
    analysis[cusip] = {
      name, cusip, history, changes,
      consecutiveDecreases, consecutiveIncreases,
      currentShares: history[0].shares,
      currentValue: history[0].value
    };
  }
  
  return { quarterlyData, analysis, source };
}
