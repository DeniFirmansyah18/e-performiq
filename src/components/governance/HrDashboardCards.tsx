'use client';

import React, { useEffect, useState } from 'react';
import { Users, Briefcase, GraduationCap, Clock, Wallet, TrendingUp, LogOut, Sparkles } from 'lucide-react';

interface HrDashboard {
  workforce: { total: number; permanent: number; probation: number; contract: number; resigned: number };
  recruitment: { openPostings: number; totalApplications: number; inReview: number; accepted: number; rejected: number; talentPool: number; avgAtsScore: number | null };
  onboarding: { activePrograms: number; completedPrograms: number; certificatesIssued: number };
  attendance: { openLogsToday: number; closedLogsToday: number; pendingTimesheets: number; overtimeHoursThisMonth: number };
  payroll: { latestPeriod: string | null; latestStatus: string | null; latestTotalNet: number | null; totalRuns: number };
  learning: { totalCourses: number; enrollments: number; completions: number; completionRate: number };
  postEmployment: { activeOffboardings: number; knowledgeHandoversPending: number; severancesPending: number; totalLifetimeContributions: number };
}
interface PostEmployment {
  offboardings: Array<{ id: string; employeeName: string; department: string; lastWorkingDay: string; status: string; isRegrettableAttrition: boolean; severanceTotal: number | null; isSeverancePaid: boolean | null }>;
  leave: { pending: number; approvedThisYear: number; daysApprovedThisYear: number };
  lifetimeContributions: { total: number; byType: Record<string, number> };
}

const idr = (n: number | null) => (n == null ? '–' : 'Rp ' + Math.round(n).toLocaleString('id-ID'));

function Card({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="p-4 rounded-2xl border border-[#e2e8f0] bg-white">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{label}</span>
      </div>
      <p className="mt-2 text-xl font-black text-[#0f172a]">{value}</p>
      {sub && <p className="text-[10px] text-[#64748b] mt-0.5">{sub}</p>}
    </div>
  );
}

/** Kartu ringkasan dashboard HR (WS-11) — agregasi lintas-modul + pasca-kerja. */
export default function HrDashboardCards() {
  const [dash, setDash] = useState<HrDashboard | null>(null);
  const [pe, setPe] = useState<PostEmployment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/dashboard/hr').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.data) setDash(j.data); }).catch(() => {});
    fetch('/api/v1/dashboard/post-employment').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.data) setPe(j.data); }).catch(() => {});
  }, []);

  if (err) return <div className="stitch-card-white p-6 text-xs text-rose-600">{err}</div>;
  if (!dash) return <div className="stitch-card-white p-6 text-xs text-[#64748b]">Memuat ringkasan…</div>;

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-[#007a5a]" />
          <h2 className="text-base font-extrabold text-[#0f172a]">Ringkasan SDM &amp; Pasca-Kerja</h2>
        </div>
        <span className="text-[10px] text-[#94a3b8]">{new Date(dash.workforce ? Date.now() : Date.now()).toLocaleString('id-ID')}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={<Users className="h-3.5 w-3.5 text-white" />} label="Tenaga Kerja" accent="bg-[#0f172a]"
          value={dash.workforce.total} sub={`${dash.workforce.permanent} tetap · ${dash.workforce.probation} probasi`} />
        <Card icon={<Briefcase className="h-3.5 w-3.5 text-white" />} label="Rekrutmen" accent="bg-[#007a5a]"
          value={dash.recruitment.totalApplications} sub={`${dash.recruitment.openPostings} lowongan · ${dash.recruitment.inReview} diproses`} />
        <Card icon={<GraduationCap className="h-3.5 w-3.5 text-white" />} label="Onboarding" accent="bg-indigo-600"
          value={dash.onboarding.activePrograms} sub={`${dash.onboarding.completedPrograms} selesai · ${dash.onboarding.certificatesIssued} sertifikat`} />
        <Card icon={<Clock className="h-3.5 w-3.5 text-white" />} label="Absensi Hari Ini" accent="bg-amber-500"
          value={`${dash.attendance.closedLogsToday + dash.attendance.openLogsToday}`} sub={`${dash.attendance.pendingTimesheets} timesheet menunggu · ${dash.attendance.overtimeHoursThisMonth} jam lembur`} />
        <Card icon={<Wallet className="h-3.5 w-3.5 text-white" />} label="Payroll Terakhir" accent="bg-emerald-600"
          value={idr(dash.payroll.latestTotalNet)} sub={`${dash.payroll.latestPeriod ?? '–'} · ${dash.payroll.latestStatus ?? '–'}`} />
        <Card icon={<TrendingUp className="h-3.5 w-3.5 text-white" />} label="Pembelajaran" accent="bg-sky-600"
          value={`${dash.learning.completionRate}%`} sub={`${dash.learning.completions}/${dash.learning.enrollments} kursus selesai`} />
        <Card icon={<LogOut className="h-3.5 w-3.5 text-white" />} label="Pasca-Kerja" accent="bg-rose-500"
          value={dash.postEmployment.activeOffboardings} sub={`${dash.postEmployment.knowledgeHandoversPending} serah terima · ${dash.postEmployment.severancesPending} pesangon`} />
        <Card icon={<Sparkles className="h-3.5 w-3.5 text-white" />} label="Skor ATS Rata-rata" accent="bg-violet-600"
          value={dash.recruitment.avgAtsScore != null ? dash.recruitment.avgAtsScore.toFixed(0) : '–'} sub={`${dash.recruitment.accepted} diterima · ${dash.recruitment.talentPool} talent pool`} />
      </div>

      {pe && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 border-t border-[#f1f5f9] pt-3">
          <div>
            <p className="text-[11px] font-bold text-[#334155] mb-2">Exit Clearance &amp; Offboarding</p>
            {pe.offboardings.length === 0 ? (
              <p className="text-[11px] text-[#64748b]">Tidak ada proses offboarding aktif.</p>
            ) : (
              <div className="space-y-1.5">
                {pe.offboardings.slice(0, 4).map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[#e2e8f0] text-[11px]">
                    <div>
                      <p className="font-semibold text-[#0f172a]">{o.employeeName}</p>
                      <span className="text-[10px] text-[#64748b]">{o.department} · LWD {o.lastWorkingDay.slice(0, 10)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">{o.status}</span>
                      <p className="text-[10px] text-[#64748b] mt-0.5">{idr(o.severanceTotal)}{o.isSeverancePaid ? ' · dibayar' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#334155] mb-2">Cuti &amp; Warisan Kontribusi (LCI)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-center">
                <p className="text-[10px] text-[#64748b]">Cuti Menunggu</p>
                <p className="text-lg font-black text-[#0f172a]">{pe.leave.pending}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-center">
                <p className="text-[10px] text-[#64748b]">Hari Cuti Disetujui</p>
                <p className="text-lg font-black text-[#0f172a]">{pe.leave.daysApprovedThisYear}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-center">
                <p className="text-[10px] text-[#64748b]">Total Kontribusi</p>
                <p className="text-lg font-black text-[#0f172a]">{pe.lifetimeContributions.total}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
