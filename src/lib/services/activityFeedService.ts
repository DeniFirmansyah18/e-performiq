import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export type ActivityEventType =
  | 'ATTENDANCE' | 'KPI_DAILY' | 'DPI_STATUS' | 'LEAVE' | 'OVERTIME'
  | 'TRAINING' | 'LETTER' | 'DISCIPLINARY' | 'RECOGNITION' | 'CAREER';

export type ActivityVisibility = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface ActivityRow {
  id: string;
  employeeId: string;
  eventType: ActivityEventType;
  entityId: string | null;
  summary: string;
  visibility: ActivityVisibility;
  occurredAt: string;
}

export async function appendActivity(
  db: Db,
  input: {
    employeeId: string;
    eventType: ActivityEventType;
    entityId?: string | null;
    summary: string;
    visibility?: ActivityVisibility;
    occurredAt?: string;
  },
): Promise<void> {
  const visibility = input.visibility ?? 'INTERNAL';
  if (visibility === 'RESTRICTED') {
    throw new BusinessRuleError(
      'Kejadian RESTRICTED (gaji, BPJS, data medis, chat pribadi) tidak boleh masuk activity feed.',
    );
  }

  await db.execute(sql`
    INSERT INTO activity_events (employee_id, event_type, entity_id, summary, visibility, occurred_at)
    VALUES (${input.employeeId}::uuid, ${input.eventType}::activity_event_type_enum,
            ${input.entityId ?? null}::uuid, ${input.summary}, ${visibility},
            COALESCE(${input.occurredAt ?? null}::timestamptz, CURRENT_TIMESTAMP))
  `);
}

export async function listActivity(db: Db, employeeId: string, limit = 50): Promise<ActivityRow[]> {
  const res = (await db.execute(sql`
    SELECT id, employee_id AS "employeeId", event_type AS "eventType",
           entity_id AS "entityId", summary, visibility, occurred_at AS "occurredAt"
      FROM activity_events
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY occurred_at DESC
     LIMIT ${limit}
  `)) as unknown as { rows: ActivityRow[] };
  return res.rows ?? [];
}
