/**
 * Step 3: 연속 분기 변화 추적
 * 목표: 연속 감축/증가 종목 식별
 */

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

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
  
  if (!xmlFile) {
    throw new Error('XML 파일을 찾을 수 없음');
  }
  
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

// 연속 변화 분석
function analyzeConsecutiveChanges(quarterlyData) {
  // quarterlyData: [Q0(최신), Q1, Q2, Q3, ...]
  
  const allCusips = new Set();
  quarterlyData.forEach(q => {
    Object.keys(q.holdings).forEach(k => allCusips.add(k));
  });
  
  const analysis = {};
  
  for (const cusip of allCusips) {
    const history = quarterlyData.map(q => ({
      date: q.date,
      shares: q.holdings[cusip]?.shares || 0,
      value: q.holdings[cusip]?.value || 0,
      name: q.holdings[cusip]?.name || null
    }));
    
    // 이름 찾기 (가장 최근 데이터에서)
    const name = history.find(h => h.name)?.name || 'UNKNOWN';
    
    // 변화 계산
    const changes = [];
    for (let i = 0; i < history.length - 1; i++) {
      const curr = history[i].shares;
      const prev = history[i + 1].shares;
      
      if (prev === 0 && curr > 0) {
        changes.push({ type: 'NEW', percent: 100 });
      } else if (prev > 0 && curr === 0) {
        changes.push({ type: 'LIQUIDATED', percent: -100 });
      } else if (prev > 0) {
        const pct = ((curr - prev) / prev) * 100;
        changes.push({ 
          type: pct > 0 ? 'INCREASE' : pct < 0 ? 'DECREASE' : 'UNCHANGED',
          percent: pct
        });
      } else {
        changes.push({ type: 'UNCHANGED', percent: 0 });
      }
    }
    
    // 연속 패턴 분석
    let consecutiveDecreases = 0;
    let consecutiveIncreases = 0;
    
    for (const c of changes) {
      if (c.type === 'DECREASE' || c.type === 'LIQUIDATED') {
        consecutiveDecreases++;
      } else {
        break;
      }
    }
    
    for (const c of changes) {
      if (c.type === 'INCREASE' || c.type === 'NEW') {
        consecutiveIncreases++;
      } else {
        break;
      }
    }
    
    analysis[cusip] = {
      name,
      cusip,
      history,
      changes,
      consecutiveDecreases,
      consecutiveIncreases,
      currentShares: history[0].shares,
      currentValue: history[0].value
    };
  }
  
  return analysis;
}

