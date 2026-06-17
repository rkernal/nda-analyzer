// Core data shapes (PORTING-SPEC Appendix B). Carried over from the original
// app's types/index.ts, with `userId` replaced by `ownerEmail` (identity key =
// normalized email), `fileUrl` dropped (text-only storage), and `docHash` added
// to the Analysis record for the analysis-cache cost optimization (#4).

/** The four library statuses. Stored HYPHENATED — never underscored (see A.0). */
export type NDAStatus =
  | "signed-asis"
  | "signed-remediated"
  | "declined"
  | "declined-remediated";

export interface Clause {
  title: string;
  text: string;
  clauseType: string;
}

export interface NDA {
  id: string;
  ownerEmail: string;
  name: string;
  status: NDAStatus;
  rawText: string;
  originalRawText?: string | null;
  dateAdded: string;
  clauses: Clause[];
  originalClauses?: Clause[] | null;
}

/** Fields a caller supplies to create an NDA; the store sets id/dateAdded/ownerEmail. */
export type NDAInput = Omit<NDA, "id" | "ownerEmail" | "dateAdded">;

export interface AnalysisResult {
  title: string;
  text: string;
  clauseType: string;
  category: string;
  confidence: number;
  explanation: string;
  riskScore: number;
  riskReasoning: string;
  matchedNda?: string | null;
  matchedClause?: string | null;
  suggestedAlternative?: string | null;
  agreedIn?: string | null;
  declinedIn?: string | null;
  conflictNote?: string | null;
}

export interface AnalysisSummary {
  [key: string]: number;
  green: number;
  yellow: number;
  red: number;
  orange: number;
  conflicted: number;
  white: number;
}

export interface Analysis {
  id: string;
  ownerEmail: string;
  ndaName: string;
  rawText: string;
  createdAt: string;
  summary: AnalysisSummary;
  results: AnalysisResult[];
  familiarityPct: number;
  avgRiskScore: number;
  maxRiskScore: number;
  libSnapshot: { ndaCount: number; clauseCount: number };
  /** Hash of normalized text + library fingerprint — drives the analysis cache (#4). */
  docHash: string;
}

/** Fields a caller supplies to create an Analysis; the store sets id/createdAt/ownerEmail. */
export type AnalysisInput = Omit<Analysis, "id" | "ownerEmail" | "createdAt">;

/** Lightweight row for the history list — omits the heavy `results` array. */
export type AnalysisSummaryRow = Omit<Analysis, "results" | "rawText">;
