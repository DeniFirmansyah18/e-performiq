import type { UserRole } from '@/types';

/**
 * Akun demo untuk login cepat (dev/seed).
 *
 * Ini BUKAN data bisnis — hanya daftar akun seed yang dipakai oleh
 * quick-login di halaman login dan demo role switcher di Header.
 * Sumber kebenaran data pengguna tetap `users` + `employees` di database.
 */
export interface DemoLoginAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  position: string;
  avatarUrl?: string;
}

export const DEMO_LOGIN_ACCOUNTS: DemoLoginAccount[] = [
  {
    id: 'usr-bod-001',
    email: 'hendra.gunawan@eperformiq.co.id',
    name: 'Ir. Hendra Gunawan, M.B.A.',
    role: 'BOD',
    department: 'Dewan Direksi (Board of Directors)',
    position: 'Chief Executive Officer (CEO)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-hrm-002',
    email: 'siti.nurhaliza@eperformiq.co.id',
    name: 'Siti Nurhaliza, S.Psi., M.M.',
    role: 'HR_MANAGER',
    department: 'Human Capital & Corporate Governance',
    position: 'VP of Human Capital',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-mgr-003',
    email: 'danu.tech@eperformiq.co.id',
    name: 'Raden Mas Danu, S.T., M.Kom.',
    role: 'PEOPLE_MANAGER',
    department: 'Information Technology & Engineering',
    position: 'Head of Engineering & Ops',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-emp-004',
    email: 'budi.pratama@eperformiq.co.id',
    name: 'Budi Pratama',
    role: 'EMPLOYEE',
    department: 'Information Technology & Engineering',
    position: 'Senior Software Engineer',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-aud-005',
    email: 'bambang.audit@eperformiq.co.id',
    name: 'Bambang Soeprapto, Ak., CA',
    role: 'AUDITOR',
    department: 'Satuan Pengawas Internal (SPI)',
    position: 'Chief Internal Auditor',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-adm-006',
    email: 'admin@eperformiq.co.id',
    name: 'Rina Kusuma',
    role: 'SUPER_ADMIN',
    department: 'Human Capital & Corporate Governance',
    position: 'HR System Administrator',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-asr-007',
    email: 'aris.assessor@eperformiq.co.id',
    name: 'Dr. Aris Wicaksono, M.Psi.',
    role: 'ASSESSOR',
    department: 'Komite Kalibrasi & Suksesi Talenta',
    position: 'Lead Talent Assessor & Facilitator',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
];