// 결과 출력
function printResults(analysis, dates) {
  console.log('\n========================================');
  console.log('  연속 분기 변화 분석');
  console.log(`  분석 기간: ${dates[dates.length - 1]} ~ ${dates[0]}`);
  console.log(`  분석 분기: ${dates.length}개`);
  console.log('========================================\n');
  
  const items = Object.values(analysis);
  
  // 🔴 연속 감축 (2분기 이상)
  const consecutiveDecreasers = items
    .filter(i => i.consecutiveDecreases >= 2)
    .sort((a, b) => b.consecutiveDecreases - a.consecutiveDecreases);
  
  console.log(`🔴 연속 감축 종목 (2분기 이상) - ${consecutiveDecreasers.length}개`);
  console.log('─'.repeat(60));
  if (consecutiveDecreasers.length === 0) {
    console.log('  없음');
  } else {
    consecutiveDecreasers.forEach((item, i) => {
      console.log(`\n  ${i + 1}. ${item.name}`);
      console.log(`     연속 감축: ${item.consecutiveDecreases}분기`);
      console.log(`     현재 보유: ${item.currentShares.toLocaleString()} 주`);
      console.log(`     분기별 변화:`);
      item.changes.slice(0, 4).forEach((c, idx) => {
        const arrow = c.percent > 0 ? '📈' : c.percent < 0 ? '📉' : '➡️';
        console.log(`       ${dates[idx]} → ${dates[idx + 1]}: ${arrow} ${c.percent.toFixed(1)}%`);
      });
    });
  }
  
  // 🟢 연속 증가 (2분기 이상)
  const consecutiveIncreasers = items
    .filter(i => i.consecutiveIncreases >= 2 && i.currentShares > 0)
    .sort((a, b) => b.consecutiveIncreases - a.consecutiveIncreases);
  
  console.log(`\n\n🟢 연속 증가 종목 (2분기 이상) - ${consecutiveIncreasers.length}개`);
  console.log('─'.repeat(60));
  if (consecutiveIncreasers.length === 0) {
    console.log('  없음');
  } else {
    consecutiveIncreasers.forEach((item, i) => {
      console.log(`\n  ${i + 1}. ${item.name}`);
      console.log(`     연속 증가: ${item.consecutiveIncreases}분기`);
      console.log(`     현재 보유: ${item.currentShares.toLocaleString()} 주`);
      console.log(`     분기별 변화:`);
      item.changes.slice(0, 4).forEach((c, idx) => {
        const arrow = c.percent > 0 ? '📈' : c.percent < 0 ? '📉' : '➡️';
        console.log(`       ${dates[idx]} → ${dates[idx + 1]}: ${arrow} ${c.percent.toFixed(1)}%`);
      });
    });
  }
  
  // 🔴 최근 청산
  const recentlyLiquidated = items
    .filter(i => i.changes[0]?.type === 'LIQUIDATED')
    .sort((a, b) => b.history[1]?.value - a.history[1]?.value);
  
  console.log(`\n\n🔴 최근 청산 종목 - ${recentlyLiquidated.length}개`);
  console.log('─'.repeat(60));
  if (recentlyLiquidated.length === 0) {
    console.log('  없음');
  } else {
    recentlyLiquidated.forEach((item, i) => {
      const prevValue = item.history[1]?.value || 0;
      console.log(`  ${i + 1}. ${item.name}`);
      console.log(`     청산 전 가치: $${(prevValue / 1000).toFixed(1)}M`);
    });
  }
  
  // 요약
  console.log('\n\n========================================');
  console.log('  리스크 요약 (매수 제외 대상)');
  console.log('========================================');
  
  const riskList = [
    ...consecutiveDecreasers.map(i => ({ name: i.name, reason: `연속 ${i.consecutiveDecreases}분기 감축` })),
    ...recentlyLiquidated.map(i => ({ name: i.name, reason: '청산' }))
  ];
  
  if (riskList.length === 0) {
    console.log('  리스크 종목 없음');
  } else {
    riskList.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} - ${r.reason}`);
    });
  }
}

// 메인
async function main() {
  console.log('Step 3: 연속 분기 변화 분석 시작...\n');
  
  try {
    // 13F 목록 가져오기
    console.log('1. 13F 파일 목록 조회 중...');
    const filings = await get13FFilings();
    
    // 최근 4분기 분석
    const numQuarters = 4;
    const recentFilings = filings.slice(0, numQuarters);
    
    console.log(`   최근 ${numQuarters}분기 분석 대상:`);
    recentFilings.forEach((f, i) => {
      console.log(`     Q${i}: ${f.filingDate}`);
    });
    
    // 각 분기 데이터 다운로드
    const quarterlyData = [];
    
    for (let i = 0; i < recentFilings.length; i++) {
      console.log(`\n2-${i + 1}. ${recentFilings[i].filingDate} 데이터 다운로드 중...`);
      const parsed = await download13F(recentFilings[i].accessionNumber);
      const holdings = aggregateHoldings(parsed);
      quarterlyData.push({
        date: recentFilings[i].filingDate,
        holdings
      });
      console.log(`      ${Object.keys(holdings).length}개 종목`);
    }
    
    // 연속 변화 분석
    console.log('\n3. 연속 변화 분석 중...');
    const analysis = analyzeConsecutiveChanges(quarterlyData);
    
    // 결과 출력
    const dates = quarterlyData.map(q => q.date);
    printResults(analysis, dates);
    
    console.log('\n✅ Step 3 완료');
    
  } catch (error) {
    console.log(`\n❌ 오류: ${error.message}`);
    console.log(error.stack);
  }
}

main();

