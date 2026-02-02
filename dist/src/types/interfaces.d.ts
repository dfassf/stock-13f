export type SourceKey = 'berkshire' | 'nps';
export interface Source {
    name: string;
    cik: string;
    flag: string;
}
export interface Filing {
    filingDate: string;
    accessionNumber: string;
}
export interface Holding {
    name: string;
    cusip: string;
    value: number;
    shares: number;
}
export interface Holdings {
    [cusip: string]: Holding;
}
export interface QuarterlyData {
    date: string;
    holdings: Holdings;
}
export interface HistoryItem {
    date: string;
    shares: number;
    value: number;
    name: string | null;
}
export type ChangeType = 'NEW' | 'INCREASE' | 'DECREASE' | 'LIQUIDATED' | 'UNCHANGED';
export interface Change {
    type: ChangeType;
    percent: number;
    from: string;
    to: string;
}
export interface AnalysisItem {
    name: string;
    cusip: string;
    history: HistoryItem[];
    changes: Change[];
    consecutiveDecreases: number;
    consecutiveIncreases: number;
    currentShares: number;
    currentValue: number;
}
export interface Analysis {
    [cusip: string]: AnalysisItem;
}
export interface AnalysisResult {
    quarterlyData: QuarterlyData[];
    analysis: Analysis;
    source: Source;
}
export type Severity = 'HIGH' | 'MEDIUM';
export interface ExclusionItem {
    symbol: string;
    cusip: string;
    reason: 'CONSECUTIVE_DECREASE' | 'LIQUIDATED';
    detail: string;
    severity: Severity;
    currentShares: number;
    currentValueK?: number;
    previousValueK?: number;
    changes: Array<{
        period: string;
        percent: number;
        type: ChangeType;
    }>;
}
export type SignalType = 'NEW_POSITION' | 'CONSECUTIVE_INCREASE';
export interface WatchlistItem {
    symbol: string;
    cusip: string;
    signal: SignalType;
    detail: string;
    currentShares: number;
    currentValueK: number;
    changes?: Array<{
        period: string;
        percent: number;
        type: ChangeType;
    }>;
}
export interface PortfolioItem {
    symbol: string;
    cusip: string;
    shares: number;
    valueK: number;
    valueMillion: number;
    recentChange: {
        percent: number;
        type: ChangeType;
    } | null;
}
export interface Metadata {
    source: string;
    sourceKey: SourceKey | undefined;
    flag: string;
    cik: string;
    generatedAt: string;
    analyzedQuarters: string[];
    latestFiling: string;
    totalPositions: number;
}
export interface WebData {
    metadata: Metadata;
    exclusionList: ExclusionItem[];
    watchlist: WatchlistItem[];
    portfolio: PortfolioItem[];
}
//# sourceMappingURL=interfaces.d.ts.map