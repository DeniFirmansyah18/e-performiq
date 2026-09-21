'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
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
} from 'lucide-react';

export default function AuditGovernancePage() {
  const { auditLogs } = useApp();
  const { currentUser } = useAuth();

  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.actionType === filterAction;
    const matchesQuery =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesQuery;
  });

  const tarifPrinciples = [
    {
      code: 'T',
      name: 'Transparency (Keterbukaan)',
      desc: 'Pohon cascading KPI dan rumus composite GPA (50/20/15/15) dapat diakses transparan oleh setiap karyawan.',
      score: '100%',
      status: 'TERVERIFIKASI',
    },
    {
      code: 'A',
      name: 'Accountability (Akuntabilitas)',
      desc: 'Pengesahan nilai akhir melalui Komite Kalibrasi Kinerja multi-pihak dengan log jejak waktu otomatis.',
      score: '100%',
      status: 'TERVERIFIKASI',
    },
    {
      code: 'R',
      name: 'Responsibility (Pertanggungjawaban)',
      desc: 'Kepatuhan mutlak regulasi ketenagakerjaan PP 35/2021, DPLK, dan standar audit ISO 30414:2019.',
      score: '100%',
      status: 'TERVERIFIKASI',
    },
    {
      code: 'I',
      name: 'Independency (Kemandirian)',
      desc: 'Akses pengawasan Satuan Pengawas Internal (SPI) bersifat read-only terpisah tanpa intervensi operasional.',
      score: '100%',
      status: 'TERVERIFIKASI',
    },
    {
      code: 'F',
      name: 'Fairness (Kesetaraan & Keadilan)',
      desc: 'Ulasan 360 multi-rater terenkripsi tanpa bias hierarki jabatan dan kurva distribusi normal anti-inflasi.',
      score: '100%',
      status: 'TERVERIFIKASI',
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-400">
              Satuan Pengawas Internal (SPI)
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Immutable GCG Audit Engine
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1.5">
            Prinsip TARIF & Jejak Audit Anti-Manipulasi
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pengawasan independen terhadap keabsahan data penilaian kinerja, transaksi pesangon, dan kepatuhan regulasi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-950/40 text-amber-400 border border-amber-500/30">
            <Fingerprint className="h-4 w-4" />
            <span>Anti-Tamper SHA-256 Active</span>
          </div>
        </div>
      </div>

      {/* GCG TARIF Principles Matrix */}
      <div className="stitch-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-amber-400" />
              Kepatuhan 5 Prinsip Tata Kelola Perusahaan yang Baik (TARIF)
            </h2>
            <p className="text-xs text-slate-400">
              PRD Section 1.2 & 6.2: Evaluasi tata kelola sesuai pedoman Komite Nasional Kebijakan Governance (KNKG)
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400">
            Nilai Kepatuhan: 1.00 (Optimal)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {tarifPrinciples.map((tp) => (
            <div
              key={tp.code}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-2"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs font-mono">
                    {tp.code}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 font-mono">
                    {tp.score}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-white mt-2 leading-tight">
                  {tp.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {tp.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-850 flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>{tp.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Immutable Audit Trail Table */}
      <div className="stitch-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-purple-400" />
              Immutable Audit Log Trail (PRD Table 18)
            </h2>
            <p className="text-xs text-slate-400">
              Seluruh mutasi data KPI, kalibrasi nilai, dan pencairan kompensasi terenkripsi permanen
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari aktor, entitas, kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter Action */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">Semua Aksi</option>
              <option value="CALIBRATE">CALIBRATE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="DISBURSE">DISBURSE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="CREATE">CREATE</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Waktu (UTC)</th>
                <th className="py-3 px-4">Aktor Pengguna</th>
                <th className="py-3 px-4">Role Hak Akses</th>
                <th className="py-3 px-4 text-center">Tipe Aksi</th>
                <th className="py-3 px-4">Entitas Terkait</th>
                <th className="py-3 px-4">Deskripsi Perubahan Data</th>
                <th className="py-3 px-4 text-right">Data Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                        {log.userName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {log.userRole}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.actionType === 'CALIBRATE'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : log.actionType === 'DISBURSE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : log.actionType === 'APPROVE'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {log.entityName}
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs max-w-sm">
                        {log.description}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(log.oldData || log.newData) ? (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300"
                          >
                            <FileCode2 className="h-3.5 w-3.5" />
                            {isExpanded ? 'Tutup' : 'Lihat Diff'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Expandable JSON Diff Row */}
                    {isExpanded && (
                      <tr className="bg-slate-950/80">
                        <td colSpan={7} className="p-4">
                          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                            <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/20">
                              <span className="text-[10px] font-bold text-rose-400 block mb-1">
                                &minus; Old State Snapshot:
                              </span>
                              <pre className="text-slate-300 whitespace-pre-wrap text-[11px]">
                                {JSON.stringify(log.oldData, null, 2) || 'N/A'}
                              </pre>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/20">
                              <span className="text-[10px] font-bold text-emerald-400 block mb-1">
                                + New State Snapshot:
                              </span>
                              <pre className="text-slate-300 whitespace-pre-wrap text-[11px]">
                                {JSON.stringify(log.newData, null, 2) || 'N/A'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
