export interface ParsedXML {
  informationTable?: {
    infoTable?: XMLHolding | XMLHolding[];
  };
  infoTable?: XMLHolding | XMLHolding[];
  'ns1:informationTable'?: {
    'ns1:infoTable'?: XMLHolding | XMLHolding[];
  };
}

export interface XMLHolding {
  nameOfIssuer?: string;
  'ns1:nameOfIssuer'?: string;
  cusip?: string;
  'ns1:cusip'?: string;
  value?: string | number;
  'ns1:value'?: string | number;
  shrsOrPrnAmt?: {
    sshPrnamt?: string | number;
    'ns1:sshPrnamt'?: string | number;
  };
  'ns1:shrsOrPrnAmt'?: {
    sshPrnamt?: string | number;
    'ns1:sshPrnamt'?: string | number;
  };
}

export interface SECDirectoryItem {
  name: string;
  type?: string;
  size?: number;
}

export interface SECDirectoryResponse {
  directory?: {
    item?: SECDirectoryItem | SECDirectoryItem[];
  };
}

export interface SECFilingsResponse {
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      accessionNumber?: string[];
    };
  };
}
