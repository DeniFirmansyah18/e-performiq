'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users, X, Target, Award } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';

interface DirectoryEmployee {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  status: string | null;
  department: string | null;
  position: string | null;
}

interface PillarContribution {
  pillarId: string;
  pillarName: string;
  perspective: string;
  strategicWeight: number;
  kpiCount: number;
  achievementPercentage: number;
}

interface BscContribution {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  departmentName: string;
  positionTitle: string;
  jobGrade: string | null;
  employmentStatus: string | null;
  legacyStatus: string | null;
  latestGpa: number | null;
  latestRating: string | null;
  nineBoxQuadrant: string | null;
  hasKpi: boolean;
  pillars: PillarContribution[];
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

export default function EmployeeDirectoryPanel({
  initialSearch,
}: { initialSearch?: string } = {}) {
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [search, setSearch] = useState(initialSearch ?? '');
  const [filterDept, setFilterDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<BscContribution | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/hr/employee-directory')
      .then((json) => {
        if (active && json?.status === 'success') setEmployees(json.data?.employees ?? []);
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

  // Daftar departemen unik untuk pilihan filter.
  const daftarDept = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department).filter(Boolean) as string[])).sort(),
    [employees]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Filter departemen lebih dulu, lalu pencarian teks di dalamnya.
    const basis = filterDept ? employees.filter((e) => e.department === filterDept) : employees;
    if (!term) return basis.slice(0, 50);
    return basis
      .filter((e) =>
        [e.fullName, e.employeeCode, e.department, e.position]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      )
      .slice(0, 50);
  }, [employees, search, filterDept]);

  async function openDetail(employeeId: string) {
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const json = await fetchJson(`/api/v1/hr/employees/${employeeId}/bsc-contribution`);
      if (json?.status === 'success') setDetail(json.data);
    } catch (err) {
      setDetailError((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat direktori pegawai...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat direktori pegawai: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" /> Direktori Pegawai
          </h3>
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-3">
          {/* Filter departemen: menyaring daftar sebelum pencarian teks. */}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="filter-dept" className="text-[11px] font-semibold text-slate-600">
              Departemen
            </label>
            <select
              id="filter-dept"
              aria-label="Filter departemen"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="text-[11px] rounded-lg border border-[#cbd5e1] px-2 py-1.5 bg-white font-medium text-[#334155] min-w-[12rem]"
            >
              <option value="">Semua departemen</option>
              {daftarDept.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {filterDept && (
              <button
                type="button"
                onClick={() => setFilterDept('')}
                className="text-[11px] font-semibold text-[#007a5a] hover:underline"
              >
                Hapus filter
              </button>
            )}
          </div>

          <DataTable
            rows={filtered}
            rowKey={(emp) => emp.employeeId}
            searchPlaceholder="Cari nama, NIK, departemen, atau posisi..."
            initialSearch={search}
            itemLabel="pegawai"
            emptyMessage="Belum ada data pegawai."
            columns={[
              { key: 'nik', header: 'NIK', value: (e) => e.employeeCode, render: (e) => <span className="font-mono text-[11px] text-slate-500">{e.employeeCode ?? '-'}</span> },
              { key: 'nama', header: 'Nama', value: (e) => e.fullName, render: (e) => <span className="font-medium text-slate-800">{e.fullName}</span> },
              { key: 'dept', header: 'Departemen', value: (e) => e.department, render: (e) => e.department ?? '-' },
              { key: 'pos', header: 'Posisi', value: (e) => e.position, render: (e) => e.position ?? '-' },
              { key: 'status', header: 'Status', value: (e) => e.status, render: (e) => e.status ?? '-' },
              {
                key: 'detail',
                header: 'Detail',
                value: () => '',
                render: (e) => (
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <Link
                      href={`/dashboard/employees/${e.employeeId}`}
                      className="inline-flex items-center rounded-lg bg-[#007a5a] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#00684a] transition-colors"
                    >
                      Detail Pegawai
                    </Link>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

    </div>
  );
}