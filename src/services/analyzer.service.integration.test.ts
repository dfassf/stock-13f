import { describe, it, expect, beforeAll } from 'vitest';
import { analyzeSource } from './analyzer.service';
import { SourceKey } from '../types/interfaces';
import { SOURCES } from '../config/sources';

/**
 * 통합 테스트: 실제 SEC API를 호출하여 전체 분석 프로세스를 검증
 * 
 * 주의: 이 테스트는 실제 네트워크 요청을 수행하므로 실행 시간이 오래 걸릴 수 있습니다.
 * CI/CD 환경에서는 네트워크 제한이나 타임아웃 설정을 고려해야 합니다.
 */
describe('analyzer.service 통합 테스트', () => {
  const TIMEOUT = 60000; // 60초 타임아웃
  
  beforeAll(() => {
    // 통합 테스트 전 환경 설정 확인
    if (!process.env.CI) {
      console.log('통합 테스트는 실제 SEC API를 호출합니다.');
    }
  });

  it('실제 SEC API를 사용하여 분석을 수행해야 함', async () => {
    const sourceKey: SourceKey = 'berkshire';
    
    const result = await analyzeSource(sourceKey);
    
    expect(result).toBeDefined();
    expect(result.source).toEqual(SOURCES[sourceKey]);
    expect(result.quarterlyData).toBeInstanceOf(Array);
    expect(result.quarterlyData.length).toBeGreaterThan(0);
    expect(result.analysis).toBeInstanceOf(Object);
    
    // 각 분기 데이터가 올바른 형식인지 확인
    result.quarterlyData.forEach(quarter => {
      expect(quarter).toHaveProperty('date');
      expect(quarter).toHaveProperty('holdings');
      expect(typeof quarter.date).toBe('string');
      expect(typeof quarter.holdings).toBe('object');
    });
    
    // 분석 결과가 올바른 형식인지 확인
    Object.values(result.analysis).forEach(item => {
      expect(item).toHaveProperty('cusip');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('currentShares');
      expect(item).toHaveProperty('currentValue');
      expect(item).toHaveProperty('history');
      expect(item).toHaveProperty('changes');
      expect(item).toHaveProperty('consecutiveDecreases');
      expect(item).toHaveProperty('consecutiveIncreases');
    });
  }, TIMEOUT);

  it('다른 소스에 대해서도 분석을 수행할 수 있어야 함', async () => {
    const sourceKey: SourceKey = 'nps';
    
    const result = await analyzeSource(sourceKey);
    
    expect(result).toBeDefined();
    expect(result.source).toEqual(SOURCES[sourceKey]);
    expect(result.quarterlyData.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('분석 결과의 변화 추적이 올바르게 계산되어야 함', async () => {
    const sourceKey: SourceKey = 'berkshire';
    
    const result = await analyzeSource(sourceKey);
    
    // 각 분석 항목의 변화가 올바르게 계산되었는지 확인
    Object.values(result.analysis).forEach(item => {
      // history가 2개 이상이면 changes가 있어야 함
      if (item.history.length >= 2) {
        expect(item.changes.length).toBeGreaterThan(0);
        
        // 각 변화가 올바른 형식인지 확인
        item.changes.forEach(change => {
          expect(change).toHaveProperty('type');
          expect(change).toHaveProperty('percent');
          expect(change).toHaveProperty('from');
          expect(change).toHaveProperty('to');
          expect(['NEW', 'INCREASE', 'DECREASE', 'UNCHANGED', 'LIQUIDATED']).toContain(change.type);
        });
      }
    });
  }, TIMEOUT);

  it('연속 증가/감소가 올바르게 계산되어야 함', async () => {
    const sourceKey: SourceKey = 'berkshire';
    
    const result = await analyzeSource(sourceKey);
    
    Object.values(result.analysis).forEach(item => {
      expect(typeof item.consecutiveIncreases).toBe('number');
      expect(typeof item.consecutiveDecreases).toBe('number');
      expect(item.consecutiveIncreases).toBeGreaterThanOrEqual(0);
      expect(item.consecutiveDecreases).toBeGreaterThanOrEqual(0);
    });
  }, TIMEOUT);

  it('분석 결과의 포트폴리오 가치가 합리적인 범위에 있어야 함', async () => {
    const sourceKey: SourceKey = 'berkshire';
    
    const result = await analyzeSource(sourceKey);
    
    // 현재 보유 중인 종목들의 총 가치 계산
    const totalValue = Object.values(result.analysis)
      .filter(item => item.currentShares > 0)
      .reduce((sum, item) => sum + item.currentValue, 0);
    
    // 포트폴리오 가치가 0보다 커야 함 (보유 종목이 있는 경우)
    const hasPositions = Object.values(result.analysis).some(item => item.currentShares > 0);
    if (hasPositions) {
      expect(totalValue).toBeGreaterThan(0);
    }
  }, TIMEOUT);
});
