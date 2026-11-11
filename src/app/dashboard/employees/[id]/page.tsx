'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Wallet,
  Target,
  Activity,
  CalendarCheck,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Users,
  Mail,
  Phone,
  Briefcase,
  CalendarDays,
} from 'lucide-react';
import DataTable from '@/components/ui/DataTable';

interface Detail {
  profil: {
    id: string;
    employeeCode: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    departmentName: string | null;
    positionTitle: string | null;
    jobGrade: string | null;
    status: string | null;
    joinDate: string | null;
    masaKerja: string | null;
    managerName: string | null;
    directReportCount: number;
  };
  kpi: Array<{
    id: string;
    judul: string;
    target: number;
    actual: number;
    satuan: string;
    bobot: number;
    capaian: number;
    status: string;
    periode: string;
  }>;
  penggajian?: {
    gajiPokok: number;
    slip: Array<{ id: string; periode: string; bruto: number; potongan: number; bersih: number; status: string }>;
  };
  kehadiran: Array<{ tanggal: string; hadir: boolean; jamKerja: number; jamLembur: number }>;
  bpjs: Array<{
    nomorTk: string | null;
    nomorKes: string | null;
    kelas: string | null;
    statusTk: string | null;
    statusKes: string | null;
    terdaftar: string | null;
  }>;
  indikatorHarian: Array<{
    id: string;
    tanggal: string;
    indikator: string;
    satuan: string;
    target: number;
    aktual: number;
    status: string;
  }>;
  riwayatPenilaian: Array<{ periode: string; gpa: number; rating: string; total: number }>;
  kontribusi?: {
    hasKpi: boolean;
    latestGpa: number | null;
    latestRating: string | null;
    pillars: Array<{
      pillarId: string;
      pillarName: string;
      perspective: string;
      strategicWeight: number;
      kpiCount: number;
      achievementPercentage: number;
    }>;
  } | null;
}

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const angka = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n || 0);

const TAB = [
  { key: 'ringkasan', label: 'Ringkasan', ikon: User },
  { key: 'penggajian', label: 'Penggajian', ikon: Wallet },
  { key: 'kontribusi', label: 'Kontribusi BSC', ikon: Activity },
  { key: 'kinerja', label: 'Kinerja', ikon: Target },
  { key: 'kehadiran', label: 'Kehadiran', ikon: CalendarCheck },
  { key: 'lainnya', label: 'Lainnya', ikon: ShieldCheck },
] as const;

type TabKey = (typeof TAB)[number]['key'];

