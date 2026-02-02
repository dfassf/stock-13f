import { Holdings } from '../types/interfaces';
import { ParsedXML, XMLHolding } from '../types/xml.types';
import { safeParseInt } from '../utils/type-guards';
import logger from '../utils/logger';

function extractHoldings(parsed: ParsedXML): XMLHolding[] {
  if (parsed.informationTable?.infoTable) {
    const holdings = parsed.informationTable.infoTable;
    return Array.isArray(holdings) ? holdings : [holdings];
  }
  if (parsed.infoTable) {
    return Array.isArray(parsed.infoTable) ? parsed.infoTable : [parsed.infoTable];
  }
  if (parsed['ns1:informationTable']?.['ns1:infoTable']) {
    const ns1Holdings = parsed['ns1:informationTable']['ns1:infoTable'];
    return Array.isArray(ns1Holdings) ? ns1Holdings : [ns1Holdings];
  }
  return [];
}

function extractHoldingValue(holding: XMLHolding): number {
  const valueStr = holding.value || holding['ns1:value'];
  return safeParseInt(valueStr, 0);
}

function extractHoldingShares(holding: XMLHolding): number {
  const shrsOrPrnAmt = holding.shrsOrPrnAmt || holding['ns1:shrsOrPrnAmt'] || {};
  const sharesStr = shrsOrPrnAmt.sshPrnamt || shrsOrPrnAmt['ns1:sshPrnamt'];
  return safeParseInt(sharesStr, 0);
}

export function aggregateHoldings(parsed: ParsedXML): Holdings {
  const holdings = extractHoldings(parsed);
  
  if (holdings.length === 0) {
    logger.warn({}, '보유 종목 데이터가 없음');
    return {};
  }
  
  const aggregated: Holdings = {};
  
  for (const h of holdings) {
    const name = h.nameOfIssuer || h['ns1:nameOfIssuer'] || 'UNKNOWN';
    const cusip = h.cusip || h['ns1:cusip'] || 'UNKNOWN';
    const value = extractHoldingValue(h);
    const shares = extractHoldingShares(h);
    
    if (!aggregated[cusip]) {
      aggregated[cusip] = { name, cusip, value: 0, shares: 0 };
    }
    
    aggregated[cusip].value += value;
    aggregated[cusip].shares += shares;
  }
  
  logger.debug({ count: Object.keys(aggregated).length }, '보유 종목 집계 완료');
  return aggregated;
}
