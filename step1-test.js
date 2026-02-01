/**
 * Step 1: SEC EDGAR 접근 테스트
 * 목표: 버크셔 해서웨이 13F 데이터에 접근 가능한지 확인
 */

const axios = require('axios');

const BERKSHIRE_CIK = '0001067983';

// SEC EDGAR API는 User-Agent 헤더 필수
const headers = {
  'User-Agent': 'Test test@example.com',
  'Accept': 'application/json'
};

async function step1_testBasicAccess() {
  console.log('=== Step 1.1: SEC EDGAR 기본 접근 테스트 ===\n');
  
  try {
    // SEC EDGAR 회사 정보 API
    const url = `https://data.sec.gov/submissions/CIK${BERKSHIRE_CIK}.json`;
    console.log(`요청 URL: ${url}`);
    
    const response = await axios.get(url, { headers });
    
    console.log(`상태 코드: ${response.status}`);
    console.log(`회사명: ${response.data.name}`);
    console.log(`CIK: ${response.data.cik}`);
    
    // 13F 파일 있는지 확인
    const filings = response.data.filings?.recent;
    if (filings) {
      const forms = filings.form || [];
      const thirteenF_count = forms.filter(f => f.includes('13F')).length;
      console.log(`\n최근 제출 문서 수: ${forms.length}`);
      console.log(`13F 관련 문서 수: ${thirteenF_count}`);
    }
    
    console.log('\n✅ Step 1.1 성공: SEC EDGAR 접근 가능\n');
    return response.data;
    
  } catch (error) {
    console.log(`\n❌ Step 1.1 실패: ${error.message}`);
    if (error.response) {
      console.log(`상태 코드: ${error.response.status}`);
    }
    return null;
  }
}

async function step1_find13FFilings(companyData) {
  console.log('=== Step 1.2: 13F 파일 목록 찾기 ===\n');
  
  if (!companyData) {
    console.log('❌ 회사 데이터 없음');
    return null;
  }
  
  const filings = companyData.filings?.recent;
  if (!filings) {
    console.log('❌ 파일 목록 없음');
    return null;
  }
  
  // 13F-HR 찾기
  const thirteenF_indices = [];
  for (let i = 0; i < filings.form.length; i++) {
    if (filings.form[i] === '13F-HR') {
      thirteenF_indices.push(i);
    }
  }
  
  if (thirteenF_indices.length === 0) {
    console.log('❌ 13F-HR 파일 없음');
    return null;
  }
  
  console.log(`13F-HR 파일 수: ${thirteenF_indices.length}`);
  console.log('\n최근 5개 13F-HR:');
  
  const recent13F = [];
  for (let i = 0; i < Math.min(5, thirteenF_indices.length); i++) {
    const idx = thirteenF_indices[i];
    const filing = {
      form: filings.form[idx],
      filingDate: filings.filingDate[idx],
      accessionNumber: filings.accessionNumber[idx],
      primaryDocument: filings.primaryDocument[idx]
    };
    recent13F.push(filing);
    console.log(`  ${i + 1}. ${filing.filingDate} - ${filing.accessionNumber}`);
  }
  
  console.log('\n✅ Step 1.2 성공: 13F 파일 목록 확인\n');
  return recent13F;
}

