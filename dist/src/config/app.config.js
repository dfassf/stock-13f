"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_CONFIG = void 0;
const env_config_1 = require("./env.config");
exports.APP_CONFIG = {
    NUM_QUARTERS: env_config_1.ENV_CONFIG.NUM_QUARTERS,
    CACHE_MAX_AGE: env_config_1.ENV_CONFIG.CACHE_MAX_AGE,
    API_TIMEOUT: env_config_1.ENV_CONFIG.API_TIMEOUT,
    USER_AGENT: env_config_1.ENV_CONFIG.USER_AGENT
};
//# sourceMappingURL=app.config.js.map