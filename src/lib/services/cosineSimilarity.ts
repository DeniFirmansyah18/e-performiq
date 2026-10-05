/**
 * Cosine similarity antar teks (bag-of-words unigram) — replikasi pendekatan
 * CountVectorizer() + cosine_similarity dari repo acuan ATS
 * (kanishksh4rma/Resume-Scanner-for-Job-Description--using-Cosine-Similarity),
 * tanpa dependency eksternal. Deterministik; tidak pernah melempar error.
 */
const STOPWORDS = new Set([
  'dan', 'atau', 'yang', 'untuk', 'dengan', 'pada', 'di', 'ke', 'dari',
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'for', 'in', 'on', 'with',
  'is', 'are', 'be', 'as', 'by', 'at', 'it', 'this', 'that',
]);

/** Pecah teks menjadi token (lowercase, buang stopword & tanda baca). */
export function tokenize(text: string): string[] {
  const t = String(text ?? '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ');
  const out: string[] = [];
  for (const raw of t.split(/\s+/)) {
    const tok = raw.replace(/^\.+|\.+$/g, '');
    if (tok.length >= 2 && !STOPWORDS.has(tok)) out.push(tok);
  }
  return out;
}

/** Bangun vokabulari unigram (union) dari sekumpulan dokumen. */
export function buildVocabulary(docs: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const d of docs) {
    for (const tok of tokenize(d)) if (!vocab.has(tok)) vocab.set(tok, vocab.size);
  }
  return vocab;
}

/** Hitung frekuensi tiap token terhadap vokabulari (count vector). */
export function termCounts(tokens: string[], vocab: Map<string, number>): number[] {
  const v = new Array(vocab.size).fill(0);
  for (const tok of tokens) {
    const i = vocab.get(tok);
    if (i !== undefined) v[i] += 1;
  }
  return v;
}

/** Cosine similarity dua vektor; 0 bila salah satu vektor bernorma nol. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Persentase kecocokan 0..100 (dibulatkan 2 desimal). */
export function matchPercentage(resumeText: string, jobText: string): number {
  const vocab = buildVocabulary([resumeText ?? '', jobText ?? '']);
  const a = termCounts(tokenize(resumeText ?? ''), vocab);
  const b = termCounts(tokenize(jobText ?? ''), vocab);
  const sim = cosineSimilarity(a, b);
  return Math.round(sim * 100 * 100) / 100;
}
