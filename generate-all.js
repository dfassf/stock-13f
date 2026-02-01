/**
 * 모든 소스 데이터 생성 (버크셔 + 국민연금)
 */

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');

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
  // 네임스페이스 처리 (ns1:informationTable 등)
  let holdings = 
    parsed.informationTable?.infoTable || 
    parsed.infoTable ||
    parsed['ns1:informationTable']?.['ns1:infoTable'] ||
    [];
  
  if (!Array.isArray(holdings)) holdings = [holdings];
  
  const aggregated = {};
  
  for (const h of holdings) {
    // 네임스페이스 있는 경우와 없는 경우 모두 처리
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
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${source.flag} ${source.name} 분석 시작...`);
  console.log('='.repeat(50));
  
  // 13F 목록
  const filings = await get13FFilings(source.cik);
  const numQuarters = 4;
  const recentFilings = filings.slice(0, numQuarters);
  
  console.log(`\n최근 ${numQuarters}분기 데이터 다운로드 중...`);
  
  // 각 분기 데이터 다운로드
  const quarterlyData = [];
  for (const filing of recentFilings) {
    console.log(`  ${filing.filingDate}...`);
    const parsed = await download13F(source.cik, filing.accessionNumber);
    const holdings = aggregateHoldings(parsed);
    quarterlyData.push({ date: filing.filingDate, holdings });
  }
  
  // 분석
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

// 저장
function saveData(data, sourceKey) {
  const outputDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const suffix = sourceKey === 'berkshire' ? '' : `-${sourceKey}`;
  
  const fullPath = path.join(outputDir, `analysis${suffix}.json`);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  console.log(`저장됨: ${fullPath}`);
}

// 메인
async function main() {
  console.log('🚀 모든 소스 데이터 생성 시작...');
  
  for (const sourceKey of Object.keys(SOURCES)) {
    try {
      const { quarterlyData, analysis, source } = await analyzeSource(sourceKey);
      const webData = generateWebData(analysis, quarterlyData, source);
      saveData(webData, sourceKey);
      
      console.log(`\n${source.flag} ${source.name} 완료!`);
      console.log(`  - 보유 종목: ${webData.metadata.totalPositions}개`);
      console.log(`  - Risk Signals: ${webData.exclusionList.length}개`);
      console.log(`  - Positive Signals: ${webData.watchlist.length}개`);
      
    } catch (error) {
      console.log(`\n❌ ${sourceKey} 오류: ${error.message}`);
    }
  }
  
  console.log('\n✅ 모든 데이터 생성 완료!');
}

main();

