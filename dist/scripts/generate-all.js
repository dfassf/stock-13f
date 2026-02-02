"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sources_1 = require("../src/config/sources");
const analyzer_service_1 = require("../src/services/analyzer.service");
const data_generator_service_1 = require("../src/services/data-generator.service");
function saveData(data, sourceKey) {
    const outputDir = path_1.default.join(__dirname, '..', 'data');
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const suffix = sourceKey === 'berkshire' ? '' : `-${sourceKey}`;
    const fullPath = path_1.default.join(outputDir, `analysis${suffix}.json`);
    fs_1.default.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`저장됨: ${fullPath}`);
}
async function main() {
    console.log('🚀 모든 소스 데이터 생성 시작...');
    for (const sourceKey of Object.keys(sources_1.SOURCES)) {
        try {
            const analysisResult = await (0, analyzer_service_1.analyzeSource)(sourceKey);
            const webData = (0, data_generator_service_1.generateWebData)(analysisResult);
            saveData(webData, sourceKey);
            console.log(`\n${sources_1.SOURCES[sourceKey].flag} ${sources_1.SOURCES[sourceKey].name} 완료!`);
            console.log(`  - 보유 종목: ${webData.metadata.totalPositions}개`);
            console.log(`  - Risk Signals: ${webData.exclusionList.length}개`);
            console.log(`  - Positive Signals: ${webData.watchlist.length}개`);
        }
        catch (error) {
            console.log(`\n❌ ${sourceKey} 오류: ${error.message}`);
        }
    }
    console.log('\n✅ 모든 데이터 생성 완료!');
}
main();
//# sourceMappingURL=generate-all.js.map