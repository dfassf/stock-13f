/**
 * Step 2: 분기별 13F 데이터 비교 (Diff)
 * 목표: 신규편입 / 비중증가 / 청산 감지
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
  
  // index.json에서 XML 파일 찾기
  const indexUrl = `${baseUrl}/index.json`;
  const indexResponse = await axios.get(indexUrl, { headers });
  const files = indexResponse.data.directory?.item || [];
  
  // XML 파일 찾기 (primary_doc.xml 제외)
  const xmlFile = files.find(f => 
    f.name.endsWith('.xml') && f.name !== 'primary_doc.xml'
  );
  
  if (!xmlFile) {
    throw new Error('XML 파일을 찾을 수 없음');
  }
  
  // XML 다운로드
  const xmlUrl = `${baseUrl}/${xmlFile.name}`;
  const xmlResponse = await axios.get(xmlUrl, { 
    headers: { ...headers, 'Accept': 'application/xml' }
  });
  
  return parser.parse(xmlResponse.data);
}

// 종목별로 데이터 정리 (같은 종목 합산)
function aggregateHoldings(parsed) {
  let holdings = parsed.informationTable?.infoTable || parsed.infoTable || [];
  if (!Array.isArray(holdings)) holdings = [holdings];
  
  const aggregated = {};
  
  for (const h of holdings) {
    const name = h.nameOfIssuer || 'UNKNOWN';
    const cusip = h.cusip || 'UNKNOWN';
    const value = parseInt(h.value) || 0; // 천 달러 단위
    const shares = parseInt(h.shrsOrPrnAmt?.sshPrnamt) || 0;
    
    const key = cusip; // CUSIP으로 식별
    
    if (!aggregated[key]) {
      aggregated[key] = {
        name,
        cusip,
        value: 0,
        shares: 0
      };
    }
    
    aggregated[key].value += value;
    aggregated[key].shares += shares;
  }
  
  return aggregated;
}

// Diff 계산
function calculateDiff(current, previous) {
  const result = {
    newPositions: [],      // 신규 편입
    increased: [],         // 비중 증가
    decreased: [],         // 비중 감소
    liquidated: [],        // 청산
    unchanged: []          // 변동 없음
  };
  
  const currentKeys = new Set(Object.keys(current));
  const previousKeys = new Set(Object.keys(previous));
  
  // 신규 편입: current에만 있음
  for (const key of currentKeys) {
    if (!previousKeys.has(key)) {
      result.newPositions.push({
        ...current[key],
        changeType: 'NEW'
      });
    }
  }
  
  // 청산: previous에만 있음
  for (const key of previousKeys) {
    if (!currentKeys.has(key)) {
      result.liquidated.push({
        ...previous[key],
        changeType: 'LIQUIDATED'
      });
    }
  }
  
  // 비중 변화: 둘 다 있음
  for (const key of currentKeys) {
    if (previousKeys.has(key)) {
      const curr = current[key];
      const prev = previous[key];
      
      const shareChange = curr.shares - prev.shares;
      const shareChangePercent = prev.shares > 0 
        ? ((shareChange / prev.shares) * 100).toFixed(2)
        : 0;
      
      const item = {
        ...curr,
        prevShares: prev.shares,
        prevValue: prev.value,
        shareChange,
        shareChangePercent: parseFloat(shareChangePercent)
      };
      
      if (shareChange > 0) {
        item.changeType = 'INCREASED';
        result.increased.push(item);
      } else if (shareChange < 0) {
        item.changeType = 'DECREASED';
        result.decreased.push(item);
      } else {
        item.changeType = 'UNCHANGED';
        result.unchanged.push(item);
      }
    }
  }
  
  // 정렬: 변화량 기준
  result.increased.sort((a, b) => b.shareChangePercent - a.shareChangePercent);
  result.decreased.sort((a, b) => a.shareChangePercent - b.shareChangePercent);
  result.newPositions.sort((a, b) => b.value - a.value);
  result.liquidated.sort((a, b) => b.value - a.value);
  
  return result;
}

// 결과 출력
function printResults(diff, currentDate, previousDate) {
  console.log('\n========================================');
  console.log(`  13F 변화 분석`);
  console.log(`  현재: ${currentDate}`);
  console.log(`  이전: ${previousDate}`);
  console.log('========================================\n');
  
  // 신규 편입
  console.log(`🟢 신규 편입 (${diff.newPositions.length}개)`);
  console.log('─'.repeat(50));
  if (diff.newPositions.length === 0) {
    console.log('  없음');
  } else {
    diff.newPositions.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name}`);
      console.log(`     가치: $${(p.value / 1000).toFixed(1)}M | 주식수: ${p.shares.toLocaleString()}`);
    });
  }
  
  // 비중 증가
  console.log(`\n📈 비중 증가 (${diff.increased.length}개)`);
  console.log('─'.repeat(50));
  diff.increased.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     변화: +${p.shareChangePercent}% | +${p.shareChange.toLocaleString()} 주`);
  });
  
  // 비중 감소
  console.log(`\n📉 비중 감소 (${diff.decreased.length}개)`);
  console.log('─'.repeat(50));
  diff.decreased.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     변화: ${p.shareChangePercent}% | ${p.shareChange.toLocaleString()} 주`);
  });
  
  // 청산
  console.log(`\n🔴 청산 (${diff.liquidated.length}개)`);
  console.log('─'.repeat(50));
  if (diff.liquidated.length === 0) {
    console.log('  없음');
  } else {
    diff.liquidated.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name}`);
      console.log(`     이전 가치: $${(p.value / 1000).toFixed(1)}M | 주식수: ${p.shares.toLocaleString()}`);
    });
  }
  
  // 요약
  console.log('\n========================================');
  console.log('  요약');
  console.log('========================================');
  console.log(`  신규 편입: ${diff.newPositions.length}개`);
  console.log(`  비중 증가: ${diff.increased.length}개`);
  console.log(`  비중 감소: ${diff.decreased.length}개`);
  console.log(`  청산: ${diff.liquidated.length}개`);
  console.log(`  변동 없음: ${diff.unchanged.length}개`);
}

// 메인
async function main() {
  console.log('Step 2: 분기별 13F Diff 분석 시작...\n');
  
  try {
    // 13F 목록 가져오기
    console.log('1. 13F 파일 목록 조회 중...');
    const filings = await get13FFilings();
    console.log(`   ${filings.length}개 13F-HR 발견`);
    
    if (filings.length < 2) {
      console.log('❌ 비교할 데이터 부족 (최소 2개 필요)');
      return;
    }
    
    const current = filings[0];  // 최신
    const previous = filings[1]; // 이전 분기
    
    console.log(`   현재: ${current.filingDate}`);
    console.log(`   이전: ${previous.filingDate}`);
    
    // 현재 분기 데이터
    console.log('\n2. 현재 분기 데이터 다운로드 중...');
    const currentParsed = await download13F(current.accessionNumber);
    const currentHoldings = aggregateHoldings(currentParsed);
    console.log(`   ${Object.keys(currentHoldings).length}개 종목`);
    
    // 이전 분기 데이터
    console.log('\n3. 이전 분기 데이터 다운로드 중...');
    const previousParsed = await download13F(previous.accessionNumber);
    const previousHoldings = aggregateHoldings(previousParsed);
    console.log(`   ${Object.keys(previousHoldings).length}개 종목`);
    
    // Diff 계산
    console.log('\n4. 변화 분석 중...');
    const diff = calculateDiff(currentHoldings, previousHoldings);
    
    // 결과 출력
    printResults(diff, current.filingDate, previous.filingDate);
    
    console.log('\n✅ Step 2 완료');
    
  } catch (error) {
    console.log(`\n❌ 오류: ${error.message}`);
    console.log(error.stack);
  }
}

main();