/** Satu baris informasi berlabel. */
function Baris({ label, nilai }: { label: React.ReactNode; nilai: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-[#64748b]">{label}</span>
      <span className="text-[11px] font-semibold text-[#0f172a] text-right">{nilai || '—'}</span>
    </div>
  );
}

export default function DetailPegawaiPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('ringkasan');

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/v1/hr/employees/${id}/detail`);
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setError(json?.detail ?? json?.message ?? 'Gagal memuat data pegawai.');
          return;
        }
        setData(json?.data ?? null);
      } catch {
        if (active) setError('Gagal menghubungi server.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Tab Penggajian hanya muncul bila server menyertakan datanya.
  const tabs = useMemo(() => TAB.filter((t) => t.key !== 'penggajian' || Boolean(data?.penggajian)), [data]);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat data pegawai…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#c5221f]">
          <AlertTriangle className="w-4 h-4" /> {error ?? 'Data pegawai tidak tersedia.'}
        </div>
        <Link href="/dashboard/hr-command" className="text-xs font-semibold text-[#007a5a] hover:underline">
          Kembali ke HR Command Center
        </Link>
      </div>
    );
  }

  const p = data.profil;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
      <Link
        href="/dashboard/hr-command"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#334155] hover:bg-[#f8fafc]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke HR Command Center
      </Link>

      {/* Kepala halaman */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-[#0f172a]">{p.fullName}</h1>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              {p.employeeCode} · {p.positionTitle ?? '—'} · {p.departmentName ?? '—'}
            </p>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#e6f4ea] text-[#137333]">
            {p.status ?? '—'}
          </span>
        </div>
      </div>

      {/* Tab */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#e2e8f0] bg-white p-1.5">
        {tabs.map((t) => {
          const Ikon = t.ikon;
          const aktif = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={aktif}
              className={`inline-flex flex-1 min-w-[7rem] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                aktif ? 'bg-[#007a5a] text-white shadow-sm' : 'text-[#007a5a] hover:bg-[#e6f4ea]'
              }`}
            >
              <Ikon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'ringkasan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="text-xs font-extrabold text-[#0f172a] mb-2">Data Pribadi</h2>
            <Baris label={<span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>} nilai={p.email} />
            <Baris label={<span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> Telepon</span>} nilai={p.phone} />
            <Baris label="NIP" nilai={p.employeeCode} />
          </div>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="text-xs font-extrabold text-[#0f172a] mb-2">Kepegawaian</h2>
            <Baris label={<span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> Jabatan</span>} nilai={p.positionTitle} />
            <Baris label="Departemen" nilai={p.departmentName} />
            <Baris label="Jenjang" nilai={p.jobGrade} />
            <Baris label={<span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Tanggal masuk</span>} nilai={p.joinDate} />
            <Baris label="Masa kerja" nilai={p.masaKerja} />
            <Baris label="Dinilai oleh" nilai={p.managerName ?? 'Tidak ada atasan langsung'} />
            {p.directReportCount > 0 && (
              <Baris
                label={<span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Bawahan langsung</span>}
                nilai={`${p.directReportCount} orang`}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'penggajian' && data.penggajian && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="text-xs font-extrabold text-[#0f172a] mb-1">Gaji Pokok</h2>
            <p className="text-xl font-black text-[#007a5a]">{rupiah(data.penggajian.gajiPokok)}</p>
            <p className="text-[10px] text-[#64748b] mt-1">
              Data ini hanya terlihat oleh pemegang izin penggajian (HR, BOD, Super Admin).
            </p>
          </div>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <h2 className="text-xs font-extrabold text-[#0f172a] mb-2">Slip Gaji per Periode</h2>
            <DataTable
              rows={data.penggajian.slip}
              rowKey={(r) => r.id}
              searchPlaceholder="Cari periode…"
              itemLabel="slip"
              emptyMessage="Belum ada slip gaji tercatat untuk pegawai ini."
              columns={[
                { key: 'periode', header: 'Periode', value: (r) => r.periode },
                { key: 'bruto', header: 'Bruto', value: (r) => r.bruto, render: (r) => rupiah(r.bruto) },
                { key: 'potongan', header: 'Potongan', value: (r) => r.potongan, render: (r) => rupiah(r.potongan) },
                {
                  key: 'bersih',
                  header: 'Diterima',
                  value: (r) => r.bersih,
                  render: (r) => <span className="font-bold text-[#007a5a]">{rupiah(r.bersih)}</span>,
                },
                { key: 'status', header: 'Status', value: (r) => r.status },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'kinerja' && (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <h2 className="text-xs font-extrabold text-[#0f172a] mb-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#007a5a]" /> Sasaran Kinerja (KPI)
          </h2>
          <DataTable
            rows={data.kpi}
            rowKey={(r) => r.id}
            searchPlaceholder="Cari judul KPI atau periode…"
            itemLabel="KPI"
            emptyMessage="Belum ada KPI untuk pegawai ini."
            columns={[
              { key: 'judul', header: 'Sasaran', value: (r) => r.judul },
              { key: 'periode', header: 'Periode', value: (r) => r.periode },
              {
                key: 'target',
                header: 'Target / Realisasi',
                value: (r) => `${r.target} / ${r.actual}`,
                render: (r) => (
                  <span>
                    {angka(r.target)} / {angka(r.actual)} <span className="text-[#64748b]">{r.satuan}</span>
                  </span>
                ),
              },
              { key: 'bobot', header: 'Bobot', value: (r) => r.bobot, render: (r) => `${angka(r.bobot)}%` },
              {
                key: 'capaian',
                header: 'Capaian',
                value: (r) => r.capaian,
                render: (r) => (
                  <span
                    className={`font-bold ${
                      r.capaian >= 100 ? 'text-[#137333]' : r.capaian >= 80 ? 'text-[#1d4ed8]' : 'text-[#b45309]'
                    }`}
                  >
                    {angka(r.capaian)}%
                  </span>
                ),
              },
              { key: 'status', header: 'Status', value: (r) => r.status },
            ]}
          />

          {/* Indikator harian: entri yang dicatat karyawan setiap hari. */}
          <h2 className="text-xs font-extrabold text-[#0f172a] mt-5 mb-2">Indikator Harian</h2>
          <DataTable
            rows={data.indikatorHarian}
            rowKey={(r) => r.id}
            searchPlaceholder="Cari indikator atau tanggal…"
            itemLabel="entri"
            emptyMessage="Belum ada indikator harian yang dicatat."
            columns={[
              { key: 'tanggal', header: 'Tanggal', value: (r) => r.tanggal },
              { key: 'indikator', header: 'Indikator', value: (r) => r.indikator },
              {
                key: 'nilai',
                header: 'Target / Aktual',
                value: (r) => `${r.target} / ${r.aktual}`,
                render: (r) => (
                  <span>
                    {angka(r.target)} / {angka(r.aktual)} <span className="text-[#64748b]">{r.satuan}</span>
                  </span>
                ),
              },
              { key: 'status', header: 'Status', value: (r) => r.status },
            ]}
          />

          {/* Riwayat penilaian periode sebelumnya. */}
          <h2 className="text-xs font-extrabold text-[#0f172a] mt-5 mb-2">Riwayat Penilaian</h2>
          <DataTable
            rows={data.riwayatPenilaian}
            rowKey={(r) => r.periode}
            searchPlaceholder="Cari periode…"
            itemLabel="periode"
            emptyMessage="Belum ada riwayat penilaian untuk pegawai ini."
            columns={[
              { key: 'periode', header: 'Periode', value: (r) => r.periode },
              { key: 'gpa', header: 'Nilai Kinerja (GPA)', value: (r) => r.gpa, render: (r) => angka(r.gpa) },
              { key: 'total', header: 'Total Skor', value: (r) => r.total, render: (r) => `${angka(r.total)}%` },
              { key: 'rating', header: 'Peringkat', value: (r) => r.rating },
            ]}
          />
        </div>
      )}

      {tab === 'kontribusi' && (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <h2 className="text-xs font-extrabold text-[#0f172a] mb-2">Kontribusi per Pilar BSC</h2>
          {!data.kontribusi || !data.kontribusi.hasKpi ? (
            <p className="text-[11px] text-[#64748b] bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg p-3">
              Pegawai ini belum memiliki KPI, sehingga kontribusi per pilar belum dapat dihitung.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 mb-3 text-[11px]">
                <span className="text-[#64748b]">
                  Nilai kinerja terakhir:{' '}
                  <strong className="text-[#0f172a]">{data.kontribusi.latestGpa ?? '—'}</strong>
                </span>
                <span className="text-[#64748b]">
                  Peringkat: <strong className="text-[#0f172a]">{data.kontribusi.latestRating ?? '—'}</strong>
                </span>
              </div>
              <DataTable
                rows={data.kontribusi.pillars}
                rowKey={(r) => r.pillarId}
                searchPlaceholder="Cari pilar atau perspektif…"
                itemLabel="pilar"
                emptyMessage="Belum ada kontribusi pilar."
                columns={[
                  { key: 'pilar', header: 'Pilar Strategis', value: (r) => r.pillarName },
                  { key: 'perspektif', header: 'Perspektif', value: (r) => r.perspective },
                  { key: 'bobot', header: 'Bobot Strategis', value: (r) => r.strategicWeight, render: (r) => `${angka(r.strategicWeight)}%` },
                  { key: 'kpi', header: 'Jumlah KPI', value: (r) => r.kpiCount },
                  {
                    key: 'capaian',
                    header: 'Capaian',
                    value: (r) => r.achievementPercentage,
                    render: (r) => (
                      <span className={r.achievementPercentage >= 100 ? 'font-bold text-[#137333]' : 'font-bold text-[#b45309]'}>
                        {angka(r.achievementPercentage)}%
                      </span>
                    ),
                  },
                ]}
              />
            </>
          )}
        </div>
      )}

      {tab === 'kehadiran' && (        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <h2 className="text-xs font-extrabold text-[#0f172a] mb-2">Catatan Kehadiran (30 terakhir)</h2>
          <DataTable
            rows={data.kehadiran}
            rowKey={(r) => r.tanggal}
            searchPlaceholder="Cari tanggal…"
            itemLabel="hari"
            emptyMessage="Belum ada catatan kehadiran."
            columns={[
              { key: 'tanggal', header: 'Tanggal', value: (r) => r.tanggal },
              {
                key: 'hadir',
                header: 'Kehadiran',
                value: (r) => (r.hadir ? 'Hadir' : 'Tidak hadir'),
                render: (r) => (
                  <span className={r.hadir ? 'text-[#137333] font-semibold' : 'text-[#c5221f] font-semibold'}>
                    {r.hadir ? 'Hadir' : 'Tidak hadir'}
                  </span>
                ),
              },
              { key: 'jam', header: 'Jam kerja', value: (r) => r.jamKerja, render: (r) => `${angka(r.jamKerja)} jam` },
              { key: 'lembur', header: 'Jam lembur', value: (r) => r.jamLembur, render: (r) => `${angka(r.jamLembur)} jam` },
            ]}
          />
        </div>
      )}

      {tab === 'lainnya' && (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <h2 className="text-xs font-extrabold text-[#0f172a] mb-2">Jaminan Sosial (BPJS)</h2>
          {data.bpjs.length === 0 ? (
            <p className="text-[11px] text-[#64748b] bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg p-3">
              Belum ada data BPJS untuk pegawai ini.
            </p>
          ) : (
            data.bpjs.map((b, i) => (
              <div key={i}>
                <Baris label="Nomor BPJS Ketenagakerjaan" nilai={b.nomorTk} />
                <Baris label="Nomor BPJS Kesehatan" nilai={b.nomorKes} />
                <Baris label="Kelas" nilai={b.kelas} />
                <Baris label="Status TK" nilai={b.statusTk} />
                <Baris label="Status Kesehatan" nilai={b.statusKes} />
                <Baris label="Terdaftar sejak" nilai={b.terdaftar} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
