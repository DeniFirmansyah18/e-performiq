'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Save, X } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface Row {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  bpjsTkNumber: string | null;
  bpjsKesNumber: string | null;
  bpjsKesClass: string | null;
  bpjsTkStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  bpjsKesStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  registeredAt: string | null;
  registered: boolean;
}

const STATUS_LABEL: Record<Row['bpjsTkStatus'], string> = {
  ACTIVE: 'Aktif', INACTIVE: 'Tidak aktif', PENDING: 'Menunggu',
};

export default function SocialSecurityManagerPanel() {
  const { activeRole } = useAuth();
  const canWrite = activeRole === 'HR_MANAGER' || activeRole === 'SUPER_ADMIN';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    bpjsTkNumber: '',
    bpjsKesNumber: '',
    bpjsKesClass: '',
    bpjsTkStatus: 'ACTIVE' as Row['bpjsTkStatus'],
    bpjsKesStatus: 'ACTIVE' as Row['bpjsKesStatus'],
    registeredAt: '',
  });

  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/hr/social-security${missingOnly ? '?missing=true' : ''}`);
      if (res.ok) {
        setForbidden(false);
        setRows((await res.json())?.data?.items ?? []);
      } else if (res.status === 403) {
        setForbidden(true);
        setRows([]);
      }
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, [missingOnly]);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (row: Row) => {
    setEditing(row.employeeId);
    setNotice(null);
    setForm({
      // Nomor tersimpan ter-masking; kosongkan agar HR mengisi nilai baru bila perlu.
      bpjsTkNumber: '',
      bpjsKesNumber: '',
      bpjsKesClass: row.bpjsKesClass ?? '',
      bpjsTkStatus: row.bpjsTkStatus,
      bpjsKesStatus: row.bpjsKesStatus,
      registeredAt: row.registeredAt ? String(row.registeredAt).slice(0, 10) : '',
    });
  };

  const save = async (employeeId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/hr/employees/${employeeId}/social-security`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bpjsTkNumber: form.bpjsTkNumber || undefined,
          bpjsKesNumber: form.bpjsKesNumber || undefined,
          bpjsKesClass: form.bpjsKesClass || undefined,
          bpjsTkStatus: form.bpjsTkStatus,
          bpjsKesStatus: form.bpjsKesStatus,
          registeredAt: form.registeredAt || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menyimpan data BPJS.'); return; }
      setNotice('Data BPJS tersimpan.');
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0284c7]" aria-hidden="true" />
            <span>Data BPJS Karyawan</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            {canWrite
              ? 'Nomor peserta selalu ter-masking; isi hanya bila ada perubahan.'
              : 'Pantau kepesertaan BPJS karyawan. Perubahan data hanya dapat dilakukan HR.'}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-[#475569]">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[#cbd5e1] text-[#007a5a] focus:ring-[#007a5a]"
          />
          Hanya belum terdaftar
        </label>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {loading && <p className="text-[11px] text-[#64748b]">Memuat data BPJS…</p>}

      {!loading && forbidden && (
        <p className="text-[11px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2">
          Anda tidak berwenang melihat data BPJS karyawan. Data ini hanya tersedia untuk HR.
        </p>
      )}

      {!loading && !forbidden && rows.length === 0 && (
        <p className="text-[11px] text-[#64748b]">
          Tidak ada data BPJS yang cocok dengan filter saat ini.
        </p>
      )}

      <ul className="divide-y divide-[#e2e8f0]">
        {rows.map((r) => (
          <li key={r.employeeId} className="py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#0f172a]">{r.employeeName}</span>
              <span className="text-[10px] text-[#94a3b8]">{r.employeeCode}</span>
              {!r.registered && (
                <span className="rounded bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-bold text-[#b45309]">
                  Belum terdaftar
                </span>
              )}
              <button
                type="button"
                onClick={() => (editing === r.employeeId ? setEditing(null) : startEdit(r))}
                aria-label={`Kelola BPJS ${r.employeeName}`}
                hidden={!canWrite}
                className="ml-auto rounded-lg border border-[#0284c7] px-2 py-1 text-[10px] font-semibold text-[#0284c7] hover:bg-[#e0f2fe] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7] focus-visible:ring-offset-2"
              >
                Kelola
              </button>
            </div>

            <p className="mt-0.5 text-[11px] text-[#475569]">
              TK {r.bpjsTkNumber ?? '—'} · KES {r.bpjsKesNumber ?? '—'}
              {r.bpjsKesClass ? ` · ${r.bpjsKesClass}` : ''} · {STATUS_LABEL[r.bpjsTkStatus]}
            </p>

            {editing === r.employeeId && (
              <div className="mt-2 rounded-xl border border-[#e2e8f0] p-2.5 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] text-[#475569]">
                    Nomor BPJS Ketenagakerjaan
                    <input
                      value={form.bpjsTkNumber}
                      onChange={(e) => setForm((f) => ({ ...f, bpjsTkNumber: e.target.value }))}
                      placeholder="kosongkan bila tidak berubah"
                      className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                    />
                  </label>
                  <label className="text-[11px] text-[#475569]">
                    Nomor BPJS Kesehatan
                    <input
                      value={form.bpjsKesNumber}
                      onChange={(e) => setForm((f) => ({ ...f, bpjsKesNumber: e.target.value }))}
                      placeholder="kosongkan bila tidak berubah"
                      className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                    />
                  </label>
                  <label className="text-[11px] text-[#475569]">
                    Kelas BPJS Kesehatan
                    <input
                      value={form.bpjsKesClass}
                      onChange={(e) => setForm((f) => ({ ...f, bpjsKesClass: e.target.value }))}
                      placeholder="Kelas 1"
                      className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                    />
                  </label>
                  <label className="text-[11px] text-[#475569]">
                    Tanggal terdaftar
                    <input
                      type="date"
                      value={form.registeredAt}
                      onChange={(e) => setForm((f) => ({ ...f, registeredAt: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(r.employeeId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" aria-hidden="true" /> Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px] font-semibold text-[#475569] hover:bg-[#f8fafc]"
                  >
                    <X className="h-3 w-3" aria-hidden="true" /> Batal
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!loading && rows.length === 0 && (
          <li className="py-3 text-[11px] text-[#64748b]">Tidak ada karyawan pada filter ini.</li>
        )}
      </ul>
    </div>
  );
}
