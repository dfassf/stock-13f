import { SourceKey, WebData } from '../types/interfaces';
import { APP_CONFIG } from '../config/app.config';

const cache: Record<SourceKey, WebData | null> = {
  berkshire: null,
  nps: null
};

const lastUpdated: Record<string, number> = {};

export function getCache(sourceKey: SourceKey): WebData | null {
  const now = Date.now();
  const cacheAge = now - (lastUpdated[sourceKey] || 0);
  
  if (cache[sourceKey] && cacheAge < APP_CONFIG.CACHE_MAX_AGE) {
    return cache[sourceKey];
  }
  
  return null;
}

export function setCache(sourceKey: SourceKey, data: WebData): void {
  cache[sourceKey] = data;
  lastUpdated[sourceKey] = Date.now();
}

export function clearCache(sourceKey?: SourceKey): void {
  if (sourceKey) {
    cache[sourceKey] = null;
    delete lastUpdated[sourceKey];
  } else {
    cache.berkshire = null;
    cache.nps = null;
    Object.keys(lastUpdated).forEach(key => delete lastUpdated[key]);
  }
}
