import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateWebData } from './data-generator.service';
import { buildRelevanceContext, analyzeCurrentRelevance } from './relevance.service';
import { AnalysisResult, SourceKey, AnalysisItem, ChangeType } from '../types/interfaces';
import { SOURCES } from '../config/sources';

// Mock dependencies
vi.mock('./relevance.service', () => ({
  buildRelevanceContext: vi.fn(),
  analyzeCurrentRelevance: vi.fn(),
}));

describe('data-generator.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockAnalysisItem = (
    cusip: string,
    name: string,
    currentShares: number,
    currentValue: number,
    consecutiveDecreases: number = 0,
    consecutiveIncreases: number = 0,
    changes: Array<{ type: ChangeType; percent: number; from: string; to: string }> = []
  ): AnalysisItem => ({
    cusip,
    name,
    currentShares,
    currentValue,
    consecutiveDecreases,
    consecutiveIncreases,
    changes,
    history: [
      {
        date: '2024-03-31',
        shares: currentShares,
        value: currentValue,
        name,
      },
    ],
  });

  const createMockAnalysisResult = (
    sourceKey: SourceKey,
    analysis: Record<string, AnalysisItem>
  ): AnalysisResult => ({
    source: SOURCES[sourceKey],
    quarterlyData: [
      {
        date: '2024-03-31',
        holdings: {},
      },
    ],
    analysis,
  });

  describe('generateWebData', () => {
    it('정상적인 웹 데이터를 생성해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem('CUSIP1', 'Apple Inc', 10000, 1000000),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 1000000,
        sortedByValue: [analysis['CUSIP1']],
      });
      
      vi.mocked(analyzeCurrentRelevance).mockReturnValue({
        phase: 'BUILDING',
        momentum: 'STEADY',
        portfolioRank: 1,
        portfolioWeightPercent: 100,
        avgIncreaseRate: 10,
        increaseAcceleration: 0,
        relevanceScore: 75,
        reasoning: '유효성 높음 - 포지션 확대 중, 꾸준한 매수',
      });
      
      const webData = generateWebData(mockResult);
      
      expect(webData).toHaveProperty('metadata');
      expect(webData).toHaveProperty('exclusionList');
      expect(webData).toHaveProperty('watchlist');
      expect(webData).toHaveProperty('portfolio');
      expect(webData.metadata.source).toBe(SOURCES[sourceKey].name);
    });

    it('연속 감소 종목을 exclusionList에 추가해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem(
          'CUSIP1',
          'Decreasing Stock',
          1000,
          100000,
          2,
          0,
          [
            { type: 'DECREASE', percent: -10, from: '2023-12-31', to: '2024-03-31' },
            { type: 'DECREASE', percent: -5, from: '2023-09-30', to: '2023-12-31' },
          ]
        ),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 100000,
        sortedByValue: [analysis['CUSIP1']],
      });
      
      const webData = generateWebData(mockResult);
      
      expect(webData.exclusionList.length).toBeGreaterThan(0);
      expect(webData.exclusionList[0].reason).toBe('CONSECUTIVE_DECREASE');
      expect(webData.exclusionList[0].cusip).toBe('CUSIP1');
    });

    it('청산된 종목을 exclusionList에 추가해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem(
          'CUSIP1',
          'Liquidated Stock',
          0,
          0,
          0,
          0,
          [
            { type: 'LIQUIDATED', percent: -100, from: '2023-12-31', to: '2024-03-31' },
          ]
        ),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 0,
        sortedByValue: [],
      });
      
      const webData = generateWebData(mockResult);
      
      const liquidatedItem = webData.exclusionList.find(item => item.reason === 'LIQUIDATED');
      expect(liquidatedItem).toBeDefined();
      expect(liquidatedItem?.cusip).toBe('CUSIP1');
    });

    it('신규 포지션을 watchlist에 추가해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem(
          'CUSIP1',
          'New Stock',
          10000,
          1000000,
          0,
          0,
          [
            { type: 'NEW', percent: 100, from: '2023-12-31', to: '2024-03-31' },
          ]
        ),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 1000000,
        sortedByValue: [analysis['CUSIP1']],
      });
      
      vi.mocked(analyzeCurrentRelevance).mockReturnValue({
        phase: 'EARLY',
        momentum: 'ACCELERATING',
        portfolioRank: 1,
        portfolioWeightPercent: 100,
        avgIncreaseRate: 100,
        increaseAcceleration: 0,
        relevanceScore: 90,
        reasoning: '유효성 높음 - 신규 편입 초기, 매수 가속',
      });
      
      const webData = generateWebData(mockResult);
      
      const newPosition = webData.watchlist.find(item => item.signal === 'NEW_POSITION');
      expect(newPosition).toBeDefined();
      expect(newPosition?.cusip).toBe('CUSIP1');
    });

    it('연속 증가 종목을 watchlist에 추가해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem(
          'CUSIP1',
          'Accumulating Stock',
          10000,
          1000000,
          0,
          3,
          [
            { type: 'INCREASE', percent: 15, from: '2023-12-31', to: '2024-03-31' },
            { type: 'INCREASE', percent: 10, from: '2023-09-30', to: '2023-12-31' },
            { type: 'INCREASE', percent: 5, from: '2023-06-30', to: '2023-09-30' },
          ]
        ),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 1000000,
        sortedByValue: [analysis['CUSIP1']],
      });
      
      vi.mocked(analyzeCurrentRelevance).mockReturnValue({
        phase: 'BUILDING',
        momentum: 'ACCELERATING',
        portfolioRank: 1,
        portfolioWeightPercent: 100,
        avgIncreaseRate: 10,
        increaseAcceleration: 5,
        relevanceScore: 80,
        reasoning: '유효성 높음 - 포지션 확대 중, 매수 가속',
      });
      
      const webData = generateWebData(mockResult);
      
      const accumulatingItem = webData.watchlist.find(
        item => item.signal === 'ACCUMULATING' || item.signal === 'CONSECUTIVE_INCREASE'
      );
      expect(accumulatingItem).toBeDefined();
      expect(accumulatingItem?.cusip).toBe('CUSIP1');
    });

    it('watchlist를 relevanceScore로 정렬해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem(
          'CUSIP1',
          'High Relevance',
          10000,
          1000000,
          0,
          3,
          [{ type: 'NEW', percent: 100, from: '2023-12-31', to: '2024-03-31' }]
        ),
        'CUSIP2': createMockAnalysisItem(
          'CUSIP2',
          'Low Relevance',
          5000,
          500000,
          0,
          2,
          [{ type: 'NEW', percent: 100, from: '2023-12-31', to: '2024-03-31' }]
        ),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 1500000,
        sortedByValue: [analysis['CUSIP1'], analysis['CUSIP2']],
      });
      
      vi.mocked(analyzeCurrentRelevance)
        .mockReturnValueOnce({
          phase: 'EARLY',
          momentum: 'ACCELERATING',
          portfolioRank: 1,
          portfolioWeightPercent: 66.67,
          avgIncreaseRate: 100,
          increaseAcceleration: 0,
          relevanceScore: 90,
          reasoning: '유효성 높음',
        })
        .mockReturnValueOnce({
          phase: 'EARLY',
          momentum: 'STEADY',
          portfolioRank: 2,
          portfolioWeightPercent: 33.33,
          avgIncreaseRate: 100,
          increaseAcceleration: 0,
          relevanceScore: 70,
          reasoning: '유효성 보통',
        });
      
      const webData = generateWebData(mockResult);
      
      expect(webData.watchlist.length).toBeGreaterThanOrEqual(2);
      // 첫 번째 항목의 relevanceScore가 두 번째보다 높거나 같아야 함
      expect(webData.watchlist[0].relevance?.relevanceScore || 0)
        .toBeGreaterThanOrEqual(webData.watchlist[1].relevance?.relevanceScore || 0);
    });

    it('portfolio를 value로 정렬해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem('CUSIP1', 'Small Stock', 1000, 100000),
        'CUSIP2': createMockAnalysisItem('CUSIP2', 'Large Stock', 10000, 1000000),
        'CUSIP3': createMockAnalysisItem('CUSIP3', 'Medium Stock', 5000, 500000),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 1600000,
        sortedByValue: [analysis['CUSIP2'], analysis['CUSIP3'], analysis['CUSIP1']],
      });
      
      const webData = generateWebData(mockResult);
      
      expect(webData.portfolio.length).toBe(3);
      // value가 큰 순서대로 정렬되어야 함
      expect(webData.portfolio[0].valueK).toBeGreaterThanOrEqual(webData.portfolio[1].valueK);
      expect(webData.portfolio[1].valueK).toBeGreaterThanOrEqual(webData.portfolio[2].valueK);
    });

    it('metadata를 올바르게 생성해야 함', () => {
      const sourceKey: SourceKey = 'berkshire';
      const analysis: Record<string, AnalysisItem> = {
        'CUSIP1': createMockAnalysisItem('CUSIP1', 'Stock 1', 10000, 1000000),
        'CUSIP2': createMockAnalysisItem('CUSIP2', 'Stock 2', 5000, 500000),
      };
      
      const mockResult = createMockAnalysisResult(sourceKey, analysis);
      mockResult.quarterlyData = [
        { date: '2024-03-31', holdings: {} },
        { date: '2023-12-31', holdings: {} },
      ];
      
      vi.mocked(buildRelevanceContext).mockReturnValue({
        totalPortfolioValue: 1500000,
        sortedByValue: [analysis['CUSIP1'], analysis['CUSIP2']],
      });
      
      const webData = generateWebData(mockResult);
      
      expect(webData.metadata.source).toBe(SOURCES[sourceKey].name);
      expect(webData.metadata.sourceKey).toBe(sourceKey);
      expect(webData.metadata.cik).toBe(SOURCES[sourceKey].cik);
      expect(webData.metadata.totalPositions).toBe(2);
      expect(webData.metadata.analyzedQuarters).toEqual(['2024-03-31', '2023-12-31']);
      expect(webData.metadata.latestFiling).toBe('2024-03-31');
    });
  });
});
