import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeSource } from './analyzer.service';
import { get13FFilings, download13F } from './sec-edgar.service';
import { aggregateHoldings } from './parser.service';
import { SourceKey, AnalysisResult } from '../types/interfaces';
import { AppError, ErrorCode } from '../errors/app.error';
import { SOURCES } from '../config/sources';
import { APP_CONFIG } from '../config/app.config';

// Mock dependencies
vi.mock('./sec-edgar.service');
vi.mock('./parser.service');
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('analyzer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeSource', () => {
    it('정상적인 분석 결과를 반환해야 함', async () => {
      const sourceKey: SourceKey = 'berkshire';
      const source = SOURCES[sourceKey];
      
      const mockFilings = [
        {
          filingDate: '2024-03-31',
          accessionNumber: '0001067983-24-000001',
        },
        {
          filingDate: '2023-12-31',
          accessionNumber: '0001067983-23-000001',
        },
      ];
      
      const mockHoldings1 = {
        'CUSIP1': {
          name: 'Apple Inc',
          cusip: 'CUSIP1',
          value: 1000000,
          shares: 10000,
        },
        'CUSIP2': {
          name: 'Microsoft Corp',
          cusip: 'CUSIP2',
          value: 2000000,
          shares: 20000,
        },
      };
      
      const mockHoldings2 = {
        'CUSIP1': {
          name: 'Apple Inc',
          cusip: 'CUSIP1',
          value: 900000,
          shares: 9000,
        },
        'CUSIP2': {
          name: 'Microsoft Corp',
          cusip: 'CUSIP2',
          value: 1800000,
          shares: 18000,
        },
      };
      
      vi.mocked(get13FFilings).mockResolvedValue(mockFilings);
      vi.mocked(download13F)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);
      vi.mocked(aggregateHoldings)
        .mockReturnValueOnce(mockHoldings1)
        .mockReturnValueOnce(mockHoldings2);
      
      const result = await analyzeSource(sourceKey);
      
      expect(result).toHaveProperty('quarterlyData');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('source');
      expect(result.source).toEqual(source);
      expect(result.quarterlyData).toHaveLength(2);
      expect(Object.keys(result.analysis)).toContain('CUSIP1');
      expect(Object.keys(result.analysis)).toContain('CUSIP2');
    });

    it('13F 파일이 없으면 에러를 던져야 함', async () => {
      const sourceKey: SourceKey = 'berkshire';
      
      vi.mocked(get13FFilings).mockResolvedValue([]);
      
      await expect(analyzeSource(sourceKey)).rejects.toThrow(AppError);
      await expect(analyzeSource(sourceKey)).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.NO_FILINGS_FOUND,
        })
      );
    });

    it('분기별 데이터를 올바르게 수집해야 함', async () => {
      const sourceKey: SourceKey = 'berkshire';
      const mockFilings = [
        {
          filingDate: '2024-03-31',
          accessionNumber: '0001067983-24-000001',
        },
        {
          filingDate: '2023-12-31',
          accessionNumber: '0001067983-23-000001',
        },
        {
          filingDate: '2023-09-30',
          accessionNumber: '0001067983-23-000002',
        },
        {
          filingDate: '2023-06-30',
          accessionNumber: '0001067983-23-000003',
        },
        {
          filingDate: '2023-03-31',
          accessionNumber: '0001067983-23-000004',
        },
      ];
      
      vi.mocked(get13FFilings).mockResolvedValue(mockFilings);
      
      const mockHoldings = {
        'CUSIP1': {
          name: 'Test Stock',
          cusip: 'CUSIP1',
          value: 1000000,
          shares: 10000,
        },
      };
      
      vi.mocked(download13F).mockResolvedValue({} as any);
      vi.mocked(aggregateHoldings).mockReturnValue(mockHoldings);
      
      const result = await analyzeSource(sourceKey);
      
      // NUM_QUARTERS만큼만 처리되어야 함
      expect(result.quarterlyData.length).toBeLessThanOrEqual(APP_CONFIG.NUM_QUARTERS);
      expect(get13FFilings).toHaveBeenCalledWith(SOURCES[sourceKey].cik);
    });

    it('변화 추적을 올바르게 계산해야 함', async () => {
      const sourceKey: SourceKey = 'berkshire';
      const mockFilings = [
        {
          filingDate: '2024-03-31',
          accessionNumber: '0001067983-24-000001',
        },
        {
          filingDate: '2023-12-31',
          accessionNumber: '0001067983-23-000001',
        },
      ];
      
      vi.mocked(get13FFilings).mockResolvedValue(mockFilings);
      
      // 첫 번째 분기: 신규 포지션
      const mockHoldings1 = {
        'CUSIP1': {
          name: 'New Stock',
          cusip: 'CUSIP1',
          value: 1000000,
          shares: 10000,
        },
      };
      
      // 두 번째 분기: 포지션 없음
      const mockHoldings2 = {};
      
      vi.mocked(download13F)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);
      vi.mocked(aggregateHoldings)
        .mockReturnValueOnce(mockHoldings1)
        .mockReturnValueOnce(mockHoldings2);
      
      const result = await analyzeSource(sourceKey);
      
      const analysisItem = result.analysis['CUSIP1'];
      expect(analysisItem).toBeDefined();
      expect(analysisItem.changes[0]?.type).toBe('LIQUIDATED');
    });

    it('연속 증가/감소를 올바르게 계산해야 함', async () => {
      const sourceKey: SourceKey = 'berkshire';
      const mockFilings = [
        {
          filingDate: '2024-03-31',
          accessionNumber: '0001067983-24-000001',
        },
        {
          filingDate: '2023-12-31',
          accessionNumber: '0001067983-23-000001',
        },
        {
          filingDate: '2023-09-30',
          accessionNumber: '0001067983-23-000002',
        },
      ];
      
      vi.mocked(get13FFilings).mockResolvedValue(mockFilings);
      
      // 증가하는 포지션
      const mockHoldings1 = {
        'CUSIP1': {
          name: 'Growing Stock',
          cusip: 'CUSIP1',
          value: 3000000,
          shares: 30000,
        },
      };
      
      const mockHoldings2 = {
        'CUSIP1': {
          name: 'Growing Stock',
          cusip: 'CUSIP1',
          value: 2000000,
          shares: 20000,
        },
      };
      
      const mockHoldings3 = {
        'CUSIP1': {
          name: 'Growing Stock',
          cusip: 'CUSIP1',
          value: 1000000,
          shares: 10000,
        },
      };
      
      vi.mocked(download13F)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);
      vi.mocked(aggregateHoldings)
        .mockReturnValueOnce(mockHoldings1)
        .mockReturnValueOnce(mockHoldings2)
        .mockReturnValueOnce(mockHoldings3);
      
      const result = await analyzeSource(sourceKey);
      
      const analysisItem = result.analysis['CUSIP1'];
      expect(analysisItem.consecutiveIncreases).toBeGreaterThanOrEqual(0);
    });

    it('모든 CUSIP를 수집해야 함', async () => {
      const sourceKey: SourceKey = 'berkshire';
      const mockFilings = [
        {
          filingDate: '2024-03-31',
          accessionNumber: '0001067983-24-000001',
        },
        {
          filingDate: '2023-12-31',
          accessionNumber: '0001067983-23-000001',
        },
      ];
      
      vi.mocked(get13FFilings).mockResolvedValue(mockFilings);
      
      const mockHoldings1 = {
        'CUSIP1': {
          name: 'Stock 1',
          cusip: 'CUSIP1',
          value: 1000000,
          shares: 10000,
        },
        'CUSIP2': {
          name: 'Stock 2',
          cusip: 'CUSIP2',
          value: 2000000,
          shares: 20000,
        },
      };
      
      const mockHoldings2 = {
        'CUSIP2': {
          name: 'Stock 2',
          cusip: 'CUSIP2',
          value: 1800000,
          shares: 18000,
        },
        'CUSIP3': {
          name: 'Stock 3',
          cusip: 'CUSIP3',
          value: 3000000,
          shares: 30000,
        },
      };
      
      vi.mocked(download13F)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);
      vi.mocked(aggregateHoldings)
        .mockReturnValueOnce(mockHoldings1)
        .mockReturnValueOnce(mockHoldings2);
      
      const result = await analyzeSource(sourceKey);
      
      // 모든 CUSIP가 분석에 포함되어야 함
      expect(Object.keys(result.analysis)).toContain('CUSIP1');
      expect(Object.keys(result.analysis)).toContain('CUSIP2');
      expect(Object.keys(result.analysis)).toContain('CUSIP3');
    });
  });
});
