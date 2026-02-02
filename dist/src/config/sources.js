"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parser = exports.headers = exports.SOURCES = void 0;
const fast_xml_parser_1 = require("fast-xml-parser");
exports.SOURCES = {
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
const app_config_1 = require("./app.config");
exports.headers = {
    'User-Agent': app_config_1.APP_CONFIG.USER_AGENT,
    'Accept': 'application/json'
};
exports.parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
});
//# sourceMappingURL=sources.js.map