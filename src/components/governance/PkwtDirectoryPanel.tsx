'use client';

import DataTable from '@/components/ui/DataTable';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  AlertTriangle,
  ShieldAlert,
  CalendarClock,
  FileWarning,
  CalendarPlus,
  BadgeCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { can } from '@/lib/auth/rbac';
import { todayInJakarta } from '@/lib/utils/wibDate';

type Urgency = 'EXPIRED' | 'CRITICAL_30' | 'WARNING_60' | 'SAFE';

interface PkwtAlert {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  contractEndDate: string;
  daysRemaining: number;
  urgency: Urgency;
}

interface ContractsSummary {
  referenceDate: string;
  totalPkwt: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiredCount: number;
  missingEndDateCount: number;
  alerts: PkwtAlert[];
}

const URGENCY_META: Record<Urgency, { label: string; className: string }> = {
  EXPIRED: { label: 'Kedaluwarsa', className: 'bg-red-100 text-red-700' },
  CRITICAL_30: { label: 'Kritis <30h', className: 'bg-orange-100 text-orange-700' },
  WARNING_60: { label: 'Peringatan <60h', className: 'bg-amber-100 text-amber-700' },
  SAFE: { label: 'Aman', className: 'bg-emerald-100 text-emerald-800' },
};

const FILTERS: Array<{ key: 'ALL' | Urgency; label: string }> = [
  { key: 'ALL', label: 'Semua Status' },
  { key: 'CRITICAL_30', label: 'Kritis <30h' },
  { key: 'WARNING_60', label: 'Peringatan <60h' },
  { key: 'EXPIRED', label: 'Kedaluwarsa' },
  { key: 'SAFE', label: 'Aman' },
];

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} hari lalu`;
  if (days === 0) return 'Hari ini';
  return `${days} hari lagi`;
}

const BRAND = '#007a5a';

/** Tambah bulan pada tanggal `YYYY-MM-DD` tanpa menggeser zona waktu. */
function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + months, d));
  return base.toISOString().slice(0, 10);
}

type ActionKind = 'EXTEND' | 'CONVERT_TO_PERMANENT';

interface ActionFormState {
  employeeId: string;
  fullName: string;
  kind: ActionKind;
  newEndDate: string;
  effectiveDate: string;
  reason: string;
}

export default function PkwtDirectoryPanel({ initialSearch }: { initialSearch?: string } = {}) {
  const { activeRole } = useAuth();
  // Tombol tulis hanya untuk role ber-hak `employment:manage`; API tetap
  // menolak 403 sehingga UI tidak menawarkan aksi yang pasti gagal.
  const canManage = can(activeRole, 'employment:manage');
  const [data, setData] = useState<ContractsSummary | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<'ALL' | Urgency>('ALL');
  const [searchTerm, setSearchTerm] = useState(initialSearch ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ActionFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadSummary = useCallback(async (signal?: { active: boolean }) => {
    const res = await fetch('/api/v1/hr/contracts-summary');
    const json = await res.json();
    if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
    if (signal && !signal.active) return;
    if (json?.status === 'success') setData(json.data);
  }, []);

  useEffect(() => {
    const signal = { active: true };
    setLoading(true);
    loadSummary(signal)
      .catch((err: Error) => {
        if (signal.active) setError(err.message);
      })
      .finally(() => {
        if (signal.active) setLoading(false);
      });
    return () => {
      signal.active = false;
    };
  }, [loadSummary]);

  const openExtend = (item: PkwtAlert) => {
    const today = todayInJakarta();
    const base = item.contractEndDate > today ? item.contractEndDate : today;
    setNotice(null);
    setForm({
      employeeId: item.employeeId,
      fullName: item.fullName,
      kind: 'EXTEND',
      newEndDate: addMonths(base, 12),
      effectiveDate: today,
      reason: '',
    });
  };

  const openConvert = (item: PkwtAlert) => {
    setNotice(null);
    setForm({
      employeeId: item.employeeId,
      fullName: item.fullName,
      kind: 'CONVERT_TO_PERMANENT',
      newEndDate: '',
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: '',
    });
  };

  const submitAction = async () => {
    if (!form) return;
    if (form.reason.trim().length < 5) {
      setNotice({ kind: 'err', text: 'Alasan wajib diisi minimal 5 karakter.' });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const body =
        form.kind === 'EXTEND'
          ? {
              action: 'EXTEND',
              newEndDate: form.newEndDate,
              effectiveDate: form.effectiveDate,
              reason: form.reason.trim(),
            }
          : {
              action: 'CONVERT_TO_PERMANENT',
              effectiveDate: form.effectiveDate,
              reason: form.reason.trim(),
            };

      const res = await fetch(
        `/api/v1/hr/contracts/actions?employeeId=${encodeURIComponent(form.employeeId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Aksi gagal diproses');

      await loadSummary();
      setNotice({ kind: 'ok', text: json?.message ?? 'Perubahan kontrak tersimpan.' });
      setForm(null);
    } catch (err) {
      setNotice({ kind: 'err', text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return (data?.alerts ?? []).filter((item) => {
      const matchesSearch =
        term.length === 0 ||
        [item.fullName, item.employeeCode, item.departmentName, item.positionTitle]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term));
      const matchesUrgency = filterUrgency === 'ALL' || item.urgency === filterUrgency;
      return matchesSearch && matchesUrgency;
    });
  }, [data, searchTerm, filterUrgency]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat direktori PKWT & kontrak...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat direktori PKWT: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-semibold mb-1">Total Kontrak PKWT</div>
          <div className="text-2xl font-bold text-slate-800">{data?.totalPkwt ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Per {data?.referenceDate ?? '-'}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-amber-600 font-semibold mb-1 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> Jatuh Tempo &lt;60 Hari
          </div>
          <div className="text-2xl font-bold text-amber-600">{data?.expiringIn60Days ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Pemberitahuan awal HR</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-red-600 font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Kritis &lt;30 Hari
          </div>
          <div className="text-2xl font-bold text-red-600">{data?.expiringIn30Days ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Keputusan perpanjangan mendesak</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-600 font-semibold mb-1 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Kedaluwarsa
          </div>
          <div className="text-2xl font-bold text-slate-700">{data?.expiredCount ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Memerlukan transisi/SK</div>
        </div>
      </div>

      {(data?.missingEndDateCount ?? 0) > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
          <FileWarning className="w-4 h-4 flex-shrink-0" />
          {data?.missingEndDateCount} pegawai PKWT belum memiliki tanggal akhir kontrak.
          Lengkapi datanya agar peringatan jatuh tempo dapat dihitung.
        </div>
      )}

      {notice && (
        <div
          className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-xs ${
            notice.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Tutup notifikasi">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterUrgency(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterUrgency === f.key
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={filterUrgency === f.key ? { backgroundColor: BRAND } : undefined}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

          <DataTable
            rows={filtered}
            rowKey={(r) => r.employeeId}
            searchPlaceholder="Cari nama, NIK, departemen, atau posisi..."
            initialSearch={searchTerm}
            itemLabel="pegawai PKWT"
            emptyMessage="Tidak ditemukan data pegawai PKWT dengan kriteria ini."
            maxHeight="440px"
            columns={[
            { key: 'nik', header: 'NIK', value: (r) => r.employeeCode, render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.employeeCode}</span> },
            { key: 'nama', header: 'Nama Pegawai', value: (r) => r.fullName, render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
            { key: 'posisi', header: 'Posisi', value: (r) => r.positionTitle, render: (r) => r.positionTitle },
            { key: 'dept', header: 'Departemen', value: (r) => r.departmentName, render: (r) => r.departmentName },
            { key: 'akhir', header: 'Akhir Kontrak', value: (r) => r.contractEndDate, render: (r) => <span className="font-medium text-slate-700">{r.contractEndDate}</span> },
            { key: 'sisa', header: 'Sisa Waktu', value: (r) => daysLabel(r.daysRemaining), render: (r) => daysLabel(r.daysRemaining) },
            {
              key: 'status',
              header: 'Status',
              value: (r) => URGENCY_META[r.urgency]?.label ?? r.urgency,
              render: (r) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${URGENCY_META[r.urgency]?.className ?? 'bg-slate-100 text-slate-700'}`}>
                  {URGENCY_META[r.urgency]?.label ?? r.urgency}
                </span>
              ),
            },
            // Kolom aksi hanya ada bagi pemegang employment:manage; tanpa hak,
            // kolom kosong justru membingungkan.
            ...(canManage
              ? [{
                  key: 'aksi',
                  header: 'Aksi',
                  value: () => '',
                  render: (r: PkwtAlert) => (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openExtend(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-100" title="Perpanjang kontrak PKWT">
                        <CalendarPlus className="w-3 h-3" /> Perpanjang
                      </button>
                      <button onClick={() => openConvert(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-white" style={{ backgroundColor: BRAND }} title="Angkat menjadi karyawan tetap (PKWTT)">
                        <BadgeCheck className="w-3 h-3" /> Tetap
                      </button>
                    </div>
                  ),
                }]
              : []),
            ]}
          />
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {form.kind === 'EXTEND' ? 'Perpanjang Kontrak PKWT' : 'Angkat Jadi Karyawan Tetap'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{form.fullName}</p>
              </div>
              <button onClick={() => setForm(null)} aria-label="Tutup formulir">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {form.kind === 'EXTEND' && (
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700">Tanggal akhir baru</span>
                  <input
                    type="date"
                    value={form.newEndDate}
                    onChange={(e) => setForm({ ...form, newEndDate: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-[11px] font-semibold text-slate-700">
                  Tanggal berlaku keputusan
                </span>
                <input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-slate-700">
                  Alasan / dasar keputusan <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  placeholder="Contoh: Evaluasi kinerja memuaskan, kontrak diperpanjang 12 bulan."
                  className="mt-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 resize-none"
                />
                <span className="text-[10px] text-slate-400">Minimal 5 karakter, tercatat di audit log.</span>
              </label>

              {form.kind === 'CONVERT_TO_PERMANENT' && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                  Status kepegawaian akan berubah menjadi PKWTT dan tanggal pengangkatan diisi.
                  Perubahan ini tercatat pada riwayat status kepegawaian.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
              <button
                onClick={() => setForm(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={submitAction}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                {submitting ? 'Menyimpan...' : 'Simpan Keputusan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
