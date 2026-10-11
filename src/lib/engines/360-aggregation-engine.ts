// 360° Peer Review Aggregation Engine (PRD §3.2 DUR-04, bobot 15%).
// Fungsi murni. Skala input 1-5 → skor 0-100.

export interface Review360Row {
  relationshipType: 'SUPERVISOR' | 'PEER' | 'SUBORDINATE';
  integrityScore: number;
  collaborationScore: number;
  innovationScore: number;
}

export interface Aggregated360 {
  avg: number; // rata-rata skala 5
  score: number; // konversi 0-100
  count: number;
  byGroup: { SUPERVISOR: number; PEER: number; SUBORDINATE: number };
  sufficient: boolean; // ≥ MIN_REVIEWERS
}

export const MIN_REVIEWERS = 3;
export const TARGET_AVG_5 = 4.2; // PRD target ≥ 4.2/5

export function aggregateReviews(rows: Review360Row[]): Aggregated360 {
  const byGroup = { SUPERVISOR: 0, PEER: 0, SUBORDINATE: 0 };
  if (rows.length === 0) {
    return { avg: 0, score: 0, count: 0, byGroup, sufficient: false };
  }

  let sum = 0;
  for (const r of rows) {
    sum += (r.integrityScore + r.collaborationScore + r.innovationScore) / 3;
    if (r.relationshipType in byGroup) byGroup[r.relationshipType] += 1;
  }

  const avg = sum / rows.length;
  return {
    avg: Number(avg.toFixed(2)),
    score: Number(((avg / 5) * 100).toFixed(2)),
    count: rows.length,
    byGroup,
    sufficient: rows.length >= MIN_REVIEWERS,
  };
}
