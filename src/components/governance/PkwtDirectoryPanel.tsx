'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, ShieldAlert, CalendarClock, FileWarning } from 'lucide-react';

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

export default function PkwtDirectoryPanel({ initialSearch }: { initialSearch?: string } = {}) {
  const [data, setData] = useState<ContractsSummary | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<'ALL' | Urgency>('ALL');
  const [searchTerm, setSearchTerm] = useState(initialSearch ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/hr/contracts-summary')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
        return json;
      })
      .then((json) => {
        if (active && json?.status === 'success') setData(json.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, NIK, departemen, atau posisi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterUrgency(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterUrgency === f.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border-t border-slate-100 pt-3">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">NIK</th>
                <th className="p-3">Nama Pegawai</th>
                <th className="p-3">Posisi</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Akhir Kontrak</th>
                <th className="p-3">Sisa Waktu</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Tidak ditemukan data pegawai PKWT dengan kriteria ini.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.employeeId} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-[11px] text-slate-500">{item.employeeCode}</td>
                    <td className="p-3 font-medium text-slate-800">{item.fullName}</td>
                    <td className="p-3">{item.positionTitle}</td>
                    <td className="p-3">{item.departmentName}</td>
                    <td className="p-3 font-medium text-slate-700">{item.contractEndDate}</td>
                    <td className="p-3">{daysLabel(item.daysRemaining)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          URGENCY_META[item.urgency]?.className ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {URGENCY_META[item.urgency]?.label ?? item.urgency}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
