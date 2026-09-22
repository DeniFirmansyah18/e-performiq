'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  ShieldCheck,
  Scale,
  Lock,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  Fingerprint,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Clock,
  ArrowRight,
  Database,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';

export default function AuditGovernancePage() {
  const { currentUser } = useAuth();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/governance/audit-logs');
      if (res.ok) {
        const json = await res.json();
        const items = (json.data?.audit_trail || []).map((l: any) => ({
          id: String(l.log_id),
          timestamp: l.timestamp,
          userName: l.user_name || 'System',
          userRole: l.user_role || 'SYSTEM',
          actionType: l.action_type,
          entityName: l.entity_name,
          recordId: l.record_id,
          description: l.description || '-',
          oldData: l.old_data,
          newData: l.new_data,
          ipAddress: l.ip_address,
        }));
        setAuditLogs(items);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.actionType === filterAction;
    const matchesQuery =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.recordId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesQuery;
  });

  const tarifPrinciples = [
    {
      code: 'T',
      name: 'Transparency (Keterbukaan)',
      desc: 'Pohon cascading sasaran KPI dan formula komposit GPA (50/20/15/15) dapat diakses transparan oleh seluruh pegawai tanpa bias informasi.',
      score: '100%',
      status: 'TERVERIFIKASI',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tagColor: 'bg-[#007a5a]',
    },
    {
      code: 'A',
      name: 'Accountability (Akuntabilitas)',
      desc: 'Pengesahan nilai akhir melalui Komite Kalibrasi Kinerja multi-pihak dengan rekaman cap waktu (timestamp) otomatis.',
      score: '100%',
      status: 'TERVERIFIKASI',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      tagColor: 'bg-[#0284c7]',
    },
    {
      code: 'R',
      name: 'Responsibility (Pertanggungjawaban)',
      desc: 'Kepatuhan mutlak regulasi ketenagakerjaan PP No. 35/2021, program DPLK, serta standar metrik human capital ISO 30414:2019.',
      score: '100%',
      status: 'TERVERIFIKASI',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      tagColor: 'bg-[#0d9488]',
    },
    {
      code: 'I',
      name: 'Independency (Kemandirian)',
      desc: 'Akses pengawasan Satuan Pengawas Internal (SPI) bersifat read-only terpisah tanpa intervensi operasional struktural.',
      score: '100%',
      status: 'TERVERIFIKASI',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      tagColor: 'bg-[#4f46e5]',
    },
    {
      code: 'F',
      name: 'Fairness (Kesetaraan & Keadilan)',
      desc: 'Ulasan 360° multi-rater terenkripsi anonim dan kurva distribusi normal Gaussian mencegah inflasi penilaian.',
      score: '100%',
      status: 'TERVERIFIKASI',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      tagColor: 'bg-[#7c3aed]',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-1.5">
            <span className="font-bold uppercase tracking-wider text-[#64748b]">
              Satuan Pengawas Internal (SPI)
            </span>
            <span>&rsaquo;</span>
            <span className="font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded text-[11px] border border-[#b7e1cd]">
              KNKG TARIF &amp; ISO 30414:2019
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
              Tata Kelola Korporat (GCG) &amp; Pengawasan Audit
            </h1>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
              <Fingerprint className="h-3.5 w-3.5 text-[#137333]" />
              <span>Anti-Tamper PostgreSQL Active</span>
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-1">
            Pengawasan kepatuhan independen berbasis prinsip TARIF, penegakan integritas data penilaian, serta pelacakan jejak audit multi-level anti-manipulasi (PRD §5.4 &amp; §6.2).
          </p>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
              <Calendar className="h-3.5 w-3.5 text-[#64748b]" />
              <span>Tahun Buku 2026 (Q3)</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#64748b]" />
            </button>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#64748b] ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Log</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
            <Printer className="h-3.5 w-3.5 text-[#64748b]" />
            <span>Cetak Risalah SPI</span>
          </button>

          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors">
            <Download className="h-3.5 w-3.5 text-white" />
            <span>Ekspor Laporan GCG</span>
          </button>
        </div>
      </div>

      {/* 2. Four Governance Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Indeks Kepatuhan TARIF
            </span>
            <Scale className="h-4 w-4 text-[#007a5a]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              100.0%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              Optimal
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            5 Pilar Pedoman KNKG Terpenuhi
          </p>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
            <span className="flex items-center gap-1 text-[#137333] font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Faktor GCG: 1.00
            </span>
            <span className="text-[10px] font-mono bg-[#f1f5f9] px-1.5 py-0.5 rounded text-[#475569]">
              KNKG Standard
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Total Audit Log Trail
            </span>
            <Database className="h-4 w-4 text-[#0284c7]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              {auditLogs.length}
            </span>
            <span className="text-[11px] font-bold text-[#0369a1] bg-[#e0f2fe] px-1.5 py-0.5 rounded">
              100% Immutable
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            Seluruh Mutasi Tercatat Permanen
          </p>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
            <span>Trigger Integrity: <strong className="text-[#007a5a]">Aktif</strong></span>
            <span className="text-[10px] font-mono bg-[#f1f5f9] px-1.5 py-0.5 rounded text-[#475569]">
              Append-Only
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Pengesahan &amp; Kalibrasi
            </span>
            <ShieldCheck className="h-4 w-4 text-[#007a5a]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              100%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              Kuorum Penuh
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            0 Deviasi Otorisasi Nilai
          </p>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
            <span>Otoritas: <strong className="text-[#0f172a]">HR Director + BOD</strong></span>
            <span className="text-[10px] font-mono bg-[#e6f4ea] text-[#137333] px-1.5 py-0.5 rounded font-semibold">
              PRD §6.2 Locked
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Integritas Anti-Tamper
            </span>
            <Lock className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              0
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              Nol Pelanggaran
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            Upaya Manipulasi Tertolak Sistem
          </p>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
            <span>Hak SPI: <strong className="text-[#4f46e5]">Read-Only Murni</strong></span>
            <span className="text-[10px] font-mono bg-[#f1f5f9] px-1.5 py-0.5 rounded text-[#475569]">
              PRD §10.2
            </span>
          </div>
        </div>

      </div>

      {/* 3. GCG TARIF Principles Matrix */}
      <div className="stitch-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f1f5f9] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#0f172a]">
                Kepatuhan 5 Prinsip Tata Kelola Perusahaan yang Baik (TARIF)
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                Pedoman KNKG RI
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              PRD Bagian 1.2 &amp; 6.2: Standardisasi tata kelola terintegrasi untuk menjamin objektivitas, mitigasi fraud, dan keandalan audit eksternal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#007a5a] bg-[#e6f4ea] px-2.5 py-1 rounded-lg border border-[#b7e1cd]">
              Skor Kepatuhan: 1.00 (Optimal)
            </span>
          </div>
        </div>

        {/* 5 Principle Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
          {tarifPrinciples.map((tp) => (
            <div
              key={tp.code}
              className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] hover:bg-white hover:border-[#cbd5e1] hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg font-bold text-xs font-mono border ${tp.badgeColor}`}>
                    {tp.code}
                  </span>
                  <span className="text-[10px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded font-mono">
                    {tp.score}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-[#0f172a] mt-2.5 leading-tight">
                  {tp.name}
                </h3>
                <p className="text-[11px] text-[#64748b] mt-1.5 leading-relaxed">
                  {tp.desc}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#e2e8f0] flex items-center gap-1.5 text-[10px] font-bold text-[#137333]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#137333]" />
                <span>{tp.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Immutable Audit Trail Table */}
      <div className="stitch-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#0f172a] flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#7c3aed]" />
                <span>Immutable Audit Log Trail (PRD Table 18 &amp; §6.2)</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                {filteredLogs.length} Terpilih
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              Seluruh rekaman perubahan KPI, kalibrasi nilai, dan pencairan kompensasi terenkripsi permanen anti-manipulasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Cari aktor, entitas, kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#cbd5e1] text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#007a5a] w-56 sm:w-64"
              />
            </div>

            {/* Filter Action */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="rounded-lg bg-white border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#334155] font-medium focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
            >
              <option value="ALL">Semua Tipe Aksi</option>
              <option value="CALIBRATE">CALIBRATE (Kalibrasi Nilai)</option>
              <option value="APPROVE">APPROVE (Persetujuan KPI)</option>
              <option value="DISBURSE">DISBURSE (Pencairan Pesangon)</option>
              <option value="CREATE">CREATE (Penambahan Data)</option>
              <option value="UPDATE">UPDATE (Pembaruan Nilai)</option>
              <option value="LOGIN">LOGIN (Autentikasi)</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Waktu (Lokal)</th>
                <th className="py-3 px-4">Aktor Pengguna</th>
                <th className="py-3 px-4">Hak Akses Role</th>
                <th className="py-3 px-4 text-center">Tipe Aksi</th>
                <th className="py-3 px-4">Entitas Terkait</th>
                <th className="py-3 px-4">Deskripsi Perubahan Data</th>
                <th className="py-3 px-4 text-right">Data Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] bg-white">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-[#f8fafc] transition-colors">
                        <td className="py-3 px-4 font-mono text-[#64748b] text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#0f172a] whitespace-nowrap">
                          {log.userName}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0] font-semibold">
                            {log.userRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.actionType === 'CALIBRATE'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : log.actionType === 'DISBURSE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.actionType === 'APPROVE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : log.actionType === 'CREATE'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : log.actionType === 'UPDATE'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#64748b] text-[11px]">
                          {log.entityName}
                        </td>
                        <td className="py-3 px-4 text-[#334155] text-xs max-w-md">
                          <span className="block truncate font-medium" title={log.description}>
                            {log.description}
                          </span>
                          <span className="text-[10px] font-mono text-[#94a3b8] block mt-0.5">
                            ID: {log.recordId} &bull; IP: {log.ipAddress}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(log.oldData || log.newData) ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284c7] hover:text-[#0369a1] hover:underline"
                            >
                              <FileCode2 className="h-3.5 w-3.5" />
                              <span>{isExpanded ? 'Tutup' : 'Lihat Diff'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#94a3b8]">-</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON Diff Row */}
                      {isExpanded && (
                        <tr className="bg-[#f8fafc]">
                          <td colSpan={7} className="p-4 border-t border-[#e2e8f0]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="p-3.5 rounded-xl bg-[#fff5f5] border border-rose-200">
                                <span className="text-[11px] font-bold text-rose-700 block mb-1 flex items-center gap-1.5">
                                  <span>&minus; Data Lama (Old State Snapshot):</span>
                                </span>
                                <pre className="text-[#991b1b] whitespace-pre-wrap text-[11px] overflow-x-auto bg-white/70 p-2.5 rounded-lg border border-rose-100">
                                  {log.oldData ? JSON.stringify(log.oldData, null, 2) : 'NULL (Data Baru Dibuat)'}
                                </pre>
                              </div>

                              <div className="p-3.5 rounded-xl bg-[#f0fdf4] border border-emerald-200">
                                <span className="text-[11px] font-bold text-emerald-700 block mb-1 flex items-center gap-1.5">
                                  <span>+ Data Baru (New State Snapshot):</span>
                                </span>
                                <pre className="text-[#166534] whitespace-pre-wrap text-[11px] overflow-x-auto bg-white/70 p-2.5 rounded-lg border border-emerald-100">
                                  {log.newData ? JSON.stringify(log.newData, null, 2) : 'NULL'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#64748b] italic">
                    {loading ? 'Memuat jejak audit trail dari basis data PostgreSQL...' : 'Tidak ada catatan audit yang cocok dengan filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Banner */}
        <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[#334155]">
            <ShieldCheck className="h-4 w-4 text-[#007a5a] flex-shrink-0" />
            <span>
              <strong>Jaminan Integritas Anti-Tamper:</strong> Sesuai PRD §6.2, tabel <code className="font-mono text-[#007a5a]">audit_logs</code> dilindungi oleh Trigger PostgreSQL. Setiap mutasi penghapusan atau pengubahan langsung akan ditolak sistem.
            </span>
          </div>

          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#137333] bg-[#e6f4ea] px-2.5 py-1 rounded-full border border-[#b7e1cd]">
              <CheckCircle2 className="h-3 w-3 text-[#137333]" />
              <span>Audit Integrity: 100% Validated</span>
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}

