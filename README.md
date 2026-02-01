# 13F Signal Tracker

SEC EDGAR에서 13F 파일을 수집하여 대형 기관 투자자의 포트폴리오 변화를 분석하고 투자 시그널을 생성하는 도구입니다.

## 프로젝트 개요

이 프로젝트는 SEC EDGAR의 13F 공시 데이터를 분석하여 다음과 같은 정보를 제공합니다.

- 기관 투자자 포트폴리오 추적 (버크셔 해서웨이, 국민연금 등)
- 신규 편입 종목 감지
- 연속 분기 비중 증가 종목 식별
- 연속 감축 또는 청산 종목 식별
- Watchlist 및 Exclusion List 자동 생성

## 주요 기능

- 13F 파일 자동 수집 및 파싱
- 분기별 포트폴리오 변화 분석
- 연속 분기 변화 추적
- 웹 기반 대시보드 제공
- RESTful API 제공

## 기술 스택

- Node.js
- Hono: 웹 프레임워크
- Axios: HTTP 클라이언트
- fast-xml-parser: XML 파싱
- Vanilla JavaScript: 프론트엔드

## 설치 및 실행

### 필수 조건

- Node.js 16 이상
- npm

### 설치

```bash
npm install
```

### 실행

```bash
# 서버 시작
npm start

# 또는 데이터 생성만 실행
npm run generate
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
├── server.js              # Hono 서버 및 API
├── generate-all.js        # 데이터 생성 스크립트
├── index.html             # 웹 대시보드
├── data/                  # 생성된 데이터 파일
│   ├── analysis.json      # 버크셔 분석 데이터
│   ├── analysis-nps.json  # 국민연금 분석 데이터
│   ├── watchlist.json     # Watchlist
│   └── exclusion-list.json # Exclusion List
└── package.json
```

## 데이터 수집 프로세스

1. SEC EDGAR에서 CIK별 13F 파일 목록 조회
2. 최근 4개 분기 데이터 수집
3. XML 파일 다운로드 및 파싱
4. 종목별 보유 수량 및 시장 가치 집계
5. 분기별 변화 분석 (신규 편입, 증가, 감소, 청산)
6. 연속 분기 변화 추적
7. Watchlist 및 Exclusion List 생성

## 캐싱

서버는 메모리 캐시를 사용하여 1시간 동안 데이터를 캐시합니다. 강제 새로고침은 `/api/refresh/:source` 엔드포인트를 사용하세요.

## 주의사항

이 도구는 학습 및 참고 목적으로만 사용해야 합니다. 실제 투자 판단의 근거로 사용하지 마세요.

- 수익을 보장하지 않습니다
- 매수/매도 추천이 아닙니다
- 과거 데이터 기반 분석입니다

## 라이선스

MIT License
