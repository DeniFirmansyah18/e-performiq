import { describe, it, expect } from 'vitest';
import { aggregateReviews, MIN_REVIEWERS } from '@/lib/engines/360-aggregation-engine';

const row = (rel: 'SUPERVISOR' | 'PEER' | 'SUBORDINATE', s: number) => ({
  relationshipType: rel,
  integrityScore: s,
  collaborationScore: s,
  innovationScore: s,
});

describe('360-aggregation-engine', () => {
  it('rata-rata & konversi skala 5 → 100', () => {
    const r = aggregateReviews([row('SUPERVISOR', 5), row('PEER', 5), row('SUBORDINATE', 5)]);
    expect(r.avg).toBe(5);
    expect(r.score).toBe(100);
  });
  it('cukup bila ≥ MIN_REVIEWERS', () => {
    const rows = Array.from({ length: MIN_REVIEWERS }, () => row('PEER', 4));
    expect(aggregateReviews(rows).sufficient).toBe(true);
    expect(aggregateReviews(rows.slice(0, MIN_REVIEWERS - 1)).sufficient).toBe(false);
  });
  it('mengelompokkan per jenis relasi', () => {
    const r = aggregateReviews([row('SUPERVISOR', 4), row('PEER', 4), row('PEER', 4)]);
    expect(r.byGroup.SUPERVISOR).toBe(1);
    expect(r.byGroup.PEER).toBe(2);
    expect(r.count).toBe(3);
  });
  it('kosong → skor 0 & tidak cukup', () => {
    const r = aggregateReviews([]);
    expect(r.count).toBe(0);
    expect(r.sufficient).toBe(false);
  });
});
