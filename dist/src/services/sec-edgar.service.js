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
const axiosConfig = {
    timeout: app_config_1.APP_CONFIG.API_TIMEOUT,
    headers: sources_1.headers
};
async function get13FFilings(cik) {
    try {
        const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
        const response = await axios_1.default.get(url, axiosConfig);
        const filings = response.data.filings?.recent;
        if (!filings || !filings.form || !filings.filingDate || !filings.accessionNumber) {
            throw new Error('SEC API 응답 형식이 올바르지 않습니다');
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
            throw new Error('13F-HR 파일을 찾을 수 없습니다');
        }
        return thirteenF;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('SEC API 요청 시간 초과');
            }
            throw new Error(`SEC API 요청 실패: ${error.message}`);
        }
        throw error;
    }
}
async function download13F(cik, accessionNumber) {
    try {
        const accessionClean = accessionNumber.replace(/-/g, '');
        const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionClean}`;
        const indexUrl = `${baseUrl}/index.json`;
        const indexResponse = await axios_1.default.get(indexUrl, axiosConfig);
        const items = indexResponse.data.directory?.item;
        if (!items) {
            throw new Error('디렉토리 정보를 찾을 수 없습니다');
        }
        const files = Array.isArray(items) ? items : [items];
        const xmlFile = files.find(f => f.name && f.name.endsWith('.xml') && f.name !== 'primary_doc.xml');
        if (!xmlFile || !xmlFile.name) {
            throw new Error('XML 파일을 찾을 수 없습니다');
        }
        const xmlUrl = `${baseUrl}/${xmlFile.name}`;
        const xmlResponse = await axios_1.default.get(xmlUrl, {
            ...axiosConfig,
            headers: { ...sources_1.headers, 'Accept': 'application/xml' }
        });
        return sources_1.parser.parse(xmlResponse.data);
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('XML 다운로드 시간 초과');
            }
            throw new Error(`XML 다운로드 실패: ${error.message}`);
        }
        throw error;
    }
}
//# sourceMappingURL=sec-edgar.service.js.map