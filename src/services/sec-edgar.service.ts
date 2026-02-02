import axios, { AxiosError } from 'axios';
import { headers, parser } from '../config/sources';
import { APP_CONFIG } from '../config/app.config';
import { Filing } from '../types/interfaces';
import { ParsedXML, SECDirectoryResponse, SECFilingsResponse, SECDirectoryItem } from '../types/xml.types';
import { SECAPIError, TimeoutError, AppError, ErrorCode } from '../errors/app.error';
import logger from '../utils/logger';

const axiosConfig = {
  timeout: APP_CONFIG.API_TIMEOUT,
  headers
};

export async function get13FFilings(cik: string): Promise<Filing[]> {
  try {
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    logger.info({ url }, 'SEC API 요청 시작');
    
    const response = await axios.get<SECFilingsResponse>(url, axiosConfig);
    
    const filings = response.data.filings?.recent;
    if (!filings || !filings.form || !filings.filingDate || !filings.accessionNumber) {
      logger.warn({ cik, response: response.data }, 'SEC API 응답 형식이 올바르지 않음');
      throw new SECAPIError('SEC API 응답 형식이 올바르지 않습니다');
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
      logger.warn({ cik }, '13F-HR 파일을 찾을 수 없음');
      throw new AppError(ErrorCode.NO_FILINGS_FOUND, '13F-HR 파일을 찾을 수 없습니다', 404);
    }
    
    logger.info({ cik, count: thirteenF.length }, '13F 파일 발견');
    return thirteenF;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        logger.error({ cik, timeout: APP_CONFIG.API_TIMEOUT }, 'SEC API 요청 시간 초과');
        throw new TimeoutError('SEC API 요청 시간 초과', error);
      }
      logger.error({ cik, error: error.message, status: error.response?.status }, 'SEC API 요청 실패');
      throw new SECAPIError(`SEC API 요청 실패: ${error.message}`, error);
    }
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ cik, error }, '예상치 못한 에러');
    throw new SECAPIError('SEC API 요청 중 예상치 못한 오류가 발생했습니다', error as Error);
  }
}

export async function download13F(cik: string, accessionNumber: string): Promise<ParsedXML> {
  try {
    const accessionClean = accessionNumber.replace(/-/g, '');
    const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionClean}`;
    
    const indexUrl = `${baseUrl}/index.json`;
    logger.debug({ indexUrl }, 'XML 디렉토리 조회');
    
    const indexResponse = await axios.get<SECDirectoryResponse>(indexUrl, axiosConfig);
    
    const items = indexResponse.data.directory?.item;
    if (!items) {
      logger.warn({ cik, accessionNumber }, '디렉토리 정보를 찾을 수 없음');
      throw new SECAPIError('디렉토리 정보를 찾을 수 없습니다');
    }
    
    const files: SECDirectoryItem[] = Array.isArray(items) ? items : [items];
    
    const xmlFile = files.find(f => 
      f.name && f.name.endsWith('.xml') && f.name !== 'primary_doc.xml'
    );
    
    if (!xmlFile || !xmlFile.name) {
      logger.warn({ cik, accessionNumber, files: files.map(f => f.name) }, 'XML 파일을 찾을 수 없음');
      throw new AppError(ErrorCode.XML_PARSE_ERROR, 'XML 파일을 찾을 수 없습니다', 404);
    }
    
    const xmlUrl = `${baseUrl}/${xmlFile.name}`;
    logger.debug({ xmlUrl }, 'XML 파일 다운로드');
    
    const xmlResponse = await axios.get<string>(xmlUrl, { 
      ...axiosConfig,
      headers: { ...headers, 'Accept': 'application/xml' }
    });
    
    logger.debug({ fileName: xmlFile.name }, 'XML 파싱 완료');
    return parser.parse(xmlResponse.data) as ParsedXML;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        logger.error({ cik, accessionNumber }, 'XML 다운로드 시간 초과');
        throw new TimeoutError('XML 다운로드 시간 초과', error);
      }
      logger.error({ cik, accessionNumber, error: error.message }, 'XML 다운로드 실패');
      throw new SECAPIError(`XML 다운로드 실패: ${error.message}`, error);
    }
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ cik, accessionNumber, error }, '예상치 못한 에러');
    throw new SECAPIError('XML 다운로드 중 예상치 못한 오류가 발생했습니다', error as Error);
  }
}
