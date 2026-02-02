"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get13FFilings = get13FFilings;
exports.download13F = download13F;
const axios_1 = __importDefault(require("axios"));
const sources_1 = require("../config/sources");
const app_config_1 = require("../config/app.config");
const app_error_1 = require("../errors/app.error");
const logger_1 = __importDefault(require("../utils/logger"));
const axiosConfig = {
    timeout: app_config_1.APP_CONFIG.API_TIMEOUT,
    headers: sources_1.headers
};
async function get13FFilings(cik) {
    try {
        const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
        logger_1.default.info({ url }, 'SEC API 요청 시작');
        const response = await axios_1.default.get(url, axiosConfig);
        const filings = response.data.filings?.recent;
        if (!filings || !filings.form || !filings.filingDate || !filings.accessionNumber) {
            logger_1.default.warn({ cik, response: response.data }, 'SEC API 응답 형식이 올바르지 않음');
            throw new app_error_1.SECAPIError('SEC API 응답 형식이 올바르지 않습니다');
        }
        const thirteenF = [];
        for (let i = 0; i < filings.form.length; i++) {
            if (filings.form[i] === '13F-HR' && filings.filingDate[i] && filings.accessionNumber[i]) {
                thirteenF.push({
                    filingDate: filings.filingDate[i],
                    accessionNumber: filings.accessionNumber[i]
                });
            }
        }
        if (thirteenF.length === 0) {
            logger_1.default.warn({ cik }, '13F-HR 파일을 찾을 수 없음');
            throw new app_error_1.AppError(app_error_1.ErrorCode.NO_FILINGS_FOUND, '13F-HR 파일을 찾을 수 없습니다', 404);
        }
        logger_1.default.info({ cik, count: thirteenF.length }, '13F 파일 발견');
        return thirteenF;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                logger_1.default.error({ cik, timeout: app_config_1.APP_CONFIG.API_TIMEOUT }, 'SEC API 요청 시간 초과');
                throw new app_error_1.TimeoutError('SEC API 요청 시간 초과', error);
            }
            logger_1.default.error({ cik, error: error.message, status: error.response?.status }, 'SEC API 요청 실패');
            throw new app_error_1.SECAPIError(`SEC API 요청 실패: ${error.message}`, error);
        }
        if (error instanceof app_error_1.AppError) {
            throw error;
        }
        logger_1.default.error({ cik, error }, '예상치 못한 에러');
        throw new app_error_1.SECAPIError('SEC API 요청 중 예상치 못한 오류가 발생했습니다', error);
    }
}
async function download13F(cik, accessionNumber) {
    try {
        const accessionClean = accessionNumber.replace(/-/g, '');
        const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionClean}`;
        const indexUrl = `${baseUrl}/index.json`;
        logger_1.default.debug({ indexUrl }, 'XML 디렉토리 조회');
        const indexResponse = await axios_1.default.get(indexUrl, axiosConfig);
        const items = indexResponse.data.directory?.item;
        if (!items) {
            logger_1.default.warn({ cik, accessionNumber }, '디렉토리 정보를 찾을 수 없음');
            throw new app_error_1.SECAPIError('디렉토리 정보를 찾을 수 없습니다');
        }
        const files = Array.isArray(items) ? items : [items];
        const xmlFile = files.find(f => f.name && f.name.endsWith('.xml') && f.name !== 'primary_doc.xml');
        if (!xmlFile || !xmlFile.name) {
            logger_1.default.warn({ cik, accessionNumber, files: files.map(f => f.name) }, 'XML 파일을 찾을 수 없음');
            throw new app_error_1.AppError(app_error_1.ErrorCode.XML_PARSE_ERROR, 'XML 파일을 찾을 수 없습니다', 404);
        }
        const xmlUrl = `${baseUrl}/${xmlFile.name}`;
        logger_1.default.debug({ xmlUrl }, 'XML 파일 다운로드');
        const xmlResponse = await axios_1.default.get(xmlUrl, {
            ...axiosConfig,
            headers: { ...sources_1.headers, 'Accept': 'application/xml' }
        });
        logger_1.default.debug({ fileName: xmlFile.name }, 'XML 파싱 완료');
        return sources_1.parser.parse(xmlResponse.data);
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                logger_1.default.error({ cik, accessionNumber }, 'XML 다운로드 시간 초과');
                throw new app_error_1.TimeoutError('XML 다운로드 시간 초과', error);
            }
            logger_1.default.error({ cik, accessionNumber, error: error.message }, 'XML 다운로드 실패');
            throw new app_error_1.SECAPIError(`XML 다운로드 실패: ${error.message}`, error);
        }
        if (error instanceof app_error_1.AppError) {
            throw error;
        }
        logger_1.default.error({ cik, accessionNumber, error }, '예상치 못한 에러');
        throw new app_error_1.SECAPIError('XML 다운로드 중 예상치 못한 오류가 발생했습니다', error);
    }
}
//# sourceMappingURL=sec-edgar.service.js.map