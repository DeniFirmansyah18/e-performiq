import { getDb } from '@/lib/db/client';

/**
 * Membersihkan departemen palsu "Direktorat Uji ..." sisa tes otomatis.
 *
 * Karyawan tidak boleh dibiarkan tanpa departemen (kolom NOT NULL), jadi
 * mereka dipindahkan ke departemen nyata yang sesuai lebih dulu. Pemindahan
 * memakai departemen "Human Capital & Corporate Governance" sebagai penampung
 * netral, karena karyawan tersebut memang hasil data uji.
 */
const DEPT_PENAMPUNG = 'Human Capital & Corporate Governance';

async function main() {
  const client = await getDb();

  const pola = `department_name LIKE 'Direktorat Uji %'`;

  const sebelum = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM departments WHERE ${pola}`
  );
  console.log('departemen palsu sebelum:', sebelum.rows[0].n);

  // Karyawan yang masih berada di departemen palsu.
  const karyawan = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM employees
      WHERE department_id IN (SELECT id FROM departments WHERE ${pola})`
  );
  console.log('karyawan di departemen palsu:', karyawan.rows[0].n);

  const penampung = await client.query<{ id: string }>(
    `SELECT id FROM departments WHERE department_name = $1 LIMIT 1`,
    [DEPT_PENAMPUNG]
  );
  if (penampung.rows.length === 0) {
    console.log('departemen penampung tidak ditemukan; dibatalkan');
    process.exit(1);
  }
  const idPenampung = penampung.rows[0].id;

  // 1. Pindahkan karyawan ke departemen nyata.
  await client.query(
    `UPDATE employees SET department_id = $1
      WHERE department_id IN (SELECT id FROM departments WHERE ${pola})`,
    [idPenampung]
  );

  // 2. Karyawan yang memakai posisi milik departemen palsu dipindah dulu ke
  //    posisi di departemen penampung, agar FK employees.position_id terpenuhi.
  const posisiPenampung = await client.query<{ id: string }>(
    `SELECT id FROM job_positions WHERE department_id = $1 ORDER BY position_title LIMIT 1`,
    [idPenampung]
  );
  if (posisiPenampung.rows.length > 0) {
    await client.query(
      `UPDATE employees SET position_id = $1
        WHERE position_id IN (
          SELECT id FROM job_positions
           WHERE department_id IN (SELECT id FROM departments WHERE ${pola})
        )`,
      [posisiPenampung.rows[0].id]
    );
  }

  // 3. Hapus posisi & departemen palsu.
  await client.query(
    `DELETE FROM job_positions
      WHERE department_id IN (SELECT id FROM departments WHERE ${pola})`
  );
  await client.query(`DELETE FROM departments WHERE ${pola}`);

  const sesudah = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM departments WHERE ${pola}`
  );
  const total = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM departments`);
  console.log('departemen palsu sesudah:', sesudah.rows[0].n);
  console.log('total departemen sekarang:', total.rows[0].n);
  process.exit(0);
}

main().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
