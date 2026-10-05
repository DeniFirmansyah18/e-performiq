import { describe, it, expect } from 'vitest';
import {
  tokenize,
  buildVocabulary,
  termCounts,
  cosineSimilarity,
  matchPercentage,
} from '@/lib/services/cosineSimilarity';

describe('cosineSimilarity', () => {
  it('tokenize membuang stopword & tanda baca, pertahankan token teknis', () => {
    const toks = tokenize('Saya menguasai TypeScript, Next.js dan PostgreSQL!');
    expect(toks).toContain('typescript');
    expect(toks).toContain('next.js');
    expect(toks).toContain('postgresql');
    expect(toks).not.toContain('dan');
  });

  it('teks identik → 100', () => {
    const t = 'TypeScript Next.js PostgreSQL';
    expect(matchPercentage(t, t)).toBe(100);
  });

  it('tanpa irisan token → 0', () => {
    expect(matchPercentage('TypeScript Next.js PostgreSQL', 'payroll akuntansi pajak')).toBe(0);
  });

  it('simetri: matchPercentage(a,b) === matchPercentage(b,a)', () => {
    const a = 'TypeScript Next.js PostgreSQL';
    const b = 'TypeScript React Docker';
    expect(matchPercentage(a, b)).toBe(matchPercentage(b, a));
  });

  it('salah satu kosong → 0 (bukan NaN)', () => {
    expect(matchPercentage('', 'TypeScript')).toBe(0);
    expect(matchPercentage('TypeScript', '')).toBe(0);
    expect(Number.isNaN(matchPercentage('', ''))).toBe(false);
  });

  it('deterministik', () => {
    const a = 'TypeScript Next.js PostgreSQL';
    const b = 'TypeScript React PostgreSQL Docker';
    expect(matchPercentage(a, b)).toBe(matchPercentage(a, b));
  });

  it('teks berbeda beririsan sebagian → antara 0 dan 100', () => {
    const v = matchPercentage('TypeScript Next.js PostgreSQL', 'TypeScript React PostgreSQL Docker');
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(100);
  });

  it('cosineSimilarity dengan vektor nol → 0', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('buildVocabulary + termCounts konsisten', () => {
    const vocab = buildVocabulary(['alpha beta gamma', 'beta gamma delta']);
    expect(vocab.size).toBe(4);
    const counts = termCounts(tokenize('beta gamma gamma'), vocab);
    const bIdx = vocab.get('beta')!;
    const gIdx = vocab.get('gamma')!;
    expect(counts[bIdx]).toBe(1);
    expect(counts[gIdx]).toBe(2);
  });
});
