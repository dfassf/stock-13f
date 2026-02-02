"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCache = getCache;
exports.setCache = setCache;
exports.clearCache = clearCache;
const app_config_1 = require("../config/app.config");
const cache = {
    berkshire: null,
    nps: null
};
const lastUpdated = {};
function getCache(sourceKey) {
    const now = Date.now();
    const cacheAge = now - (lastUpdated[sourceKey] || 0);
    if (cache[sourceKey] && cacheAge < app_config_1.APP_CONFIG.CACHE_MAX_AGE) {
        return cache[sourceKey];
    }
    return null;
}
function setCache(sourceKey, data) {
    cache[sourceKey] = data;
    lastUpdated[sourceKey] = Date.now();
}
function clearCache(sourceKey) {
    if (sourceKey) {
        cache[sourceKey] = null;
        delete lastUpdated[sourceKey];
    }
    else {
        cache.berkshire = null;
        cache.nps = null;
        Object.keys(lastUpdated).forEach(key => delete lastUpdated[key]);
    }
}
//# sourceMappingURL=cache.js.map