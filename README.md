# 13F Signal Tracker

SEC EDGAR에서 13F 파일을 수집하여 대형 기관 투자자의 포트폴리오 변화를 분석하고 투자 시그널을 생성하는 도구입니다.

## 프로젝트 개요

이 프로젝트는 SEC EDGAR의 13F 공시 데이터를 분석하여 다음과 같은 정보를 제공합니다.

- 기관 투자자 포트폴리오 추적 (버크셔 해서웨이, 국민연금 등)
- 신규 편입 종목 감지
- 연속 분기 비중 증가 종목 식별
- 연속 감축 또는 청산 종목 식별
- Watchlist 및 Exclusion List 자동 생성

## 왜 가벼운가?

이 프로젝트는 의도적으로 가벼운 구조로 설계되었습니다.

### 최소한의 의존성
- **Hono**: Express 대신 가벼운 웹 프레임워크 사용 (번들 크기 1/10 수준)
- **fast-xml-parser**: 무거운 XML 파서 대신 경량 파서 사용
- **Pino**: Winston 대신 더 빠르고 가벼운 로깅 라이브러리
- **Vitest**: Jest 대신 더 빠르고 가벼운 테스트 프레임워크

### 단순한 아키텍처
- 복잡한 ORM 없이 순수 TypeScript로 데이터 처리
- 인메모리 캐싱으로 Redis 같은 외부 의존성 제거
- 프론트엔드는 React CDN으로 빌드 프로세스 없이 사용
- 단일 서버 파일로 모든 API 엔드포인트 관리

### 빠른 시작
- 복잡한 설정 파일 없이 `.env`만으로 구성
- 데이터베이스 마이그레이션 불필요
- 즉시 실행 가능한 구조

이러한 설계는 프로토타입 단계에서 빠른 개발과 배포를 가능하게 하며, 필요시 점진적으로 확장할 수 있습니다.

## 주요 기능

- 13F 파일 자동 수집 및 파싱
- 분기별 포트폴리오 변화 분석
- 연속 분기 변화 추적
- 웹 기반 대시보드 제공
- RESTful API 제공
- 구조화된 로깅 (Pino)
- 타입 안전성 (TypeScript)
- 테스트 커버리지

## 기술 스택

- **Backend**: Node.js, TypeScript, Hono
- **HTTP Client**: Axios
- **XML Parsing**: fast-xml-parser
- **Logging**: Pino
- **Testing**: Vitest
- **Frontend**: React (CDN), Vanilla JavaScript

## 설치 및 실행

### 필수 조건

- Node.js 16 이상
- npm

### 설치

```bash
npm install
```

### 환경 변수 설정

`.env.example`을 참고하여 `.env` 파일을 생성하세요:

```bash
cp .env.example .env
```

주요 설정:
- `PORT`: 서버 포트 (기본값: 3000)
- `NUM_QUARTERS`: 분석할 분기 수 (기본값: 4)
- `CACHE_MAX_AGE`: 캐시 유지 시간 (밀리초, 기본값: 3600000)
- `API_TIMEOUT`: API 타임아웃 (밀리초, 기본값: 30000)
- `USER_AGENT`: SEC API 요청 시 사용할 User-Agent
- `LOG_LEVEL`: 로그 레벨 (기본값: info)

### 실행