async function step1_download13F(filing) {
  console.log('=== Step 1.3: 13F XML 파일 다운로드 ===\n');
  
  if (!filing) {
    console.log('❌ 파일 정보 없음');
    return null;
  }
  
  // accessionNumber에서 하이픈 제거
  const accessionClean = filing.accessionNumber.replace(/-/g, '');
  
  // 13F 정보 테이블 XML URL 구성
  // 형식: https://www.sec.gov/Archives/edgar/data/{CIK}/{accession}/infotable.xml
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${BERKSHIRE_CIK}/${accessionClean}`;
  
  console.log(`기본 URL: ${baseUrl}`);
  
  // 먼저 filing index 확인
  try {
    const indexUrl = `${baseUrl}/index.json`;
    console.log(`인덱스 URL: ${indexUrl}`);
    
    const indexResponse = await axios.get(indexUrl, { headers });
    const files = indexResponse.data.directory?.item || [];
    
    console.log(`\n파일 목록:`);
    files.forEach(f => console.log(`  - ${f.name}`));
    
    // infotable.xml 또는 비슷한 파일 찾기
    const infoTableFile = files.find(f => 
      f.name.toLowerCase().includes('infotable') || 
      f.name.toLowerCase().includes('13f') && f.name.endsWith('.xml')
    );
    
    if (infoTableFile) {
      console.log(`\n✅ 정보 테이블 파일 발견: ${infoTableFile.name}`);
      return {
        url: `${baseUrl}/${infoTableFile.name}`,
        filename: infoTableFile.name
      };
    } else {
      console.log('\n⚠️ infotable.xml 직접 찾지 못함, 목록에서 XML 파일 확인 필요');
      const xmlFiles = files.filter(f => f.name.endsWith('.xml'));
      console.log('XML 파일들:', xmlFiles.map(f => f.name));
      
      if (xmlFiles.length > 0) {
        return {
          url: `${baseUrl}/${xmlFiles[0].name}`,
          filename: xmlFiles[0].name
        };
      }
    }
    
  } catch (error) {
    console.log(`❌ 인덱스 조회 실패: ${error.message}`);
  }
  
  return null;
}

async function step1_parseXML(fileInfo) {
  console.log('=== Step 1.4: XML 파싱 테스트 ===\n');
  
  if (!fileInfo) {
    console.log('❌ 파일 정보 없음');
    return;
  }
  
  const { XMLParser } = require('fast-xml-parser');
  
  try {
    console.log(`다운로드 URL: ${fileInfo.url}`);
    
    const response = await axios.get(fileInfo.url, { 
      headers: { ...headers, 'Accept': 'application/xml' }
    });
    
    console.log(`상태 코드: ${response.status}`);
    console.log(`데이터 크기: ${response.data.length} bytes\n`);
    
    // XML 파싱
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    
    const parsed = parser.parse(response.data);
    
    // 구조 확인
    console.log('XML 최상위 키:', Object.keys(parsed));
    
    // infoTable 찾기
    let holdings = null;
    if (parsed.informationTable?.infoTable) {
      holdings = parsed.informationTable.infoTable;
    } else if (parsed.infoTable) {
      holdings = parsed.infoTable;
    }
    
    if (holdings) {
      const holdingsList = Array.isArray(holdings) ? holdings : [holdings];
      console.log(`\n보유 종목 수: ${holdingsList.length}`);
      
      console.log('\n상위 10개 종목:');
      for (let i = 0; i < Math.min(10, holdingsList.length); i++) {
        const h = holdingsList[i];
        const name = h.nameOfIssuer || h.issuerName || 'N/A';
        const value = h.value || h.marketValue || 'N/A';
        const shares = h.shrsOrPrnAmt?.sshPrnamt || h.sharesOrPrincipalAmount || 'N/A';
        console.log(`  ${i + 1}. ${name} - $${value}K - ${shares} shares`);
      }
      
      console.log('\n✅ Step 1.4 성공: XML 파싱 완료\n');
    } else {
      console.log('⚠️ infoTable 구조를 찾지 못함');
      console.log('실제 구조:', JSON.stringify(parsed, null, 2).substring(0, 1000));
    }
    
  } catch (error) {
    console.log(`❌ XML 파싱 실패: ${error.message}`);
  }
}

// 실행
async function main() {
  console.log('========================================');
  console.log('  SEC EDGAR 13F 데이터 접근 테스트');
  console.log('  대상: Berkshire Hathaway');
  console.log('========================================\n');
  
  // Step 1.1: 기본 접근
  const companyData = await step1_testBasicAccess();
  
  // Step 1.2: 13F 목록
  const filings = await step1_find13FFilings(companyData);
  
  // Step 1.3: 최신 13F 다운로드 정보
  const fileInfo = await step1_download13F(filings?.[0]);
  
  // Step 1.4: XML 파싱
  await step1_parseXML(fileInfo);
  
  console.log('========================================');
  console.log('  테스트 완료');
  console.log('========================================');
}

main();

