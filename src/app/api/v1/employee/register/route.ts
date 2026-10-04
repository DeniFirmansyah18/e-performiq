import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { ok, problem, parseBody } from '@/lib/api/response';
import { registerEmployee } from '@/lib/services/employeeRegistrationService';
import { sendEmail } from '@/lib/services/notificationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RegisterEmployeeSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap wajib diisi (min. 2 karakter)').max(200),
  email: z.string().email('Format email tidak valid').max(150),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter').max(128),
  phone: z.string().max(30).optional(),
  positionHint: z.string().max(150).optional(),
});

function baseUrl(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-host');
  if (forwarded) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${forwarded}`;
  }
  const host = req.headers.get('host') ?? 'localhost:3000';
  return `http://${host}`;
}

// POST /api/v1/employee/register — pendaftaran mandiri karyawan (PUBLIK).
// Membuat baris staging PENDING_EMAIL dan mengirim email verifikasi (best-effort).
export async function POST(req: NextRequest) {
  try {
    const input = await parseBody(req, RegisterEmployeeSchema);
    const result = await registerEmployee(db, input);

    // Best-effort: kegagalan email TIDAK menggagalkan registrasi.
    try {
      const link = `${baseUrl(req)}/employee/verified?token=${result.verifyToken}`;
      await sendEmail(db, {
        to: input.email.toLowerCase(),
        subject: 'Verifikasi email akun karyawan E-PerformIQ',
        body: `Halo ${input.fullName},\n\nTerima kasih telah mendaftar akun karyawan E-PerformIQ.\n\nKlik tautan berikut dalam 24 jam untuk memverifikasi email Anda:\n${link}\n\nSetelah verifikasi, akun Anda menunggu persetujuan HR sebelum dapat digunakan untuk login.`,
      });
    } catch {
      /* abaikan — outbox QUEUED sudah dicatat sendEmail */
    }

    return ok({ status: 'PENDING_EMAIL' });
  } catch (err) {
    return problem(err, '/api/v1/employee/register');
  }
}