```bash
# 개발 모드 (자동 재시작)
npm run dev

# 프로덕션 모드
npm run build
npm run start:prod

# 테스트 실행
npm test

# 테스트 커버리지
npm run test:coverage
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## API 엔드포인트

### 시그널 데이터 가져오기

```
GET /api/signals/:source
```

소스: `berkshire` 또는 `nps`

응답 예시:
```json
{
  "metadata": {
    "source": "Berkshire Hathaway",
    "generatedAt": "2026-02-01T12:00:00.000Z",
    "analyzedQuarters": ["2025-12-31", "2025-09-30", ...],
    "totalPositions": 50
  },
  "watchlist": [
    {
      "symbol": "AAPL",
      "signal": "NEW_POSITION",
      "currentShares": 1000000,
      "currentValueK": 150000000
    }
  ],
  "exclusionList": [
    {
      "symbol": "XYZ",
      "reason": "CONSECUTIVE_DECREASE",
      "severity": "HIGH",
      "detail": "2분기 연속 감축"
    }
  ],
  "portfolio": [...]
}
```

### 데이터 새로고침

```
POST /api/refresh/:source
```

캐시를 무시하고 최신 데이터를 수집합니다.

### 소스 목록

```
GET /api/sources
```

사용 가능한 소스 목록을 반환합니다.

## 데이터 구조

### Watchlist

신규 편입 또는 연속 분기 비중 증가 종목이 포함됩니다.

- `NEW_POSITION`: 신규 편입 종목
- `CONSECUTIVE_INCREASE`: 연속 분기 비중 증가 종목

### Exclusion List

연속 감축 또는 청산된 종목이 포함됩니다.

- `CONSECUTIVE_DECREASE`: 연속 분기 감축 종목
- `LIQUIDATED`: 완전 청산 종목

### Portfolio

현재 보유 중인 모든 포지션 목록입니다. 시장 가치 기준으로 정렬됩니다.

## 프로젝트 구조

```
stock-investment/
├── server.ts              # Hono 서버 및 API
├── index.html             # 웹 대시보드
├── src/
│   ├── config/           # 설정 파일
│   │   ├── app.config.ts
│   │   ├── env.config.ts
│   │   └── sources.ts
│   ├── services/         # 비즈니스 로직
│   │   ├── analyzer.service.ts
│   │   ├── data-generator.service.ts
│   │   ├── parser.service.ts
│   │   └── sec-edgar.service.ts
│   ├── types/            # TypeScript 타입 정의
│   │   ├── interfaces.ts
│   │   └── xml.types.ts
│   ├── utils/            # 유틸리티 함수
│   │   ├── cache.ts
│   │   ├── logger.ts
│   │   └── type-guards.ts
│   └── errors/           # 에러 클래스
│       └── app.error.ts
├── dist/                 # 컴파일된 파일
├── logs/                 # 로그 파일
├── .env                  # 환경 변수 (gitignore)
├── .env.example          # 환경 변수 예시
├── package.json
└── tsconfig.json
```

## 데이터 수집 프로세스

1. SEC EDGAR에서 CIK별 13F 파일 목록 조회
2. 최근 N개 분기 데이터 수집 (기본값: 4)
3. XML 파일 병렬 다운로드 및 파싱
4. 종목별 보유 수량 및 시장 가치 집계
5. 분기별 변화 분석 (신규 편입, 증가, 감소, 청산)
6. 연속 분기 변화 추적
7. Watchlist 및 Exclusion List 생성

## 캐싱

서버는 메모리 캐시를 사용하여 설정된 시간 동안 데이터를 캐시합니다 (기본값: 1시간). 강제 새로고침은 `/api/refresh/:source` 엔드포인트를 사용하세요.

## 로깅

Pino를 사용한 구조화된 로깅이 구현되어 있습니다.

- **콘솔 출력**: 개발 환경에서 `pino-pretty`로 컬러 포맷 출력
- **JSON 로그**: 프로덕션 환경에서 구조화된 JSON 로그 출력
- **로그 레벨**: 환경 변수 `LOG_LEVEL`로 제어 (기본값: info)

## 테스트

Vitest를 사용한 단위 테스트가 포함되어 있습니다.

```bash
# 테스트 실행
npm test

# UI 모드로 실행
npm run test:ui

# 커버리지 확인
npm run test:coverage
```

현재 테스트 커버리지:
- 타입 가드 함수
- 파서 서비스
- 에러 클래스

## 에러 처리

커스텀 에러 클래스를 사용하여 일관된 에러 처리를 구현했습니다.

- `AppError`: 기본 애플리케이션 에러
- `ValidationError`: 입력 검증 에러 (400)
- `SECAPIError`: SEC API 관련 에러 (500)
- `TimeoutError`: 타임아웃 에러 (504)

모든 에러는 로깅되며 클라이언트에는 안전한 메시지만 전달됩니다.

## 주의사항

이 도구는 학습 및 참고 목적으로만 사용해야 합니다. 실제 투자 판단의 근거로 사용하지 마세요.

- 수익을 보장하지 않습니다
- 매수/매도 추천이 아닙니다
- 과거 데이터 기반 분석입니다
- 13F 공시는 최대 45일 지연될 수 있습니다

## 라이선스

MIT License
