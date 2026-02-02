import { XMLParser } from 'fast-xml-parser';
import { Source, SourceKey } from '../types/interfaces';

export const SOURCES: Record<SourceKey, Source> = {
  berkshire: {
    name: 'Berkshire Hathaway',
    cik: '0001067983',
    flag: '🇺🇸'
  },
  nps: {
    name: 'National Pension Service (국민연금)',
    cik: '0001608046',
    flag: '🇰🇷'
  }
};

import { APP_CONFIG } from './app.config';

export const headers = {
  'User-Agent': APP_CONFIG.USER_AGENT,
  'Accept': 'application/json'
};

export const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});
