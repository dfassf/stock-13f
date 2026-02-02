import { Holdings } from '../types/interfaces';
import { ParsedXML, XMLHolding } from '../types/xml.types';

export function aggregateHoldings(parsed: ParsedXML): Holdings {
  let holdings: XMLHolding[] = [];
  
  if (parsed.informationTable?.infoTable) {
    holdings = Array.isArray(parsed.informationTable.infoTable) 
      ? parsed.informationTable.infoTable 
      : [parsed.informationTable.infoTable];
  } else if (parsed.infoTable) {
    holdings = Array.isArray(parsed.infoTable) ? parsed.infoTable : [parsed.infoTable];
  } else if (parsed['ns1:informationTable']?.['ns1:infoTable']) {
    const ns1Holdings = parsed['ns1:informationTable']['ns1:infoTable'];
    holdings = Array.isArray(ns1Holdings) ? ns1Holdings : [ns1Holdings];
  }
  
  if (holdings.length === 0) {
    return {};
  }
  
  const aggregated: Holdings = {};
  
  for (const h of holdings) {
    const name = h.nameOfIssuer || h['ns1:nameOfIssuer'] || 'UNKNOWN';
    const cusip = h.cusip || h['ns1:cusip'] || 'UNKNOWN';
    
    const valueStr = h.value || h['ns1:value'];
    const value = typeof valueStr === 'string' ? parseInt(valueStr, 10) : (valueStr || 0);
    
    const shrsOrPrnAmt = h.shrsOrPrnAmt || h['ns1:shrsOrPrnAmt'] || {};
    const sharesStr = shrsOrPrnAmt.sshPrnamt || shrsOrPrnAmt['ns1:sshPrnamt'];
    const shares = typeof sharesStr === 'string' ? parseInt(sharesStr, 10) : (sharesStr || 0);
    
    if (!aggregated[cusip]) {
      aggregated[cusip] = { name, cusip, value: 0, shares: 0 };
    }
    
    aggregated[cusip].value += value;
    aggregated[cusip].shares += shares;
  }
  
  return aggregated;
}
