'use client';
import React, { useEffect, useMemo, useState } from 'react';
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees.slice(0, 50);
    return employees
      .filter((e) =>
        [e.fullName, e.employeeCode, e.department, e.position]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      )
      .slice(0, 50);
  }, [employees, search]);

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

        <div className="border-t border-slate-100 pt-3">
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
                  <button
                    onClick={() => openDetail(e.employeeId)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Lihat kontribusi
                  </button>
                ),
              },
            ]}
          />
        </div>
      </div>

      {(detailLoading || detail || detailError) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h4 className="font-bold text-sm text-slate-900">
                {detail?.fullName ?? 'Detail Pegawai'}
              </h4>
              <button
                onClick={() => {
                  setDetail(null);
                  setDetailError(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {detailLoading && (
                <p className="text-xs text-slate-500 animate-pulse">Memuat kontribusi pegawai...</p>
              )}

              {detailError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {detailError}
                </p>
              )}

              {detail && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-500">NIK</span>
                      <p className="font-semibold text-slate-800">{detail.employeeCode}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Status Kepegawaian (v2)</span>
                      <p className="font-semibold text-slate-800">
                        {detail.employmentStatus ?? '-'}
                      </p>
                      {detail.legacyStatus && detail.legacyStatus !== detail.employmentStatus && (
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          Kolom lama: {detail.legacyStatus} (perlu disinkronkan)
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500">Departemen / Posisi</span>
                      <p className="font-semibold text-slate-800">
                        {detail.departmentName} &bull; {detail.positionTitle}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Grade</span>
                      <p className="font-semibold text-slate-800">{detail.jobGrade ?? '-'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Award className="w-3.5 h-3.5" />
                      GPA {detail.latestGpa ?? '-'}
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
                      Rating {detail.latestRating ?? '-'}
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {detail.nineBoxQuadrant ?? 'Belum ada kuadran'}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <h5 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-indigo-600" />
                      Kontribusi terhadap Pilar Strategis
                    </h5>

                    {!detail.hasKpi ? (
                      <p className="text-[11px] text-slate-500">
                        Belum ada KPI individual yang terhubung ke pilar strategis, sehingga
                        kontribusi tidak dapat disimpulkan.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {detail.pillars.map((p) => (
                          <li
                            key={p.pillarId}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50/50"
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-800">{p.pillarName}</span>
                              <span className="text-slate-500">{p.perspective}</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, p.achievementPercentage)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                              <span>
                                {p.kpiCount} KPI &bull; bobot pilar {p.strategicWeight}%
                              </span>
                              <span className="font-semibold text-slate-700">
                                Capaian {p.achievementPercentage}%
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}