'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Briefcase, Building2, Search, RotateCcw, Users } from 'lucide-react';
import {
  DataTableColumnHeader,
  type SortDirection,
} from '@/components/ui/data-table/DataTableColumnHeader';
import { DataTableColumnFilter } from '@/components/ui/data-table/DataTableColumnFilter';
import { DataTablePagination } from '@/components/ui/data-table/DataTablePagination';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  if (json?.status !== 'success' || !json?.data) {
    throw new Error(json?.detail ?? json?.message ?? 'Respons data tidak dikenali');
  }
  return json;
}

const FIT_CLASS: Record<string, string> = {
  COMPLIANT: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border border-amber-200',
  NOT_COMPLIANT: 'bg-rose-50 text-rose-700 border border-rose-200',
  NO_TEMPLATE: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const FIT_LABEL: Record<string, string> = {
  COMPLIANT: 'Sesuai Kriteria',
  PARTIAL: 'Perlu Pembinaan',
  NOT_COMPLIANT: 'Belum Memenuhi',
  NO_TEMPLATE: 'Belum Ada Standar',
};

const STATUS_OPTIONS = [
  { label: 'Sesuai Kriteria', value: 'COMPLIANT' },
  { label: 'Perlu Pembinaan', value: 'PARTIAL' },
  { label: 'Belum Memenuhi', value: 'NOT_COMPLIANT' },
  { label: 'Belum Ada Standar', value: 'NO_TEMPLATE' },
];

export default function BoardPositionFitPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================
  // State Tabel 1: Kesesuaian Jabatan Struktural
  // ==========================================
  const [posPage, setPosPage] = useState(1);
  const [posPageSize, setPosPageSize] = useState(5);
  const [posSearch, setPosSearch] = useState('');
  const [posStatusFilter, setPosStatusFilter] = useState('ALL');
  const [posGradeFilter, setPosGradeFilter] = useState('ALL');
  const [posSortColumn, setPosSortColumn] = useState<string | null>('positionTitle');
  const [posSortDirection, setPosSortDirection] = useState<SortDirection>('asc');

  // ==========================================
  // State Tabel 2: Evaluasi Karyawan per Jabatan
  // ==========================================
  const [empPage, setEmpPage] = useState(1);
  const [empPageSize, setEmpPageSize] = useState(10);
  const [empDepartment, setEmpDepartment] = useState('ALL');
  const [empSearch, setEmpSearch] = useState('');
  const [empPositionFilter, setEmpPositionFilter] = useState('ALL');
  const [empStatusFilter, setEmpStatusFilter] = useState('ALL');
  const [empSortColumn, setEmpSortColumn] = useState<string | null>('fullName');
  const [empSortDirection, setEmpSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/position-fit')
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

  // ------------------------------------------
  // Opsi Filter Dinamis
  // ------------------------------------------
  const gradeOptions = useMemo(() => {
    const grades = Array.from(
      new Set(
        (data?.byPosition ?? [])
          .map((p: any) => p.jobGrade)
          .filter(Boolean)
      )
    ) as string[];
    return grades.sort().map((g) => ({ label: `Grade ${g}`, value: g }));
  }, [data?.byPosition]);

  const departmentOptions = useMemo(() => {
    const depts = Array.from(
      new Set(
        (data?.employees ?? [])
          .map((e: any) => e.departmentName)
          .filter(Boolean)
      )
    ) as string[];
    return depts.sort().map((d) => ({ label: d, value: d }));
  }, [data?.employees]);

  const positionOptions = useMemo(() => {
    const pos = Array.from(
      new Set(
        (data?.employees ?? [])
          .map((e: any) => e.positionTitle)
          .filter(Boolean)
      )
    ) as string[];
    return pos.sort().map((p) => ({ label: p, value: p }));
  }, [data?.employees]);

  // ------------------------------------------
  // Handlers & Processed Data Tabel 1 (Posisi)
  // ------------------------------------------
  const handlePosSort = (col: string, dir: SortDirection) => {
    setPosSortColumn(dir ? col : null);
    setPosSortDirection(dir);
    setPosPage(1);
  };

  const handleResetPosFilters = () => {
    setPosSearch('');
    setPosStatusFilter('ALL');
    setPosGradeFilter('ALL');
    setPosSortColumn('positionTitle');
    setPosSortDirection('asc');
    setPosPage(1);
  };

  const hasActivePosFilters =
    Boolean(posSearch.trim()) ||
    posStatusFilter !== 'ALL' ||
    posGradeFilter !== 'ALL' ||
    posSortColumn !== 'positionTitle' ||
    posSortDirection !== 'asc';

  const processedPositions = useMemo(() => {
    let rows = [...(data?.byPosition ?? [])];

    if (posSearch.trim()) {
      const q = posSearch.toLowerCase();
      rows = rows.filter((p: any) =>
        p.positionTitle && p.positionTitle.toLowerCase().includes(q)
      );
    }

    if (posStatusFilter !== 'ALL') {
      rows = rows.filter((p: any) => p.status === posStatusFilter);
    }

    if (posGradeFilter !== 'ALL') {
      rows = rows.filter((p: any) => p.jobGrade === posGradeFilter);
    }

    if (posSortColumn && posSortDirection) {
      rows.sort((a: any, b: any) => {
        let valA = a[posSortColumn] ?? '';
        let valB = b[posSortColumn] ?? '';
        if (typeof valA === 'string') {
          return posSortDirection === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return posSortDirection === 'asc' ? valA - valB : valB - valA;
      });
    }

    return rows;
  }, [data?.byPosition, posSearch, posStatusFilter, posGradeFilter, posSortColumn, posSortDirection]);

  const paginatedPositions = useMemo(() => {
    const start = (posPage - 1) * posPageSize;
    return processedPositions.slice(start, start + posPageSize);
  }, [processedPositions, posPage, posPageSize]);

  // ------------------------------------------
  // Handlers & Processed Data Tabel 2 (Pegawai)
  // ------------------------------------------
  const handleEmpSort = (col: string, dir: SortDirection) => {
    setEmpSortColumn(dir ? col : null);
    setEmpSortDirection(dir);
    setEmpPage(1);
  };

  const handleResetEmpFilters = () => {
    setEmpDepartment('ALL');
    setEmpSearch('');
    setEmpPositionFilter('ALL');
    setEmpStatusFilter('ALL');
    setEmpSortColumn('fullName');
    setEmpSortDirection('asc');
    setEmpPage(1);
  };

  const hasActiveEmpFilters =
    empDepartment !== 'ALL' ||
    Boolean(empSearch.trim()) ||
    empPositionFilter !== 'ALL' ||
    empStatusFilter !== 'ALL' ||
    empSortColumn !== 'fullName' ||
    empSortDirection !== 'asc';

  const processedEmployees = useMemo(() => {
    let rows = [...(data?.employees ?? [])];

    // Filter Departemen
    if (empDepartment !== 'ALL') {
      rows = rows.filter((e: any) => e.departmentName === empDepartment);
    }

    // Filter Pencarian Pegawai / NIK / Jabatan
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      rows = rows.filter(
        (e: any) =>
          (e.fullName && e.fullName.toLowerCase().includes(q)) ||
          (e.employeeCode && e.employeeCode.toLowerCase().includes(q)) ||
          (e.positionTitle && e.positionTitle.toLowerCase().includes(q))
      );
    }

    // Filter Jabatan
    if (empPositionFilter !== 'ALL') {
      rows = rows.filter((e: any) => e.positionTitle === empPositionFilter);
    }

    // Filter Status Kepatuhan
    if (empStatusFilter !== 'ALL') {
      rows = rows.filter((e: any) => e.status === empStatusFilter);
    }

    // Sorting
    if (empSortColumn && empSortDirection) {
      rows.sort((a: any, b: any) => {
        let valA = a[empSortColumn] ?? '';
        let valB = b[empSortColumn] ?? '';
        if (typeof valA === 'string') {
          return empSortDirection === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return empSortDirection === 'asc' ? valA - valB : valB - valA;
      });
    }

    return rows;
  }, [data?.employees, empDepartment, empSearch, empPositionFilter, empStatusFilter, empSortColumn, empSortDirection]);

  const paginatedEmployees = useMemo(() => {
    const start = (empPage - 1) * empPageSize;
    return processedEmployees.slice(start, start + empPageSize);
  }, [processedEmployees, empPage, empPageSize]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500 animate-pulse bg-white rounded-xl border border-slate-200">
        Memuat kesesuaian posisi dan peta talenta...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat kesesuaian posisi: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Temuan Analisis Highlight */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-indigo-600" />
          <span>Temuan Analisis Kesesuaian Posisi</span>
          {data?.periodCode && (
            <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Periode {data.periodCode}
            </span>
          )}
        </h3>
        <ul className="space-y-1.5">
          {(data?.analysis?.highlights ?? []).map((h: string, i: number) => (
            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ==================================================== */}
      {/* 1. Tabel Kesesuaian Jabatan Struktural                */}
      {/* ==================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Toolbar Tabel Posisi */}
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-700 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              Kesesuaian Jabatan Struktural
            </span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {processedPositions.length} dari {data?.byPosition?.length ?? 0} Jabatan
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Posisi */}
            <div className="relative flex items-center min-w-[160px]">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={posSearch}
                onChange={(e) => {
                  setPosSearch(e.target.value);
                  setPosPage(1);
                }}
                placeholder="Cari jabatan..."
                className="h-8 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
              />
            </div>

            {/* Filter Status */}
            <select
              value={posStatusFilter}
              onChange={(e) => {
                setPosStatusFilter(e.target.value);
                setPosPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#007a5a] cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Reset Button */}
            {hasActivePosFilters && (
              <button
                type="button"
                onClick={handleResetPosFilters}
                className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset filter posisi"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Data Posisi */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Posisi Jabatan"
                      sortDirection={posSortColumn === 'positionTitle' ? posSortDirection : null}
                      onSort={(dir) => handlePosSort('positionTitle', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Posisi"
                      value={posSearch}
                      onChange={(val) => {
                        setPosSearch(val);
                        setPosPage(1);
                      }}
                      placeholder="Cari posisi..."
                      variant="popover"
                    />
                  </div>
                </th>
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Grade"
                      sortDirection={posSortColumn === 'jobGrade' ? posSortDirection : null}
                      onSort={(dir) => handlePosSort('jobGrade', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Grade"
                      value={posGradeFilter === 'ALL' ? '' : posGradeFilter}
                      onChange={(val) => {
                        setPosGradeFilter(val || 'ALL');
                        setPosPage(1);
                      }}
                      options={gradeOptions}
                      variant="popover"
                    />
                  </div>
                </th>
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Jumlah Pejabat"
                    sortDirection={posSortColumn === 'holders' ? posSortDirection : null}
                    onSort={(dir) => handlePosSort('holders', dir)}
                  />
                </th>
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Pejabat Sesuai"
                    sortDirection={posSortColumn === 'compliantHolders' ? posSortDirection : null}
                    onSort={(dir) => handlePosSort('compliantHolders', dir)}
                  />
                </th>
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Standar KPI"
                    sortDirection={posSortColumn === 'templateKpiCount' ? posSortDirection : null}
                    onSort={(dir) => handlePosSort('templateKpiCount', dir)}
                  />
                </th>
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Cakupan"
                    sortDirection={posSortColumn === 'coveragePercentage' ? posSortDirection : null}
                    onSort={(dir) => handlePosSort('coveragePercentage', dir)}
                  />
                </th>
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Capaian"
                    sortDirection={posSortColumn === 'achievementPercentage' ? posSortDirection : null}
                    onSort={(dir) => handlePosSort('achievementPercentage', dir)}
                  />
                </th>
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Status Kepatuhan"
                      sortDirection={posSortColumn === 'status' ? posSortDirection : null}
                      onSort={(dir) => handlePosSort('status', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Status"
                      value={posStatusFilter === 'ALL' ? '' : posStatusFilter}
                      onChange={(val) => {
                        setPosStatusFilter(val || 'ALL');
                        setPosPage(1);
                      }}
                      options={STATUS_OPTIONS}
                      variant="popover"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPositions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Briefcase className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">Tidak ada jabatan yang sesuai filter</span>
                      {hasActivePosFilters && (
                        <button
                          type="button"
                          onClick={handleResetPosFilters}
                          className="mt-1 px-3 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                        >
                          Reset Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPositions.map((p: any) => (
                  <tr key={p.positionId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-semibold text-slate-800">{p.positionTitle}</td>
                    <td className="p-3 font-mono">{p.jobGrade ?? '-'}</td>
                    <td className="p-3">{p.holders} orang</td>
                    <td className="p-3 text-emerald-700 font-semibold">{p.compliantHolders} orang</td>
                    <td className="p-3">{p.templateKpiCount} KPI</td>
                    <td className="p-3 font-semibold">{p.coveragePercentage}%</td>
                    <td className="p-3 font-semibold">{p.achievementPercentage}%</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          FIT_CLASS[p.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {FIT_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi Tabel Posisi */}
        <DataTablePagination
          currentPage={posPage}
          pageSize={posPageSize}
          totalItems={processedPositions.length}
          onPageChange={setPosPage}
          onPageSizeChange={(newSize) => {
            setPosPageSize(newSize);
            setPosPage(1);
          }}
          pageSizeOptions={[5, 10, 20]}
        />
      </div>

      {/* ==================================================== */}
      {/* 2. Tabel Evaluasi Karyawan per Jabatan                */}
      {/* ==================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Toolbar Tabel Pegawai */}
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              Daftar Evaluasi Karyawan per Jabatan
            </span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {processedEmployees.length} dari {data?.employees?.length ?? 0} Pegawai
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter per Departemen */}
            <div className="relative flex items-center min-w-[170px]">
              <Building2 className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={empDepartment}
                onChange={(e) => {
                  setEmpDepartment(e.target.value);
                  setEmpPage(1);
                }}
                className="h-8 w-full pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] cursor-pointer"
                title="Filter berdasarkan departemen"
              >
                <option value="ALL">Semua Departemen</option>
                {departmentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Search Pegawai / Jabatan */}
            <div className="relative flex items-center min-w-[160px]">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={empSearch}
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  setEmpPage(1);
                }}
                placeholder="Cari nama / NIK..."
                className="h-8 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
              />
            </div>

            {/* Filter Status Pegawai */}
            <select
              value={empStatusFilter}
              onChange={(e) => {
                setEmpStatusFilter(e.target.value);
                setEmpPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#007a5a] cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Reset Button */}
            {hasActiveEmpFilters && (
              <button
                type="button"
                onClick={handleResetEmpFilters}
                className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset seluruh filter pegawai"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Data Pegawai */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {/* Kolom Pegawai */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Nama Pegawai"
                      sortDirection={empSortColumn === 'fullName' ? empSortDirection : null}
                      onSort={(dir) => handleEmpSort('fullName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Pegawai"
                      value={empSearch}
                      onChange={(val) => {
                        setEmpSearch(val);
                        setEmpPage(1);
                      }}
                      placeholder="Cari nama / NIK..."
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Departemen */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Departemen"
                      sortDirection={empSortColumn === 'departmentName' ? empSortDirection : null}
                      onSort={(dir) => handleEmpSort('departmentName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Departemen"
                      value={empDepartment === 'ALL' ? '' : empDepartment}
                      onChange={(val) => {
                        setEmpDepartment(val || 'ALL');
                        setEmpPage(1);
                      }}
                      options={departmentOptions}
                      placeholder="Pilih departemen..."
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Posisi */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Posisi Jabatan"
                      sortDirection={empSortColumn === 'positionTitle' ? empSortDirection : null}
                      onSort={(dir) => handleEmpSort('positionTitle', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Posisi"
                      value={empPositionFilter === 'ALL' ? '' : empPositionFilter}
                      onChange={(val) => {
                        setEmpPositionFilter(val || 'ALL');
                        setEmpPage(1);
                      }}
                      options={positionOptions}
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom KPI Cocok */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="KPI Cocok"
                    sortDirection={empSortColumn === 'matchedKpiCount' ? empSortDirection : null}
                    onSort={(dir) => handleEmpSort('matchedKpiCount', dir)}
                  />
                </th>

                {/* Kolom Cakupan */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Cakupan"
                    sortDirection={empSortColumn === 'coveragePercentage' ? empSortDirection : null}
                    onSort={(dir) => handleEmpSort('coveragePercentage', dir)}
                  />
                </th>

                {/* Kolom Capaian */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Capaian"
                    sortDirection={empSortColumn === 'achievementPercentage' ? empSortDirection : null}
                    onSort={(dir) => handleEmpSort('achievementPercentage', dir)}
                  />
                </th>

                {/* Kolom GPA */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="GPA"
                    sortDirection={empSortColumn === 'latestGpa' ? empSortDirection : null}
                    onSort={(dir) => handleEmpSort('latestGpa', dir)}
                  />
                </th>

                {/* Kolom Status */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Status Kepatuhan"
                      sortDirection={empSortColumn === 'status' ? empSortDirection : null}
                      onSort={(dir) => handleEmpSort('status', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Status"
                      value={empStatusFilter === 'ALL' ? '' : empStatusFilter}
                      onChange={(val) => {
                        setEmpStatusFilter(val || 'ALL');
                        setEmpPage(1);
                      }}
                      options={STATUS_OPTIONS}
                      variant="popover"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">Tidak ada pegawai yang sesuai filter</span>
                      <span className="text-slate-400 text-[11px]">
                        Coba sesuaikan kata kunci pencarian atau filter departemen di atas.
                      </span>
                      {hasActiveEmpFilters && (
                        <button
                          type="button"
                          onClick={handleResetEmpFilters}
                          className="mt-1 px-3 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                        >
                          Reset Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((e: any) => (
                  <tr key={e.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{e.fullName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{e.employeeCode}</div>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{e.departmentName || '—'}</td>
                    <td className="p-3 font-medium text-slate-700">{e.positionTitle}</td>
                    <td className="p-3 font-mono">
                      {e.matchedKpiCount} / {e.templateKpiCount}
                    </td>
                    <td className="p-3 font-semibold">{e.coveragePercentage}%</td>
                    <td className="p-3 font-semibold">{e.achievementPercentage}%</td>
                    <td className="p-3 font-mono font-semibold text-slate-700">{e.latestGpa ?? '—'}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          FIT_CLASS[e.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {FIT_LABEL[e.status] ?? e.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi Tabel Pegawai */}
        <DataTablePagination
          currentPage={empPage}
          pageSize={empPageSize}
          totalItems={processedEmployees.length}
          onPageChange={setEmpPage}
          onPageSizeChange={(newSize) => {
            setEmpPageSize(newSize);
            setEmpPage(1);
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      </div>
    </div>
  );
}
