import { getDb } from '@/lib/db/client';
async function main() {
  const c = await getDb();
  const r = await c.query<any>(`SELECT character_maximum_length AS len FROM information_schema.columns WHERE table_name='moodle_courses' AND column_name='course_code'`);
  console.log('panjang course_code:', r.rows[0]?.len);
  process.exit(0);
}
main().catch(e => { console.error(String(e?.message ?? e).slice(0,150)); process.exit(1); });
