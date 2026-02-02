import { Filing } from '../types/interfaces';
import { ParsedXML } from '../types/xml.types';
export declare function get13FFilings(cik: string): Promise<Filing[]>;
export declare function download13F(cik: string, accessionNumber: string): Promise<ParsedXML>;
//# sourceMappingURL=sec-edgar.service.d.ts.map