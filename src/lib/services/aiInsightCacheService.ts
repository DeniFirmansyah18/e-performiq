import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Db } from '@/lib/db/client';

export interface InsightKey {
  feature: string;
  periodCode: string;
  role: string;
}

export interface CachedInsight {
  insight: string;
  provider: string | null;
  generatedAt: string;
  payloadHash: string;
}

/**
 * JSON dengan kunci terurut stabil. Tanpa ini, urutan kunci objek membuat
 * hash berubah padahal datanya sama, sehingga cache selalu dianggap basi.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function hashPayload(context: unknown): string {
  return createHash('sha256').update(stableStringify(context), 'utf8').digest('hex');
}

export async function getCachedInsight(db: Db, key: InsightKey): Promise<CachedInsight | null> {
  const res = (await db.execute(sql`
    SELECT insight, provider, generated_at AS "generatedAt", payload_hash AS "payloadHash"
      FROM ai_insights
     WHERE feature = ${key.feature}
       AND period_code = ${key.periodCode}
       AND role = ${key.role}
     LIMIT 1
  `)) as unknown as {
    rows: Array<{
      insight: string;
      provider: string | null;
      generatedAt: unknown;
      payloadHash: string;
    }>;
  };

  const row = res.rows?.[0];
  if (!row) return null;

  return {
    insight: row.insight,
    provider: row.provider,
    generatedAt: new Date(row.generatedAt as string).toISOString(),
    payloadHash: row.payloadHash,
  };
}

export async function saveInsight(
  db: Db,
  input: InsightKey & { insight: string; provider: string | null; payloadHash: string }
): Promise<void> {
  await db.execute(sql`
    INSERT INTO ai_insights (feature, period_code, role, insight, provider, payload_hash, generated_at)
    VALUES (${input.feature}, ${input.periodCode}, ${input.role},
            ${input.insight}, ${input.provider}, ${input.payloadHash}, NOW())
    ON CONFLICT (feature, period_code, role) DO UPDATE
       SET insight = EXCLUDED.insight,
           provider = EXCLUDED.provider,
           payload_hash = EXCLUDED.payload_hash,
           generated_at = NOW()
  `);
}
