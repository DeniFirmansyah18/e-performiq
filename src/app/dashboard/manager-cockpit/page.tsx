'use client';

import React, { useState } from 'react';
import {
  Download,
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Star,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function ManagerCockpitPage() {
  const [filterType, setFilterType] = useState<'all' | 'ready' | 'attention'>('all');
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const handleApproveAll = async () => {
    setIsApproving(true);
    setApprovalMsg(null);
    try {
      const res = await fetch('/api/v1/performance/individual-kpis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpi_id: 'f0000000-0000-4000-8000-000000000001',
          action: 'APPROVE',
        }),
      });
      if (res.ok) {
        setApprovalMsg('Persetujuan KPI tim Engineering berhasil disahkan & tersimpan ke PostgreSQL audit trail.');
      } else {
        const json = await res.json();
        setApprovalMsg(json.detail || 'Gagal menyetujui KPI tim.');
      }
    } catch {
      setApprovalMsg('Terjadi kesalahan koneksi.');
    } finally {
      setIsApproving(false);
    }
  };

  const teamRoster = [
    {
      name: 'Budi Pratama',
      nip: 'NIP: ENG-8821',
      role: 'Senior Systems Architect',
      pillar: 'Internal Tech & Scalability',
      kpi: '96.8%',
      kpiNote: '+4.8% SLA 99.98%',
      kpiColor: 'text-[#007a5a]',
      sopInsidents: '0 Insiden',
      rating360: '4.8',
      reviewsCount: '12 Ulasan',
      gpa: '3.67',
      box: 'Kuadran 1',
      boxName: 'Future Leader / High Potential',
      status: 'Siap Kalibrasi',
      statusType: 'ready',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    },
    {
      name: 'Siti Rahmawati',
      nip: 'NIP: PROD-4019',
      role: 'Product Lead (Digital Governance)',
      pillar: 'Customer & Adoption Matrix',
      kpi: '98.2%',
      kpiNote: 'OKR Tercapai Penuh',
      kpiColor: 'text-[#007a5a]',
      sopInsidents: '0 Insiden',
      rating360: '4.9',
      reviewsCount: '16 Ulasan',
      gpa: '3.75',
      box: 'Kuadran 2',
      boxName: 'Growth Star / Top Talent',
      status: 'Siap Kalibrasi',
      statusType: 'ready',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100',
    },
    {
      name: 'Andika Wijaya',
      nip: 'NIP: OPS-7124',
      role: 'Ops & Infrastructure Specialist',
      pillar: 'Infrastructure SLA & Uptime',
      kpi: '82.5%',
      kpiNote: '-7.5% di bawah Target',
      kpiColor: 'text-[#dc2626]',
      sopInsidents: '1 Tiket SLA',
      sopAlert: true,
      rating360: '3.8',
      reviewsCount: '8 Ulasan',
      gpa: '3.20',
      box: 'Kuadran 5',
      boxName: 'Core Player / Steady Performer',
      status: 'Butuh Justifikasi',
      statusType: 'attention',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100',
    },
    {
      name: 'Dian Safitri',
      nip: 'NIP: QA-6228',
      role: 'QA Engineering Lead',
      pillar: 'Zero Defect Governance',
      kpi: '94.0%',
      kpiNote: 'Sesuai Kuota Q3',
      kpiColor: 'text-[#007a5a]',
      sopInsidents: '0 Insiden',
      rating360: '4.6',
      reviewsCount: '10 Ulasan',
      gpa: '3.55',
      box: 'Kuadran 3',
      boxName: 'High Professional Expert',
      status: 'Siap Kalibrasi',
      statusType: 'ready',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
    },
    {
      name: 'Rizky Pratama',
      nip: 'NIP: ENG-9903',
      role: 'Jr. Cloud Engineer',
      isProbation: true,
      pillar: 'Foundational Onboarding',
      kpi: '89.0%',
      kpiNote: 'Milestone 60 Hari',
      kpiColor: 'text-[#334155]',
      sopInsidents: '0 Insiden',
      rating360: '4.2',
      reviewsCount: '6 Ulasan',
      gpa: '3.40',
      box: 'Probation',
      boxName: 'Penilaian Tahap 2 Diperlukan',
      status: 'Review 60-Hari',
      statusType: 'review',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb Context */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-1.5">
            <span className="font-bold uppercase tracking-wider text-[#64748b]">
              Division Workspace
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
              Siklus Aktif
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
            Tim Operasional & Engineering <span className="text-[#64748b] font-normal text-xl">(14 Anggota Langsung)</span>
          </h1>

          <p className="text-xs text-[#64748b] mt-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#94a3b8]" />
            <span>Evaluasi Q3 Berjalan &mdash; <strong>Sisa Waktu 6 Hari Kerja</strong> (Batas Kalibrasi: 30 September 2026)</span>
          </p>
        </div>

        {/* Right Buttons */}
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc]">
            <Download className="h-3.5 w-3.5 text-[#64748b]" />
            <span>Ekspor Rekapitulasi</span>
          </button>

          <button
            onClick={handleApproveAll}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5 text-white" />
            <span>{isApproving ? 'Menyetujui...' : 'Approve Semua Nilai Tim'}</span>
          </button>
        </div>
      </div>

      {/* Approval Status Alert */}
      {approvalMsg && (
        <div className="p-3 rounded-xl bg-[#e6f4ea] border border-[#b7e1cd] text-xs font-semibold text-[#137333] flex items-center justify-between">
          <span>{approvalMsg}</span>
          <button onClick={() => setApprovalMsg(null)} className="text-[#137333] hover:underline font-bold">Tutup</button>
        </div>
      )}

      {/* 2. Four Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Rata-Rata Skor Tim
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              +0.18 vs Q2
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              91.2%
            </span>
            <span className="text-sm font-semibold text-[#64748b] ml-1">
              (GPA 3.65)
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#007a5a]" />
            <span className="text-xs text-[#334155] font-semibold">Tier A- (Sangat Baik)</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Cascaded KPI Achievement
            </span>
            <span className="text-[11px] font-bold text-[#0369a1] bg-[#e0f2fe] px-1.5 py-0.5 rounded">
              94.1% Bobot
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              13/14
            </span>
            <span className="text-xs text-[#64748b] ml-2">Individu di atas target</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#0284c7]" />
            <span className="text-xs text-[#334155] font-semibold">On-Track Strategy</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              SOP Adherence Index
            </span>
            <span className="text-[11px] font-bold text-[#c5221f] bg-[#fce8e6] px-1.5 py-0.5 rounded">
              1 Alert
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              98.4%
            </span>
            <span className="text-xs text-[#64748b] ml-2">Zero Major Breach</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#007a5a]" />
            <span className="text-xs text-[#334155] font-semibold">GCG Compliance</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              360 Feedback Status
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              100% Selesai
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              42/42
            </span>
            <span className="text-xs text-[#64748b] ml-2">Ulasan Diterima</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#007a5a]" />
            <span className="text-xs text-[#334155] font-semibold">Siap Verifikasi</span>
          </div>
        </div>

      </div>

      {/* 3. Team Member Assessment & Goal Cascading Table */}
      <div className="stitch-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#0f172a]">
              Team Member Assessment & Goal Cascading
            </h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              Penilaian performa komprehensif, penyelarasan KPI Balanced Scorecard, dan kalibrasi kuadran 9-box talent matrix.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center rounded-lg bg-[#f1f5f9] p-0.5 text-xs font-semibold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-md transition-all ${filterType === 'all' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
              >
                Semua (14)
              </button>
              <button
                onClick={() => setFilterType('ready')}
                className={`px-3 py-1 rounded-md transition-all ${filterType === 'ready' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
              >
                Siap Review (8)
              </button>
              <button
                onClick={() => setFilterType('attention')}
                className={`px-3 py-1 rounded-md transition-all ${filterType === 'attention' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
              >
                Perlu Atensi (2)
              </button>
            </div>

            {/* Pillar Dropdown */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] hover:bg-[#f8fafc]">
              <Filter className="h-3 w-3 text-[#64748b]" />
              <span>Semua Pilar BSC</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#e2e8f0] text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
              <tr>
                <th className="py-2.5 px-3">Anggota Tim (Direct Report)</th>
                <th className="py-2.5 px-3">Pilar Strategis BSC</th>
                <th className="py-2.5 px-3 text-center">KPI Selesai (%)</th>
                <th className="py-2.5 px-3 text-center">Insiden SOP</th>
                <th className="py-2.5 px-3 text-center">360 Peer Review</th>
                <th className="py-2.5 px-3 text-center">Prediksi GPA & 9-Box</th>
                <th className="py-2.5 px-3 text-right">Status Kalibrasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {teamRoster
                .filter((r) => {
                  if (filterType === 'ready') return r.statusType === 'ready';
                  if (filterType === 'attention') return r.statusType === 'attention';
                  return true;
                })
                .map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                    {/* Column 1: Member */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={row.avatar}
                          alt={row.name}
                          className="h-9 w-9 rounded-full object-cover border border-[#e2e8f0]"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#0f172a]">{row.name}</span>
                            {row.isProbation && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#e0f2fe] text-[#0369a1]">
                                Probation
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#64748b]">
                            {row.nip} &bull; {row.role}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: BSC Pillar */}
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-1 rounded-md bg-[#f1f5f9] text-[#334155] font-medium text-[11px]">
                        {row.pillar}
                      </span>
                    </td>

                    {/* Column 3: KPI Selesai */}
                    <td className="py-3 px-3 text-center">
                      <span className={`font-bold font-mono text-xs ${row.kpiColor}`}>{row.kpi}</span>
                      <p className="text-[10px] text-[#64748b]">{row.kpiNote}</p>
                    </td>

                    {/* Column 4: SOP */}
                    <td className="py-3 px-3 text-center">
                      {row.sopAlert ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c5221f] bg-[#fce8e6] px-2 py-0.5 rounded">
                          <AlertTriangle className="h-3 w-3" />
                          {row.sopInsidents}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {row.sopInsidents}
                        </span>
                      )}
                    </td>

                    {/* Column 5: 360 Review */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-xs">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-[#0f172a]">{row.rating360}</span>
                        <span className="text-[10px] text-[#64748b]">({row.reviewsCount})</span>
                      </div>
                    </td>

                    {/* Column 6: GPA & 9-Box */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-black text-[#0f172a] font-mono">{row.gpa}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1]">
                          {row.box}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748b] mt-0.5">{row.boxName}</p>
                    </td>

                    {/* Column 7: Status */}
                    <td className="py-3 px-3 text-right">
                      {row.statusType === 'ready' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
                          {row.status}
                        </span>
                      )}
                      {row.statusType === 'attention' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c5221f] bg-[#fce8e6] px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#c5221f]" />
                          {row.status}
                        </span>
                      )}
                      {row.statusType === 'review' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#0369a1]" />
                          {row.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#f1f5f9] text-xs text-[#64748b]">
          <span>Menampilkan 5 dari 14 bawahan langsung dalam cakupan evaluasi People Manager</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg border border-[#cbd5e1] text-xs hover:bg-[#f8fafc]">Sebelumnya</button>
            <button className="px-3 py-1 rounded-lg border border-[#cbd5e1] text-xs hover:bg-[#f8fafc]">Selanjutnya</button>
          </div>
        </div>
      </div>

      {/* 4. Tindakan Otorisasi & Tugas Segera (Action Drawer) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-[#0f172a]">
              Tindakan Otorisasi & Tugas Segera (Action Drawer)
            </h2>
          </div>
          <span className="text-xs text-[#64748b]">
            3 Item Memerlukan Tanda Tangan Manajerial
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Action 1: SOP Verification */}
          <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#c5221f] bg-[#fce8e6] px-2 py-0.5 rounded">
                  SLA Breached Exception
                </span>
                <span className="text-[11px] text-[#64748b]">2 Jam Lalu</span>
              </div>

              <h3 className="text-sm font-bold text-[#0f172a]">
                SOP & SLA Verification Needed
              </h3>

              <p className="text-xs text-[#64748b] leading-relaxed">
                Tiket keterlambatan SLA resolusi insiden produksi (#INC-8921) oleh <strong>Andika Wijaya</strong> memerlukan verifikasi log data center dan justifikasi manajerial sebelum nilai SOP dikalibrasi ke sistem GCG.
              </p>
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-xs text-[#64748b] hover:underline cursor-pointer">Lihat Log Bukti</span>
              <button className="px-3.5 py-1.5 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold shadow-xs">
                Review Justifikasi
              </button>
            </div>
          </div>

          {/* Action 2: 30-60-90 Days Review */}
          <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded">
                  Probation Milestone
                </span>
                <span className="text-[11px] text-[#64748b]">Jatuh Tempo: 2 Hari</span>
              </div>

              <h3 className="text-sm font-bold text-[#0f172a]">
                30-60-90 Days Probation Review
              </h3>

              <p className="text-xs text-[#64748b] leading-relaxed">
                <strong>Rizky Pratama</strong> (Jr. Cloud Engineer) telah memasuki Hari ke-60 masa percobaan. Peer review tim infrastruktur sudah lengkap (Skor 4.2/5.0).
              </p>
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-xs text-[#64748b] hover:underline cursor-pointer">Buku Catatan Mentor</span>
              <button className="px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs">
                Beri Nilai Evaluasi Tahap 2
              </button>
            </div>
          </div>

          {/* Action 3: Cascading KPI Sign-off */}
          <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded">
                  Balanced Scorecard
                </span>
                <span className="text-[11px] text-[#64748b]">Perencanaan Q4</span>
              </div>

              <h3 className="text-sm font-bold text-[#0f172a]">
                Cascading KPI Sign-off: Target Q4-2026
              </h3>

              <p className="text-xs text-[#64748b] leading-relaxed">
                2 usulan metrik KPI individu baru diajukan oleh Tim Arsitektur Sistem (termasuk efisiensi konsumsi cloud compute) membutuhkan otorisasi keselarasan pilar BSC divisi.
              </p>
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-xs text-[#64748b] hover:underline cursor-pointer">Lihat Matriks Bobot</span>
              <button className="px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs">
                Otorisasi KPI Tim
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
