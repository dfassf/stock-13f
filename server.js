/**
 * Hono 서버 - 13F Signal Tracker
 */

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const app = new Hono();

// 소스 정의
const SOURCES = {
  berkshire: {
    name: 'Berkshire Hathaway',
    cik: '0001067983',
    flag: '🇺🇸'
  },
  nps: {
    name: 'National Pension Service (국민연금)',
    cik: '0001608046',
    flag: '🇰🇷'
  }
};

const headers = {
  'User-Agent': 'Test test@example.com',
  'Accept': 'application/json'
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

// 캐시 (메모리)
const cache = {
  berkshire: null,
  nps: null,
  lastUpdated: {}
};

// 13F 파일 목록 가져오기
async function get13FFilings(cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const response = await axios.get(url, { headers });
  
  const filings = response.data.filings?.recent;
  const thirteenF = [];
  
  for (let i = 0; i < filings.form.length; i++) {
    if (filings.form[i] === '13F-HR') {
      thirteenF.push({
        filingDate: filings.filingDate[i],
        accessionNumber: filings.accessionNumber[i]
      });
    }
  }
  
  return thirteenF;
}

// 13F XML 다운로드 및 파싱
async function download13F(cik, accessionNumber) {
  const accessionClean = accessionNumber.replace(/-/g, '');
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionClean}`;
  
  const indexUrl = `${baseUrl}/index.json`;
  const indexResponse = await axios.get(indexUrl, { headers });
  const files = indexResponse.data.directory?.item || [];
  
  const xmlFile = files.find(f => 
    f.name.endsWith('.xml') && f.name !== 'primary_doc.xml'
  );
  
  if (!xmlFile) throw new Error('XML 파일을 찾을 수 없음');
  
  const xmlUrl = `${baseUrl}/${xmlFile.name}`;
  const xmlResponse = await axios.get(xmlUrl, { 
    headers: { ...headers, 'Accept': 'application/xml' }
  });
  
  return parser.parse(xmlResponse.data);
}

// 종목별로 데이터 정리
function aggregateHoldings(parsed) {
  let holdings = 
    parsed.informationTable?.infoTable || 
    parsed.infoTable ||
    parsed['ns1:informationTable']?.['ns1:infoTable'] ||
    [];
  
  if (!Array.isArray(holdings)) holdings = [holdings];
  
  const aggregated = {};
  
  for (const h of holdings) {
    const name = h.nameOfIssuer || h['ns1:nameOfIssuer'] || 'UNKNOWN';
    const cusip = h.cusip || h['ns1:cusip'] || 'UNKNOWN';
    const value = parseInt(h.value || h['ns1:value']) || 0;
    
    const shrsOrPrnAmt = h.shrsOrPrnAmt || h['ns1:shrsOrPrnAmt'] || {};
    const shares = parseInt(shrsOrPrnAmt.sshPrnamt || shrsOrPrnAmt['ns1:sshPrnamt']) || 0;
    
    const key = cusip;
    
    if (!aggregated[key]) {
      aggregated[key] = { name, cusip, value: 0, shares: 0 };
    }
    
    aggregated[key].value += value;
    aggregated[key].shares += shares;
  }
  
  return aggregated;
}

// 분석 실행
async function analyzeSource(sourceKey) {
  const source = SOURCES[sourceKey];
  console.log(`📊 ${source.flag} ${source.name} 분석 중...`);
  
  const filings = await get13FFilings(source.cik);
  const numQuarters = 4;
  const recentFilings = filings.slice(0, numQuarters);
  
  const quarterlyData = [];
  for (const filing of recentFilings) {
    const parsed = await download13F(source.cik, filing.accessionNumber);
    const holdings = aggregateHoldings(parsed);
    quarterlyData.push({ date: filing.filingDate, holdings });
  }
  
  const allCusips = new Set();
  quarterlyData.forEach(q => Object.keys(q.holdings).forEach(k => allCusips.add(k)));
  
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
      
      let type, percent;
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

// 웹용 JSON 생성
function generateWebData(analysis, quarterlyData, source) {
  const items = Object.values(analysis);
  const dates = quarterlyData.map(q => q.date);
  
  const exclusionList = [];
  
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
  
  const watchlist = [];
  
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
  
  const metadata = {
    source: source.name,
    sourceKey: Object.keys(SOURCES).find(k => SOURCES[k].name === source.name),
    flag: source.flag,
    cik: source.cik,
    generatedAt: new Date().toISOString(),
    analyzedQuarters: dates,
    latestFiling: dates[0],
    totalPositions: portfolio.length
  };
  
  return { metadata, exclusionList, watchlist, portfolio };
}

// 데이터 가져오기 (캐시 또는 새로 수집)
async function getData(sourceKey, forceRefresh = false) {
  const now = Date.now();
  const cacheAge = now - (cache.lastUpdated[sourceKey] || 0);
  const maxAge = 60 * 60 * 1000; // 1시간
  
  if (!forceRefresh && cache[sourceKey] && cacheAge < maxAge) {
    console.log(`📦 캐시 사용 (${sourceKey})`);
    return cache[sourceKey];
  }
  
  console.log(`🔄 새로 수집 (${sourceKey})`);
  const { quarterlyData, analysis, source } = await analyzeSource(sourceKey);
  const data = generateWebData(analysis, quarterlyData, source);
  
  cache[sourceKey] = data;
  cache.lastUpdated[sourceKey] = now;
  
  return data;
}

// ==================== API 라우트 ====================

// 시그널 데이터 가져오기
app.get('/api/signals/:source', async (c) => {
  const source = c.req.param('source');
  
  if (!SOURCES[source]) {
    return c.json({ error: 'Invalid source' }, 400);
  }
  
  try {
    const data = await getData(source);
    return c.json(data);
  } catch (error) {
    console.error(`Error fetching ${source}:`, error.message);
    return c.json({ error: error.message }, 500);
  }
});

// 데이터 새로고침
app.post('/api/refresh/:source', async (c) => {
  const source = c.req.param('source');
  
  if (!SOURCES[source]) {
    return c.json({ error: 'Invalid source' }, 400);
  }
  
  try {
    const data = await getData(source, true);
    return c.json({ success: true, data });
  } catch (error) {
    console.error(`Error refreshing ${source}:`, error.message);
    return c.json({ error: error.message }, 500);
  }
});

// 소스 목록
app.get('/api/sources', (c) => {
  return c.json(SOURCES);
});

// ==================== 정적 파일 ====================

// 정적 파일 서빙 (index.html, data/ 등)
app.use('/*', serveStatic({ root: './' }));

// ==================== 서버 시작 ====================

const port = process.env.PORT || 3000;

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

