import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/** Satu baris fakta kehadiran harian dari tabel attendance_records. */
export interface AttendanceFactRow {
workDate: string; // 'YYYY-MM-DD'
isPresent: boolean;
isWeekend: boolean;
isSickLeave: boolean;
}

/**

Mengambil deret kehadiran karyawan pada rentang tanggal (inklusif),
diurutkan menaik berdasarkan tanggal.
*/
export async function getAttendanceFactRows(
db: Db,
employeeId: string,
from: string, // 'YYYY-MM-DD'
to: string // 'YYYY-MM-DD'
): Promise<AttendanceFactRow[]> {
const res = (await db.execute(sql`SELECT work_date::text AS "workDate", is_present AS "isPresent", is_weekend AS "isWeekend", is_sick_leave AS "isSickLeave" FROM attendance_records WHERE employee_id = ${employeeId}::uuid AND work_date BETWEEN ${from}::date AND ${to}::date ORDER BY work_date ASC`)) as unknown as { rows: Array<Record<string, unknown>> };
return (res.rows ?? []).map((r) => ({
workDate: String(r.workDate).slice(0, 10),
isPresent: r.isPresent === true,
isWeekend: r.isWeekend === true,
isSickLeave: r.isSickLeave === true,
}));
}

/**

Apakah dua tanggal absen termasuk dalam SATU periode (spell)?
selisih 1 hari kalender -> satu spell
selisih 2-3 hari dan semua hari di antaranya akhir pekan -> satu spell
(mis. absen Jumat lalu Senin dihitung satu spell, bukan dua)
*/
function isSameSpell(prevDate: string, curDate: string): boolean {
const diffDays = Math.round(
(Date.parse(curDate + 'T00:00:00Z') - Date.parse(prevDate + 'T00:00:00Z')) / 86400000
);
if (diffDays <= 1) return true;
if (diffDays <= 3) {
for (let i = 1; i < diffDays; i++) {
const mid = new Date(Date.parse(prevDate + 'T00:00:00Z') + i * 86400000);
const dow = mid.getUTCDay();
if (dow !== 0 && dow !== 6) return false;
}
return true;
}
return false;
}
/**

Bradford Factor = S^2 x D
S = jumlah periode (spell) ketidakhadiran
D = total hari absen
Aturan:
akhir pekan (is_weekend) diabaikan
cuti sakit resmi (is_sick_leave) diabaikan
hanya hari kerja dengan is_present = FALSE yang dihitung
*/
export function computeBradfordFactor(facts: AttendanceFactRow[]): number {
const absentDates = facts
.filter((f) => !f.isPresent && !f.isWeekend && !f.isSickLeave)
.map((f) => f.workDate)
.sort();
let spells = 0;
let prev: string | null = null;
for (const d of absentDates) {
if (prev === null || !isSameSpell(prev, d)) {
spells += 1;
}
prev = d;
}

return spells * spells * absentDates.length;
}
