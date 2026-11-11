'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Wallet,
  ShieldCheck,
  Clock,
  Receipt,
  Building2,
  RotateCcw,
  Users,
  Search,
} from 'lucide-react';
import { formatRupiah } from '@/lib/utils/wibDate';
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

const rupiah = (value: number | null | undefined) => formatRupiah(value ?? 0);

export default function BoardCostPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string | null>('net');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Column Filters State
  const [searchEmployee, setSearchEmployee] = useState<string>('');
  const [departmentSearch, setDepartmentSearch] = useState<string>('');

  useEffect(() => {
    let active = true;
    setError(null);
    const deptParam =
      selectedDepartment && selectedDepartment !== 'ALL'
        ? `&departmentId=${encodeURIComponent(selectedDepartment)}`
        : '';
    fetchJson(`/api/v1/analytics/board-cost?page=${page}&pageSize=${pageSize}${deptParam}`)
      .then((json) => {
        if (active) setData(json.data);
      })
      .catch((err: Error) => {
        if (active) {
          setData(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, pageSize, selectedDepartment]);

  // Client-side Sorting & Searching on the current dataset for instant UI feedback
  const processedEmployees = useMemo(() => {
    let rows = [...(data?.employees ?? [])];

    // Filter nama pegawai
    if (searchEmployee.trim()) {
      const q = searchEmployee.toLowerCase();
      rows = rows.filter(
        (e: any) =>
          (e.fullName && e.fullName.toLowerCase().includes(q)) ||
          (e.employeeCode && e.employeeCode.toLowerCase().includes(q)) ||
          (e.positionTitle && e.positionTitle.toLowerCase().includes(q))
      );
    }

    // Filter kolom nama departemen tambahan
    if (departmentSearch.trim()) {
      const q = departmentSearch.toLowerCase();
      rows = rows.filter((e: any) =>
        e.departmentName && e.departmentName.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortColumn && sortDirection) {
      rows.sort((a: any, b: any) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (typeof valA === 'string') {
          return sortDirection === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      });
    }

    return rows;
  }, [data?.employees, searchEmployee, departmentSearch, sortColumn, sortDirection]);

  const handleSort = (columnKey: string, direction: SortDirection) => {
    setSortColumn(direction ? columnKey : null);
    setSortDirection(direction);
  };

  const handleResetFilters = () => {
    setSelectedDepartment('ALL');
    setSearchEmployee('');
    setDepartmentSearch('');
    setSortColumn('net');
    setSortDirection('desc');
    setPage(1);
  };

  const hasActiveFilters =
    selectedDepartment !== 'ALL' ||
    Boolean(searchEmployee.trim()) ||
    Boolean(departmentSearch.trim()) ||
    sortColumn !== 'net' ||
    sortDirection !== 'desc';

  // BPJS Table State (Filter, Sorting, Paginasi)
  const [bpjsPage, setBpjsPage] = useState(1);
  const [bpjsPageSize, setBpjsPageSize] = useState(10);
  const [bpjsDepartment, setBpjsDepartment] = useState<string>('ALL');
  const [bpjsSearch, setBpjsSearch] = useState<string>('');
  const [bpjsClassFilter, setBpjsClassFilter] = useState<string>('ALL');
  const [bpjsTkStatusFilter, setBpjsTkStatusFilter] = useState<string>('ALL');
  const [bpjsKesStatusFilter, setBpjsKesStatusFilter] = useState<string>('ALL');
  const [bpjsSortColumn, setBpjsSortColumn] = useState<string | null>('fullName');
  const [bpjsSortDirection, setBpjsSortDirection] = useState<SortDirection>('asc');

  const departmentOptions = useMemo(() => {
    return (data?.departments ?? []).map((d: any) => ({
      label: d.name,
      value: d.id,
    }));
  }, [data?.departments]);

  const bpjsClassOptions = useMemo(() => {
    const list = (data?.bpjs?.byClass ?? []).map((c: any) => ({
      label: c.className,
      value: c.className,
    }));
    return list.length > 0
      ? list
      : [
          { label: 'Kelas 1', value: 'Kelas 1' },
          { label: 'Kelas 2', value: 'Kelas 2' },
          { label: 'Kelas 3', value: 'Kelas 3' },
          { label: 'Tidak diketahui', value: 'Tidak diketahui' },
        ];
  }, [data?.bpjs?.byClass]);

  const bpjsStatusOptions = [
    { label: 'Aktif', value: 'ACTIVE' },
    { label: 'Menunggu', value: 'PENDING' },
    { label: 'Tidak Aktif', value: 'INACTIVE' },
  ];

  const handleBpjsSort = (columnKey: string, direction: SortDirection) => {
    setBpjsSortColumn(direction ? columnKey : null);
    setBpjsSortDirection(direction);
    setBpjsPage(1);
  };

  const handleResetBpjsFilters = () => {
    setBpjsDepartment('ALL');
    setBpjsSearch('');
    setBpjsClassFilter('ALL');
    setBpjsTkStatusFilter('ALL');
    setBpjsKesStatusFilter('ALL');
    setBpjsSortColumn('fullName');
    setBpjsSortDirection('asc');
    setBpjsPage(1);
  };

  const hasActiveBpjsFilters =
    bpjsDepartment !== 'ALL' ||
    Boolean(bpjsSearch.trim()) ||
    bpjsClassFilter !== 'ALL' ||
    bpjsTkStatusFilter !== 'ALL' ||
    bpjsKesStatusFilter !== 'ALL' ||
    bpjsSortColumn !== 'fullName' ||
    bpjsSortDirection !== 'asc';

  // Client-side Filter & Sort untuk Tabel BPJS
  const processedBpjsEmployees = useMemo(() => {
    let rows = [...(data?.bpjs?.employees ?? [])];

    // Filter per Departemen
    if (bpjsDepartment !== 'ALL') {
      rows = rows.filter(
        (e: any) => e.departmentId === bpjsDepartment || e.departmentName === bpjsDepartment
      );
    }

    // Filter Pencarian Pegawai (Nama / NIK)
    if (bpjsSearch.trim()) {
      const q = bpjsSearch.toLowerCase();
      rows = rows.filter(
        (e: any) =>
          (e.fullName && e.fullName.toLowerCase().includes(q)) ||
          (e.employeeCode && e.employeeCode.toLowerCase().includes(q))
      );
    }

    // Filter Kelas Rawat
    if (bpjsClassFilter !== 'ALL') {
      rows = rows.filter(
        (e: any) => (e.bpjsKesClass ?? 'Tidak diketahui') === bpjsClassFilter
      );
    }

    // Filter Status BPJS Ketenagakerjaan
    if (bpjsTkStatusFilter !== 'ALL') {
      rows = rows.filter((e: any) => e.bpjsTkStatus === bpjsTkStatusFilter);
    }

    // Filter Status BPJS Kesehatan
    if (bpjsKesStatusFilter !== 'ALL') {
      rows = rows.filter((e: any) => e.bpjsKesStatus === bpjsKesStatusFilter);
    }

    // Sorting
    if (bpjsSortColumn && bpjsSortDirection) {
      rows.sort((a: any, b: any) => {
        let valA = a[bpjsSortColumn] ?? '';
        let valB = b[bpjsSortColumn] ?? '';

        if (typeof valA === 'string') {
          return bpjsSortDirection === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return bpjsSortDirection === 'asc' ? valA - valB : valB - valA;
      });
    }

    return rows;
  }, [
    data?.bpjs?.employees,
    bpjsDepartment,
    bpjsSearch,
    bpjsClassFilter,
    bpjsTkStatusFilter,
    bpjsKesStatusFilter,
    bpjsSortColumn,
    bpjsSortDirection,
  ]);

  // Data terpaginasi untuk tabel BPJS
  const paginatedBpjsEmployees = useMemo(() => {
    const start = (bpjsPage - 1) * bpjsPageSize;
    return processedBpjsEmployees.slice(start, start + bpjsPageSize);
  }, [processedBpjsEmployees, bpjsPage, bpjsPageSize]);

  if (loading && !data) {
    return (
      <div className="p-6 text-sm text-slate-500 animate-pulse bg-white rounded-xl border border-slate-200">
        Memuat rincian biaya dan gaji karyawan...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat rincian biaya: {error}
      </div>
    );
  }

  const departmentsList: Array<{ id: string; name: string; employeeCount: number }> =
    data?.departments ?? [];

  return (
    <div className="space-y-5">
      {/* 1. Ringkasan Kartu Metrik Keuangan */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Wallet className="w-4 h-4 text-indigo-600" /> Total Gaji Bersih (Net)
          </div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.payroll?.latest?.totalNet)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Periode {data?.payroll?.latest?.periodCode ?? '-'}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">Rata-rata Biaya per Karyawan</div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.analysis?.costPerEmployee)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.sampleSize ?? 0} pegawai aktif
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Clock className="w-4 h-4 text-amber-600" /> Biaya &amp; Jam Lembur
          </div>
          <div className="text-lg font-bold text-slate-800">{data?.overtime?.totalHours ?? 0} jam</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {rupiah(data?.overtime?.totalPay)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Receipt className="w-4 h-4 text-emerald-600" /> Beban Operasional &amp; Klaim
          </div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.operational?.totalAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.analysis?.topDecileEmployeeCount
              ? `${data.analysis.topDecileEmployeeCount} pegawai teratas (${data.analysis.topDecileStaffPercentage}% staf) = ${data.analysis.topDecileCostShare}% biaya`
              : 'Belum ada rincian biaya operasional'}
          </div>
        </div>
      </div>

      {/* 2. Temuan Analisis */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-800 mb-2">Temuan Analisis Keuangan &amp; SDM</h3>
        <ul className="space-y-1">
          {(data?.analysis?.highlights ?? []).map((h: string, i: number) => (
            <li key={i} className="text-xs text-slate-600 flex gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      {/* 3. Tabel Rincian Gaji Pegawai dengan Filter Departemen, Sorting & Column Filter */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Toolbar Filter Departemen & Pencarian */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Dropdown Departemen */}
            <div className="flex items-center gap-2">
              <label htmlFor="dept-filter" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#007a5a]" />
                <span>Departemen:</span>
              </label>
              <select
                id="dept-filter"
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] cursor-pointer shadow-2xs"
              >
                <option value="ALL">Semua Departemen ({data?.sampleSize ?? data?.employeesPagination?.total ?? 0})</option>
                {departmentsList.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.employeeCount})
                  </option>
                ))}
              </select>
            </div>

            {/* Input Pencarian Nama Pegawai */}
            <div className="w-full sm:w-64">
              <DataTableColumnFilter
                columnTitle="Nama Pegawai"
                value={searchEmployee}
                onChange={setSearchEmployee}
                placeholder="Cari nama, NIK, jabatan..."
                variant="inline"
              />
            </div>
          </div>

          {/* Tombol Reset Filter */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-rose-600 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
              title="Reset seluruh filter dan pengurutan ke kondisi default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* Tabel Data Gaji */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200 select-none">
              <tr>
                {/* Kolom Pegawai */}
                <th className="p-3 whitespace-nowrap">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Pegawai"
                      sortDirection={sortColumn === 'fullName' ? sortDirection : null}
                      onSort={(dir) => handleSort('fullName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Pegawai"
                      value={searchEmployee}
                      onChange={setSearchEmployee}
                      placeholder="Cari nama..."
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Departemen */}
                <th className="p-3 whitespace-nowrap">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Departemen"
                      sortDirection={sortColumn === 'departmentName' ? sortDirection : null}
                      onSort={(dir) => handleSort('departmentName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Departemen"
                      value={departmentSearch}
                      onChange={setDepartmentSearch}
                      placeholder="Cari divisi..."
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Gaji Pokok */}
                <th className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <DataTableColumnHeader
                      title="Gaji Pokok"
                      sortDirection={sortColumn === 'baseSalary' ? sortDirection : null}
                      onSort={(dir) => handleSort('baseSalary', dir)}
                    />
                  </div>
                </th>

                {/* Kolom Tunjangan Tetap */}
                <th className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <DataTableColumnHeader
                      title="Tunjangan"
                      sortDirection={sortColumn === 'fixedAllowance' ? sortDirection : null}
                      onSort={(dir) => handleSort('fixedAllowance', dir)}
                    />
                  </div>
                </th>

                {/* Kolom Upah Lembur */}
                <th className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <DataTableColumnHeader
                      title="Lembur"
                      sortDirection={sortColumn === 'overtimePay' ? sortDirection : null}
                      onSort={(dir) => handleSort('overtimePay', dir)}
                    />
                  </div>
                </th>

                {/* Kolom PPh 21 */}
                <th className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <DataTableColumnHeader
                      title="PPh 21"
                      sortDirection={sortColumn === 'pph21' ? sortDirection : null}
                      onSort={(dir) => handleSort('pph21', dir)}
                    />
                  </div>
                </th>

                {/* Kolom Total Gross */}
                <th className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <DataTableColumnHeader
                      title="Gross"
                      sortDirection={sortColumn === 'gross' ? sortDirection : null}
                      onSort={(dir) => handleSort('gross', dir)}
                    />
                  </div>
                </th>

                {/* Kolom Gaji Bersih (Net) */}
                <th className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <DataTableColumnHeader
                      title="Gaji Bersih (Net)"
                      sortDirection={sortColumn === 'net' ? sortDirection : null}
                      onSort={(dir) => handleSort('net', dir)}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <Users className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-xs text-slate-600">
                      Tidak ada data pegawai yang sesuai dengan kriteria filter.
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 text-xs font-bold text-[#007a5a] hover:underline cursor-pointer"
                      >
                        Reset semua filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                processedEmployees.map((e: any) => (
                  <tr key={e.employeeId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-800">
                      <div>{e.fullName}</div>
                      {e.positionTitle && (
                        <div className="text-[11px] text-slate-400 font-normal">{e.positionTitle}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                        {e.departmentName}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">{rupiah(e.baseSalary)}</td>
                    <td className="p-3 text-right font-mono">{rupiah(e.fixedAllowance)}</td>
                    <td className="p-3 text-right font-mono">
                      <div>{rupiah(e.overtimePay)}</div>
                      {e.overtimeHours > 0 && (
                        <div className="text-[10px] text-amber-600 font-sans">
                          {e.overtimeHours} jam
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-500">{rupiah(e.pph21)}</td>
                    <td className="p-3 text-right font-mono text-slate-700 font-medium">
                      {rupiah(e.gross)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#007a5a]">
                      {rupiah(e.net)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Kontrol Paginasi Reusable (DataTablePagination) */}
        <DataTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={data?.employeesPagination?.total ?? processedEmployees.length}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      </div>

      {/* 4. Kepesertaan BPJS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Header & Filter Toolbar */}
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              Kepesertaan Jaminan Sosial BPJS Ketenagakerjaan &amp; BPJS Kesehatan
            </span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {processedBpjsEmployees.length} dari {data?.bpjs?.employees?.length ?? 0} Pegawai
            </span>
          </div>

          {/* Quick Toolbar: Filter Departemen & Pencarian */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter per Departemen */}
            <div className="relative flex items-center min-w-[170px]">
              <Building2 className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={bpjsDepartment}
                onChange={(e) => {
                  setBpjsDepartment(e.target.value);
                  setBpjsPage(1);
                }}
                className="h-8 w-full pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] cursor-pointer"
                title="Filter berdasarkan departemen"
              >
                <option value="ALL">Semua Departemen</option>
                {(data?.departments ?? []).map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.employeeCount})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Search */}
            <div className="relative flex items-center min-w-[150px]">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={bpjsSearch}
                onChange={(e) => {
                  setBpjsSearch(e.target.value);
                  setBpjsPage(1);
                }}
                placeholder="Cari pegawai..."
                className="h-8 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
              />
            </div>

            {/* Reset Filter Button */}
            {hasActiveBpjsFilters && (
              <button
                type="button"
                onClick={handleResetBpjsFilters}
                className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset seluruh filter tabel BPJS"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {/* Kolom Pegawai */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Pegawai"
                      sortDirection={bpjsSortColumn === 'fullName' ? bpjsSortDirection : null}
                      onSort={(dir) => handleBpjsSort('fullName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Pegawai"
                      value={bpjsSearch}
                      onChange={(val) => {
                        setBpjsSearch(val);
                        setBpjsPage(1);
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
                      sortDirection={bpjsSortColumn === 'departmentName' ? bpjsSortDirection : null}
                      onSort={(dir) => handleBpjsSort('departmentName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Departemen"
                      value={bpjsDepartment === 'ALL' ? '' : bpjsDepartment}
                      onChange={(val) => {
                        setBpjsDepartment(val || 'ALL');
                        setBpjsPage(1);
                      }}
                      options={departmentOptions}
                      placeholder="Pilih departemen..."
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom No. BPJS TK */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="No. BPJS Ketenagakerjaan"
                    sortDirection={bpjsSortColumn === 'bpjsTkNumberMasked' ? bpjsSortDirection : null}
                    onSort={(dir) => handleBpjsSort('bpjsTkNumberMasked', dir)}
                  />
                </th>

                {/* Kolom No. BPJS Kesehatan */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="No. BPJS Kesehatan"
                    sortDirection={bpjsSortColumn === 'bpjsKesNumberMasked' ? bpjsSortDirection : null}
                    onSort={(dir) => handleBpjsSort('bpjsKesNumberMasked', dir)}
                  />
                </th>

                {/* Kolom Kelas Rawat */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Kelas Rawat"
                      sortDirection={bpjsSortColumn === 'bpjsKesClass' ? bpjsSortDirection : null}
                      onSort={(dir) => handleBpjsSort('bpjsKesClass', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Kelas Rawat"
                      value={bpjsClassFilter === 'ALL' ? '' : bpjsClassFilter}
                      onChange={(val) => {
                        setBpjsClassFilter(val || 'ALL');
                        setBpjsPage(1);
                      }}
                      options={bpjsClassOptions}
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Status TK */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Status Ketenagakerjaan"
                      sortDirection={bpjsSortColumn === 'bpjsTkStatus' ? bpjsSortDirection : null}
                      onSort={(dir) => handleBpjsSort('bpjsTkStatus', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Status TK"
                      value={bpjsTkStatusFilter === 'ALL' ? '' : bpjsTkStatusFilter}
                      onChange={(val) => {
                        setBpjsTkStatusFilter(val || 'ALL');
                        setBpjsPage(1);
                      }}
                      options={bpjsStatusOptions}
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Status Kesehatan */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Status Kesehatan"
                      sortDirection={bpjsSortColumn === 'bpjsKesStatus' ? bpjsSortDirection : null}
                      onSort={(dir) => handleBpjsSort('bpjsKesStatus', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Status Kesehatan"
                      value={bpjsKesStatusFilter === 'ALL' ? '' : bpjsKesStatusFilter}
                      onChange={(val) => {
                        setBpjsKesStatusFilter(val || 'ALL');
                        setBpjsPage(1);
                      }}
                      options={bpjsStatusOptions}
                      variant="popover"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedBpjsEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">Tidak ada data pegawai yang sesuai</span>
                      <span className="text-slate-400 text-[11px]">
                        Coba sesuaikan kata kunci pencarian atau filter di atas.
                      </span>
                      {hasActiveBpjsFilters && (
                        <button
                          type="button"
                          onClick={handleResetBpjsFilters}
                          className="mt-1 px-3 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                        >
                          Reset Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBpjsEmployees.map((e: any) => (
                  <tr key={e.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{e.fullName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{e.employeeCode}</div>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{e.departmentName ?? '—'}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{e.bpjsTkNumberMasked ?? '—'}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{e.bpjsKesNumberMasked ?? '—'}</td>
                    <td className="p-3 text-slate-700">{e.bpjsKesClass ?? '—'}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          e.bpjsTkStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : e.bpjsTkStatus === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {e.bpjsTkStatus === 'ACTIVE'
                          ? 'Aktif'
                          : e.bpjsTkStatus === 'PENDING'
                          ? 'Menunggu'
                          : e.bpjsTkStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          e.bpjsKesStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : e.bpjsKesStatus === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {e.bpjsKesStatus === 'ACTIVE'
                          ? 'Aktif'
                          : e.bpjsKesStatus === 'PENDING'
                          ? 'Menunggu'
                          : e.bpjsKesStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi Modern Reusable (DataTablePagination) */}
        <DataTablePagination
          currentPage={bpjsPage}
          pageSize={bpjsPageSize}
          totalItems={processedBpjsEmployees.length}
          onPageChange={setBpjsPage}
          onPageSizeChange={(newSize) => {
            setBpjsPageSize(newSize);
            setBpjsPage(1);
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      </div>

      {/* 5. Biaya Operasional per Kategori & Lembur per Departemen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 mb-2">Biaya Operasional per Kategori</h3>
          <ul className="space-y-1.5">
            {(data?.operational?.byCategory ?? []).map((row: any) => (
              <li key={row.category} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{row.category}</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {rupiah(row.amount)} <span className="text-slate-400 font-sans font-normal">({row.count} klaim)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 mb-2">Lembur per Departemen</h3>
          <ul className="space-y-1.5">
            {(data?.overtime?.byDepartment ?? []).map((row: any) => (
              <li key={row.departmentName} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate pr-2">{row.departmentName}</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {row.hours} jam &bull; {rupiah(row.pay)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
