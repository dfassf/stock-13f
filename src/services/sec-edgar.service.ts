import axios, { AxiosError } from 'axios';
import { headers, parser } from '../config/sources';
import { APP_CONFIG } from '../config/app.config';
import { Filing } from '../types/interfaces';
import { ParsedXML, SECDirectoryResponse, SECFilingsResponse, SECDirectoryItem } from '../types/xml.types';

const axiosConfig = {
  timeout: APP_CONFIG.API_TIMEOUT,
  headers
};

export async function get13FFilings(cik: string): Promise<Filing[]> {
  try {
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const response = await axios.get<SECFilingsResponse>(url, axiosConfig);
    
    const filings = response.data.filings?.recent;
    if (!filings || !filings.form || !filings.filingDate || !filings.accessionNumber) {
      throw new Error('SEC API 응답 형식이 올바르지 않습니다');
    }
    
    const thirteenF: Filing[] = [];
    
    for (let i = 0; i < filings.form.length; i++) {
      if (filings.form[i] === '13F-HR' && filings.filingDate[i] && filings.accessionNumber[i]) {
        thirteenF.push({
          filingDate: filings.filingDate[i],
          accessionNumber: filings.accessionNumber[i]
        });
      }
    }
    
    if (thirteenF.length === 0) {
      throw new Error('13F-HR 파일을 찾을 수 없습니다');
    }
    
    return thirteenF;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('SEC API 요청 시간 초과');
      }
      throw new Error(`SEC API 요청 실패: ${error.message}`);
    }
    throw error;
  }
}

export async function download13F(cik: string, accessionNumber: string): Promise<ParsedXML> {
  try {
    const accessionClean = accessionNumber.replace(/-/g, '');
    const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionClean}`;
    
    const indexUrl = `${baseUrl}/index.json`;
    const indexResponse = await axios.get<SECDirectoryResponse>(indexUrl, axiosConfig);
    
    const items = indexResponse.data.directory?.item;
    if (!items) {
      throw new Error('디렉토리 정보를 찾을 수 없습니다');
    }
    
    const files: SECDirectoryItem[] = Array.isArray(items) ? items : [items];
    
    const xmlFile = files.find(f => 
      f.name && f.name.endsWith('.xml') && f.name !== 'primary_doc.xml'
    );
    
    if (!xmlFile || !xmlFile.name) {
      throw new Error('XML 파일을 찾을 수 없습니다');
    }
    
    const xmlUrl = `${baseUrl}/${xmlFile.name}`;
    const xmlResponse = await axios.get<string>(xmlUrl, { 
      ...axiosConfig,
      headers: { ...headers, 'Accept': 'application/xml' }
    });
    
    return parser.parse(xmlResponse.data) as ParsedXML;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('XML 다운로드 시간 초과');
      }
      throw new Error(`XML 다운로드 실패: ${error.message}`);
    }
    throw error;
  }
}
