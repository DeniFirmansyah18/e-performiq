'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  Users,
  Building2,
  Search,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { formatDateTimeWib } from '@/lib/utils/wibDate';
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

const EVENT_TYPE_LABELS: Record<string, { label: string; badge: string }> = {
  ATTENDANCE: { label: 'Kehadiran', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  KPI_DAILY: { label: 'KPI Harian', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DPI_STATUS: { label: 'Status DPI', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  LEAVE: { label: 'Cuti / Izin', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  OVERTIME: { label: 'Lembur', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  TRAINING: { label: 'Pelatihan', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  LETTER: { label: 'Surat Dinas', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  DISCIPLINARY: { label: 'Disiplin', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  RECOGNITION: { label: 'Apresiasi', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  CAREER: { label: 'Jenjang Karir', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

export default function BoardActivityPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string | null>('occurredAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/board-activity')
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

  // Opsi Departemen Dinamis
  const departmentOptions = useMemo(() => {
    const fromByDept = (data?.byDepartment ?? []).map((d: any) => ({
      label: `${d.departmentName} (${d.count})`,
      value: d.departmentName,
    }));
    if (fromByDept.length > 0) return fromByDept;

    const depts = Array.from(
      new Set((data?.recent ?? []).map((r: any) => r.departmentName).filter(Boolean))
    ) as string[];
    return depts.sort().map((d) => ({ label: d, value: d }));
  }, [data?.byDepartment, data?.recent]);

  // Opsi Tipe Aktivitas Dinamis
  const eventTypeOptions = useMemo(() => {
    return (data?.byEventType ?? []).map((t: any) => ({
      label: `${EVENT_TYPE_LABELS[t.eventType]?.label ?? t.eventType} (${t.count})`,
      value: t.eventType,
    }));
  }, [data?.byEventType]);

  const handleSort = (columnKey: string, direction: SortDirection) => {
    setSortColumn(direction ? columnKey : null);
    setSortDirection(direction);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedDepartment('ALL');
    setSearchQuery('');
    setSelectedEventType('ALL');
    setSortColumn('occurredAt');
    setSortDirection('desc');
    setPage(1);
  };

  const hasActiveFilters =
    selectedDepartment !== 'ALL' ||
    Boolean(searchQuery.trim()) ||
    selectedEventType !== 'ALL' ||
    sortColumn !== 'occurredAt' ||
    sortDirection !== 'desc';

  // Client-side Filter & Sorting
  const processedRecent = useMemo(() => {
    let rows = [...(data?.recent ?? [])];

    // Filter Departemen
    if (selectedDepartment !== 'ALL') {
      rows = rows.filter((r: any) => r.departmentName === selectedDepartment);
    }

    // Filter Pencarian Pegawai / NIK / Ringkasan
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (r: any) =>
          (r.employeeName && r.employeeName.toLowerCase().includes(q)) ||
          (r.employeeCode && r.employeeCode.toLowerCase().includes(q)) ||
          (r.summary && r.summary.toLowerCase().includes(q)) ||
          (r.eventType && r.eventType.toLowerCase().includes(q))
      );
    }

    // Filter Tipe Aktivitas
    if (selectedEventType !== 'ALL') {
      rows = rows.filter((r: any) => r.eventType === selectedEventType);
    }

    // Sorting
    if (sortColumn && sortDirection) {
      rows.sort((a: any, b: any) => {
        let valA = a[sortColumn] ?? '';
        let valB = b[sortColumn] ?? '';

        if (sortColumn === 'occurredAt') {
          const timeA = new Date(valA).getTime() || 0;
          const timeB = new Date(valB).getTime() || 0;
          return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        }

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
  }, [
    data?.recent,
    selectedDepartment,
    searchQuery,
    selectedEventType,
    sortColumn,
    sortDirection,
  ]);

  const paginatedRecent = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedRecent.slice(start, start + pageSize);
  }, [processedRecent, page, pageSize]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500 animate-pulse bg-white rounded-xl border border-slate-200">
        Memuat aktivitas dan kepatuhan tim...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat aktivitas: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 3 Kartu Metrik Utama */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Activity className="w-4 h-4 text-indigo-600" /> Total Catatan Aktivitas
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.totalEvents ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{data?.fromDate} s.d. {data?.toDate}</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Users className="w-4 h-4 text-emerald-600" /> Tingkat Partisipasi Karyawan
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {data?.analysis?.coveragePercentage ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            dari {data?.analysis?.activeEmployees ?? 0} pegawai aktif
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Building2 className="w-4 h-4 text-amber-600" /> Unit Kerja Paling Produktif
          </div>
          <div className="text-lg font-bold text-slate-800 truncate">
            {data?.analysis?.busiestDepartment ?? '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Aktivitas tersering: {data?.analysis?.busiestEventType ?? '-'}
          </div>
        </div>
      </div>

      {/* Temuan & Catatan Produktivitas Tim */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Temuan & Catatan Produktivitas Tim</span>
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

      {/* Distribusi Berdasarkan Jenis & Role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 mb-2">Berdasarkan Jenis Aktivitas</h3>
          <ul className="space-y-2">
            {(data?.byEventType ?? []).map((row: any) => {
              const info = EVENT_TYPE_LABELS[row.eventType];
              return (
                <li key={row.eventType} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                        info?.badge ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {info?.label ?? row.eventType}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">{row.eventType}</span>
                  </div>
                  <span className="font-semibold text-slate-800 font-mono">
                    {row.count} ({row.percentage}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 mb-2">Berdasarkan Tingkat Jabatan / Role</h3>
          <ul className="space-y-2">
            {(data?.byOwnerRole ?? []).map((row: any) => (
              <li key={row.role} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">{row.role}</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {row.count} ({row.percentage}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ==================================================== */}
      {/* Tabel Aktivitas Terbaru                              */}
      {/* ==================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Toolbar Tabel */}
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              Catatan Log Aktivitas Terbaru
            </span>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {processedRecent.length} dari {data?.recent?.length ?? 0} Catatan
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter per Departemen */}
            <div className="relative flex items-center min-w-[170px]">
              <Building2 className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-full pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] cursor-pointer"
                title="Filter berdasarkan departemen"
              >
                <option value="ALL">Semua Departemen</option>
                {departmentOptions.map((opt: { label: string; value: string }) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Search */}
            <div className="relative flex items-center min-w-[160px]">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari pegawai / ringkasan..."
                className="h-8 w-full pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
              />
            </div>

            {/* Filter Jenis Aktivitas */}
            <select
              value={selectedEventType}
              onChange={(e) => {
                setSelectedEventType(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#007a5a] cursor-pointer"
            >
              <option value="ALL">Semua Jenis</option>
              {eventTypeOptions.map((opt: { label: string; value: string }) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset seluruh filter aktivitas"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Data Aktivitas */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {/* Kolom Pegawai */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Pegawai"
                      sortDirection={sortColumn === 'employeeName' ? sortDirection : null}
                      onSort={(dir) => handleSort('employeeName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Pegawai"
                      value={searchQuery}
                      onChange={(val) => {
                        setSearchQuery(val);
                        setPage(1);
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
                      sortDirection={sortColumn === 'departmentName' ? sortDirection : null}
                      onSort={(dir) => handleSort('departmentName', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Departemen"
                      value={selectedDepartment === 'ALL' ? '' : selectedDepartment}
                      onChange={(val) => {
                        setSelectedDepartment(val || 'ALL');
                        setPage(1);
                      }}
                      options={departmentOptions}
                      placeholder="Pilih departemen..."
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Tipe Aktivitas */}
                <th className="p-3">
                  <div className="flex items-center justify-between gap-1">
                    <DataTableColumnHeader
                      title="Jenis Aktivitas"
                      sortDirection={sortColumn === 'eventType' ? sortDirection : null}
                      onSort={(dir) => handleSort('eventType', dir)}
                    />
                    <DataTableColumnFilter
                      columnTitle="Jenis Aktivitas"
                      value={selectedEventType === 'ALL' ? '' : selectedEventType}
                      onChange={(val) => {
                        setSelectedEventType(val || 'ALL');
                        setPage(1);
                      }}
                      options={eventTypeOptions}
                      variant="popover"
                    />
                  </div>
                </th>

                {/* Kolom Ringkasan */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Ringkasan Aktivitas"
                    sortDirection={sortColumn === 'summary' ? sortDirection : null}
                    onSort={(dir) => handleSort('summary', dir)}
                  />
                </th>

                {/* Kolom Waktu Kejadian */}
                <th className="p-3">
                  <DataTableColumnHeader
                    title="Waktu Kejadian (WIB)"
                    sortDirection={sortColumn === 'occurredAt' ? sortDirection : null}
                    onSort={(dir) => handleSort('occurredAt', dir)}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRecent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Activity className="w-8 h-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">Tidak ada catatan aktivitas yang sesuai</span>
                      <span className="text-slate-400 text-[11px]">
                        Coba sesuaikan kata kunci pencarian atau filter departemen di atas.
                      </span>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-1 px-3 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                        >
                          Reset Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecent.map((row: any) => {
                  const eventInfo = EVENT_TYPE_LABELS[row.eventType];
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{row.employeeName}</div>
                        {row.employeeCode && (
                          <div className="font-mono text-[10px] text-slate-400">{row.employeeCode}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 font-medium">{row.departmentName ?? '—'}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            eventInfo?.badge ?? 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {eventInfo?.label ?? row.eventType}
                        </span>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{row.eventType}</div>
                      </td>
                      <td className="p-3 text-slate-700 max-w-md">{row.summary}</td>
                      <td className="p-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {row.occurredAt ? formatDateTimeWib(row.occurredAt) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi Tabel Aktivitas */}
        <DataTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={processedRecent.length}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      </div>
    </div>
  );
}
