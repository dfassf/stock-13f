import { describe, it, expect } from 'vitest';
import { aggregateHoldings } from '../parser.service';
import { ParsedXML } from '../../types/xml.types';

describe('parser.service', () => {
  describe('aggregateHoldings', () => {
    it('빈 데이터를 처리해야 함', () => {
      const result = aggregateHoldings({});
      expect(result).toEqual({});
    });

    it('informationTable 형식을 파싱해야 함', () => {
      const parsed: ParsedXML = {
        informationTable: {
          infoTable: {
            nameOfIssuer: 'Apple Inc',
            cusip: '037833100',
            value: '1000000',
            shrsOrPrnAmt: {
              sshPrnamt: '1000'
            }
          }
        }
      };

      const result = aggregateHoldings(parsed);
      expect(result['037833100']).toEqual({
        name: 'Apple Inc',
        cusip: '037833100',
        value: 1000000,
        shares: 1000
      });
    });

    it('배열 형식을 처리해야 함', () => {
      const parsed: ParsedXML = {
        informationTable: {
          infoTable: [
            {
              nameOfIssuer: 'Apple Inc',
              cusip: '037833100',
              value: '1000000',
              shrsOrPrnAmt: { sshPrnamt: '1000' }
            },
            {
              nameOfIssuer: 'Microsoft Corp',
              cusip: '594918104',
              value: '2000000',
              shrsOrPrnAmt: { sshPrnamt: '2000' }
            }
          ]
        }
      };

      const result = aggregateHoldings(parsed);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['037833100'].name).toBe('Apple Inc');
      expect(result['594918104'].name).toBe('Microsoft Corp');
    });

    it('같은 CUSIP의 데이터를 집계해야 함', () => {
      const parsed: ParsedXML = {
        informationTable: {
          infoTable: [
            {
              nameOfIssuer: 'Apple Inc',
              cusip: '037833100',
              value: '1000000',
              shrsOrPrnAmt: { sshPrnamt: '1000' }
            },
            {
              nameOfIssuer: 'Apple Inc',
              cusip: '037833100',
              value: '500000',
              shrsOrPrnAmt: { sshPrnamt: '500' }
            }
          ]
        }
      };

      const result = aggregateHoldings(parsed);
      expect(result['037833100'].value).toBe(1500000);
      expect(result['037833100'].shares).toBe(1500);
    });

    it('ns1 네임스페이스를 처리해야 함', () => {
      const parsed: ParsedXML = {
        'ns1:informationTable': {
          'ns1:infoTable': {
            'ns1:nameOfIssuer': 'Apple Inc',
            'ns1:cusip': '037833100',
            'ns1:value': '1000000',
            'ns1:shrsOrPrnAmt': {
              'ns1:sshPrnamt': '1000'
            }
          }
        }
      };

      const result = aggregateHoldings(parsed);
      expect(result['037833100']).toBeDefined();
      expect(result['037833100'].name).toBe('Apple Inc');
    });
  });
});
