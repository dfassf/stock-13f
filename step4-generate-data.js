/**
 * Step 4: 웹용 JSON 데이터 생성
 * 목표: Exclusion List + Watchlist JSON 생성
 */

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');
const path = require('path');

const BERKSHIRE_CIK = '0001067983';

const headers = {
  'User-Agent': 'Test test@example.com',
  'Accept': 'application/json'
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

// 13F 파일 목록 가져오기
async function get13FFilings() {
  const url = `https://data.sec.gov/submissions/CIK${BERKSHIRE_CIK}.json`;
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
async function download13F(accessionNumber) {
  const accessionClean = accessionNumber.replace(/-/g, '');
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${BERKSHIRE_CIK}/${accessionClean}`;
  
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
  let holdings = parsed.informationTable?.infoTable || parsed.infoTable || [];
  if (!Array.isArray(holdings)) holdings = [holdings];
  
  const aggregated = {};
  
  for (const h of holdings) {
    const name = h.nameOfIssuer || 'UNKNOWN';
    const cusip = h.cusip || 'UNKNOWN';
    const value = parseInt(h.value) || 0;
    const shares = parseInt(h.shrsOrPrnAmt?.sshPrnamt) || 0;
    
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
async function analyzeData() {
  console.log('데이터 분석 시작...\n');
  
  // 13F 목록
  const filings = await get13FFilings();
  const numQuarters = 4;
  const recentFilings = filings.slice(0, numQuarters);
  
  console.log(`최근 ${numQuarters}분기 데이터 다운로드 중...`);
  
  // 각 분기 데이터 다운로드
  const quarterlyData = [];
  for (const filing of recentFilings) {
    console.log(`  ${filing.filingDate}...`);
    const parsed = await download13F(filing.accessionNumber);
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
    
    // 변화 계산
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
    
    // 연속 패턴
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
  
  return { quarterlyData, analysis };
}

// 웹용 JSON 생성
function generateWebData(analysis, quarterlyData) {
  const items = Object.values(analysis);
  const dates = quarterlyData.map(q => q.date);
  
  // Exclusion List (매수 금지)
  const exclusionList = [];
  
  // 연속 감축 (2분기 이상)
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
  
  // 청산
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
  
  // Watchlist (참고용 - 신규편입, 연속증가)
  const watchlist = [];
  
  // 신규 편입
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
  
  // 연속 증가
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
  
  // 전체 포트폴리오 (현재 보유)
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
  
  // 메타데이터
  const metadata = {
    source: 'Berkshire Hathaway',
    cik: BERKSHIRE_CIK,
    generatedAt: new Date().toISOString(),
    analyzedQuarters: dates,
    latestFiling: dates[0],
    totalPositions: portfolio.length
  };
  
  return {
    metadata,
    exclusionList,
    watchlist,
    portfolio
  };
}

// 저장
function saveData(data) {
  const outputDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 전체 데이터
  const fullPath = path.join(outputDir, 'analysis.json');
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  console.log(`\n저장됨: ${fullPath}`);
  
  // Exclusion List만
  const exclusionPath = path.join(outputDir, 'exclusion-list.json');
  fs.writeFileSync(exclusionPath, JSON.stringify({
    metadata: data.metadata,
    exclusionList: data.exclusionList
  }, null, 2));
  console.log(`저장됨: ${exclusionPath}`);
  
  // Watchlist만
  const watchlistPath = path.join(outputDir, 'watchlist.json');
  fs.writeFileSync(watchlistPath, JSON.stringify({
    metadata: data.metadata,
    watchlist: data.watchlist
  }, null, 2));
  console.log(`저장됨: ${watchlistPath}`);
}

// 결과 출력
function printSummary(data) {
  console.log('\n========================================');
  console.log('  웹용 데이터 생성 완료');
  console.log('========================================\n');
  
  console.log('📊 메타데이터');
  console.log(`   소스: ${data.metadata.source}`);
  console.log(`   최신 공시: ${data.metadata.latestFiling}`);
  console.log(`   분석 분기: ${data.metadata.analyzedQuarters.length}개`);
  console.log(`   보유 종목: ${data.metadata.totalPositions}개`);
  
  console.log('\n🔴 Exclusion List (매수 금지)');
  data.exclusionList.forEach((item, i) => {
    const severity = item.severity === 'HIGH' ? '🔴' : '🟡';
    console.log(`   ${severity} ${i + 1}. ${item.symbol} - ${item.detail}`);
  });
  
  console.log('\n🟢 Watchlist (참고용)');
  data.watchlist.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.symbol} - ${item.detail}`);
  });
  
  console.log('\n📁 생성된 파일');
  console.log('   - data/analysis.json (전체)');
  console.log('   - data/exclusion-list.json (매수 금지)');
  console.log('   - data/watchlist.json (참고용)');
}

// 메인
async function main() {
  try {
    const { quarterlyData, analysis } = await analyzeData();
    const webData = generateWebData(analysis, quarterlyData);
    saveData(webData);
    printSummary(webData);
    console.log('\n✅ Step 4 완료');
  } catch (error) {
    console.log(`\n❌ 오류: ${error.message}`);
    console.log(error.stack);
  }
}

main();

