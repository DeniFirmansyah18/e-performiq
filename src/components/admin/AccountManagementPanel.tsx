'use client';

import DataTable from '@/components/ui/DataTable';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserPlus, KeyRound, RefreshCw, Search, Ban, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import type { UserRole } from '@/types';

interface AccountRow {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeCode: string | null;
  departmentName: string | null;
}

const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  BOD: 'Direksi (BOD)',
  HR_MANAGER: 'HR Manager',
  PEOPLE_MANAGER: 'People Manager',
  EMPLOYEE: 'Karyawan',
};

const ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'BOD',
  'HR_MANAGER',
  'PEOPLE_MANAGER',
  'EMPLOYEE',
];

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Manajemen akun & peran — khusus SUPER_ADMIN.
 *
 * Akun tidak pernah dihapus, hanya dinonaktifkan, karena `users.id` direferensikan
 * riwayat disposisi surat. Perubahan peran menyentuh otorisasi, sehingga seluruh
 * aksi di sini hanya tersedia bagi SUPER_ADMIN (lihat `user:manage` di RBAC).
 */
export default function AccountManagementPanel() {
  const { activeRole } = useAuth();
  const canManage = activeRole === 'SUPER_ADMIN';

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'EMPLOYEE' as UserRole, password: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/v1/admin/users');
      if (res.status === 403) {
        setErr('Hanya Super Admin yang dapat membuka manajemen akun.');
        setRows([]);
        return;
      }
      if (!res.ok) {
        setErr('Gagal memuat daftar akun.');
        return;
      }
      const json = await res.json();
      setRows(json?.data?.items ?? []);
    } catch {
      setErr('Gagal memuat daftar akun.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        (r.employeeName ?? '').toLowerCase().includes(q) ||
        (r.employeeCode ?? '').toLowerCase().includes(q) ||
        ROLE_LABEL[r.role].toLowerCase().includes(q)
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length;
    const perRole = ROLES.map((role) => ({
      role,
      count: rows.filter((r) => r.role === role && r.isActive).length,
    }));
    return { total: rows.length, active, inactive: rows.length - active, perRole };
  }, [rows]);

  const patch = async (id: string, body: Record<string, unknown>, successMessage: string) => {
    setBusyId(id);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? 'Gagal memperbarui akun.');
        return;
      }
      setMsg(successMessage);
      await load();
    } catch {
      setErr('Gagal memperbarui akun.');
    } finally {
      setBusyId(null);
    }
  };

  const createAccount = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          role: form.role,
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? 'Gagal membuat akun.');
        return;
      }
      setMsg('Akun berhasil dibuat.');
      setShowCreate(false);
      setForm({ email: '', role: 'EMPLOYEE', password: '' });
      await load();
    } catch {
      setErr('Gagal membuat akun.');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (row: AccountRow) => {
    const next = typeof window !== 'undefined'
      ? window.prompt(`Kata sandi baru untuk ${row.email} (min. 8 karakter):`)
      : null;
    if (!next) return;
    if (next.length < 8) {
      setErr('Kata sandi minimal 8 karakter.');
      return;
    }
    await patch(row.id, { password: next }, `Kata sandi ${row.email} diperbarui.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#0f172a]">
            <ShieldCheck className="h-5 w-5 text-[#007a5a]" />
            Manajemen Akun &amp; Peran
          </h1>
          <p className="mt-1 text-xs text-[#64748b]">
            Kelola akun, peran, dan status akses seluruh pengguna aplikasi. Akun tidak dihapus,
            hanya dinonaktifkan agar jejak audit dan disposisi surat tetap utuh.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
          {canManage && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#00684a]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Akun Baru
            </button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-[#fde68a] bg-[#fef3c7] p-3 text-xs font-semibold text-[#92400e]">
          Anda membuka halaman ini tanpa hak SUPER_ADMIN. Daftar akun disembunyikan.
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] p-3 text-xs font-semibold text-[#b91c1c]">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-[#b7e1cd] bg-[#e6f4ea] p-3 text-xs font-semibold text-[#137333]">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Akun', value: summary.total },
          { label: 'Aktif', value: summary.active },
          { label: 'Nonaktif', value: summary.inactive },
          { label: 'Peran Terpakai', value: summary.perRole.filter((r) => r.count > 0).length },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[#e2e8f0] bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">{card.label}</p>
            <p className="mt-1 text-xl font-bold text-[#0f172a]">{card.value}</p>
          </div>
        ))}
      </div>

      {showCreate && canManage && (
        <div className="rounded-xl border border-[#c7e7d3] bg-[#f4fbf7] p-4">
          <h2 className="text-sm font-bold text-[#0f172a]">Buat Akun Baru</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-[#475569]">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nama@eperformiq.co.id"
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[#0f172a]"
              />
            </label>
            <label className="text-xs font-semibold text-[#475569]">
              Peran
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[#0f172a]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#475569]">
              Kata Sandi Awal
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="min. 8 karakter"
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs text-[#0f172a]"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={createAccount}
              disabled={saving || !form.email || form.password.length < 8}
              className="rounded-lg bg-[#007a5a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#00684a] disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : 'Simpan Akun'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-2 text-xs font-semibold text-[#475569]"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#e2e8f0] bg-white">

        {loading ? (
          <p className="p-6 text-center text-xs text-[#64748b]">Memuat akun…</p>
        ) : (
          <div className="p-3">
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              searchPlaceholder="Cari email, nama, atau peran…"
              initialSearch={search}
              itemLabel="akun"
              emptyMessage="Tidak ada akun yang cocok."
              maxHeight="440px"
              columns={[
            { key: 'email', header: 'Email', value: (r) => r.email, render: (r) => <span className="font-semibold text-[#0f172a]">{r.email}</span> },
            {
              key: 'karyawan',
              header: 'Karyawan',
              value: (r) => r.employeeName ?? r.employeeCode ?? '',
              render: (r) => (
                <span className="text-[#475569]">
                  {r.employeeName ?? <span className="text-[#94a3b8]">— tidak tertaut —</span>}
                  {r.employeeCode && <span className="ml-1 text-[10px] text-[#94a3b8]">({r.employeeCode})</span>}
                </span>
              ),
            },
            {
              key: 'peran',
              header: 'Peran',
              value: (r) => ROLE_LABEL[r.role] ?? r.role,
              render: (r) =>
                canManage ? (
                  <select
                    value={r.role}
                    disabled={busyId === r.id}
                    onChange={(e) => patch(r.id, { role: e.target.value }, `Peran ${r.email} diperbarui.`)}
                    aria-label={`Peran ${r.email}`}
                    className="rounded-lg border border-[#e2e8f0] bg-white px-2 py-1 text-[11px] font-semibold text-[#0f172a]"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-[#475569]">{ROLE_LABEL[r.role]}</span>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              value: (r) => (r.isActive ? 'Aktif' : 'Nonaktif'),
              render: (r) => (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${r.isActive ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                  {r.isActive ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                  {r.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              ),
            },
            { key: 'login', header: 'Login Terakhir', value: (r) => fmtDate(r.lastLoginAt), render: (r) => <span className="text-[#475569]">{fmtDate(r.lastLoginAt)}</span> },
            ...(canManage
              ? [{
                  key: 'aksi',
                  header: 'Aksi',
                  value: () => '',
                  render: (r: any) => (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => resetPassword(r)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-2 py-1 text-[10px] font-semibold text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
                      >
                        <KeyRound className="h-3 w-3" />
                        Reset Sandi
                      </button>
                      <button
                        onClick={() => patch(r.id, { isActive: !r.isActive }, `Akun ${r.email} ${r.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`)}
                        disabled={busyId === r.id}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold disabled:opacity-50 ${r.isActive ? 'border border-[#fecaca] bg-[#fee2e2] text-[#b91c1c]' : 'border border-[#b7e1cd] bg-[#e6f4ea] text-[#137333]'}`}
                      >
                        {r.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  ),
                }]
              : []),
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
