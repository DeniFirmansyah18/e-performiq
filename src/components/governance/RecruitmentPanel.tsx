'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Sparkles, CheckCircle2, XCircle, Users } from 'lucide-react';
import JobPostingManager from '@/components/governance/JobPostingManager';

interface CandidateRow {
  id: string; applicationNo: string; status: string; appliedAt: string;
  fullName: string; email: string; education?: string; resumeUrl?: string; postingTitle: string;
}

interface ReviewDetail {
  applicationId: string; applicationNo: string; candidateName: string; candidateEmail: string;
  postingTitle: string; department: string; position: string;
  atsScore: number | null; matchedSkills: string[]; missingSkills: string[];
  psychometricScore: number | null; technicalScore: number | null; interviewScore: number | null;
  finalWeightedScore: number | null; overallScore: number | null;
  recommendation: string; topSkills: string[]; education: string | null; experienceYears: number | null;
  decision: string; aiSummary: string | null; decisionNotes: string | null; aiConfigured?: boolean;
}

const STATUSES = ['SUBMITTED', 'SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'];

const RECO_STYLE: Record<string, string> = {
  STRONG_HIRE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HIRE: 'bg-green-50 text-green-700 border-green-200',
  CONSIDER: 'bg-amber-50 text-amber-700 border-amber-200',
  NO_HIRE: 'bg-rose-50 text-rose-700 border-rose-200',
  INSUFFICIENT_DATA: 'bg-slate-50 text-slate-600 border-slate-200',
};
const RECO_LABEL: Record<string, string> = {
  STRONG_HIRE: 'Sangat Direkomendasikan', HIRE: 'Direkomendasikan',
  CONSIDER: 'Perlu Pertimbangan', NO_HIRE: 'Tidak Direkomendasikan', INSUFFICIENT_DATA: 'Data Belum Cukup',
};

/** Panel Rekrutmen Kandidat (HR): daftar pelamar + ubah status + review AI + keputusan. */
export default function RecruitmentPanel() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Modal notifikasi sukses (status / keputusan). Data selalu di-refresh otomatis
  // setelah aksi berhasil agar HR tidak perlu memuat ulang peramban.
  const [success, setSuccess] = useState<{ title: string; body: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/recruitment/candidates');
      if (!res.ok) {
        setErr(res.status === 403 ? 'Anda tidak berwenang melihat data pelamar.' : 'Gagal memuat data pelamar.');
        return;
      }
      const json = await res.json();
      setRows(json.data.candidates ?? []);
    } catch {
      setErr('Gagal memuat data pelamar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id: string, status: string) => {
    setMsg(null);
    const row = rows.find((r) => r.id === id);
    const res = await fetch(`/api/v1/recruitment/candidates/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setSuccess({
        title: 'Status berhasil diperbarui',
        body: `Status lamaran ${row?.fullName ?? 'kandidat'} (${row?.applicationNo ?? ''}) kini ${status}.`,
      });
      await load();
    } else {
      setMsg('Gagal memperbarui status.');
    }
  };

  const openReview = async (id: string) => {
    setReviewId(id); setDetail(null); setDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/recruitment/candidates/${id}/review`);
      const j = await res.json().catch(() => ({}));
      if (res.ok) setDetail(j.data as ReviewDetail);
      else setMsg(j?.detail || 'Gagal memuat review.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openProfile = async (id: string) => {
    setProfileId(id); setProfile(null); setProfileLoading(true);
    try {
      const res = await fetch(`/api/v1/recruitment/candidates/${id}/detail`);
      const j = await res.json().catch(() => ({}));
      if (res.ok) setProfile(j.data);
      else setMsg(j?.detail || 'Gagal memuat detail pelamar.');
    } finally {
      setProfileLoading(false);
    }
  };

  const submitDecision = async (decision: 'ACCEPTED' | 'REJECTED' | 'TALENT_POOL') => {
    if (!reviewId) return;
    setDecisionBusy(true); setMsg(null);
    const res = await fetch(`/api/v1/recruitment/candidates/${reviewId}/decision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, aiSummary: detail?.aiSummary ?? undefined }),
    });
    setDecisionBusy(false);
    if (res.ok) {
      const label = decision === 'ACCEPTED' ? 'Diterima' : decision === 'REJECTED' ? 'Ditolak' : 'Talent Pool';
      setSuccess({
        title: 'Keputusan tersimpan',
        body: `Kandidat ${detail?.candidateName ?? ''} ditandai: ${label}. Daftar pelamar diperbarui otomatis.`,
      });
      setReviewId(null); setDetail(null); await load();
    } else {
      setMsg('Gagal menyimpan keputusan.');
    }
  };

  const scorePill = (label: string, v: number | null) => (
    <div className="rounded-xl border border-[#e2e8f0] p-2.5 text-center">
      <p className="text-[10px] text-[#64748b]">{label}</p>
      <p className="text-lg font-black text-[#0f172a]">{v != null ? v.toFixed(0) : '–'}</p>
    </div>
  );

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <h2 className="text-base font-extrabold text-[#0f172a]">Rekrutmen Kandidat</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8]">Portal Karier</span>
      </div>
      {err ? (
        <p className="text-xs text-[#64748b]">{err}</p>
      ) : loading ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#64748b]">Belum ada pelamar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#64748b] border-b border-[#e2e8f0]">
                <th className="py-2">No. Lamaran</th>
                <th className="py-2">Nama</th>
                <th className="py-2">Posisi</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f1f5f9]">
                  <td className="py-2 font-mono text-[10px]">{r.applicationNo}</td>
                  <td className="py-2">
                    <p className="font-bold text-[#0f172a]">{r.fullName}</p>
                    <span className="text-[10px] text-[#64748b]">{r.email}</span>
                  </td>
                  <td className="py-2">{r.postingTitle}</td>
                  <td className="py-2">
                    <select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)}
                      className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-[11px]">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => openProfile(r.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-[#334155] text-[11px] font-semibold hover:bg-slate-200">
                        Detail
                      </button>
                      <button onClick={() => openReview(r.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0f172a] text-white text-[11px] font-semibold hover:bg-[#1e293b]">
                        <Sparkles className="h-3 w-3" /> Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {msg && <p className="text-[11px] font-semibold text-[#137333] mt-2">{msg}</p>}
          <p className="text-[10px] text-[#64748b] mt-2">
            Tip: untuk memindahkan pelamar ke tahap <strong>INTERVIEW</strong>, buat jadwal & tautan rapat
            pada panel <strong>Jadwal Wawancara</strong> di bawah. Setelah wawancara selesai, tandai
            &ldquo;Selesai&rdquo; di panel tersebut.
          </p>
        </div>
      )}

      {reviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-300" />
                <span className="text-sm font-bold">Review Kandidat</span>
              </div>
              <button onClick={() => { setReviewId(null); setDetail(null); }} className="p-1 rounded-lg hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ReviewBody
              detailLoading={detailLoading}
              detail={detail}
              decisionBusy={decisionBusy}
              onDecision={submitDecision}
              scorePill={scorePill}
            />
          </div>
        </div>
      )}

      {/* Kelola lowongan (WS-12) */}
      <JobPostingManager />

      {/* Modal notifikasi sukses (auto-refresh sudah dijalankan) */}
      {success && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-sm w-full p-6 text-center space-y-3">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[#e6f4ea]">
              <CheckCircle2 className="h-6 w-6 text-[#137333]" />
            </div>
            <h3 className="text-base font-extrabold text-[#0f172a]">{success.title}</h3>
            <p className="text-xs text-[#64748b]">{success.body}</p>
            <button
              onClick={() => setSuccess(null)}
              className="w-full mt-1 px-4 py-2.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {profileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between">
              <span className="text-sm font-bold">Detail Pelamar</span>
              <button onClick={() => { setProfileId(null); setProfile(null); }} className="p-1 rounded-lg hover:bg-white/10 text-lg leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {profileLoading || !profile ? (
                <p className="text-xs text-[#64748b]">Memuat…</p>
              ) : (
                <CandidateProfile profile={profile} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReviewBodyProps {
  detailLoading: boolean;
  detail: ReviewDetail | null;
  decisionBusy: boolean;
  onDecision: (d: 'ACCEPTED' | 'REJECTED' | 'TALENT_POOL') => void;
  scorePill: (label: string, v: number | null) => React.ReactNode;
}

function ReviewBody({ detailLoading, detail, decisionBusy, onDecision, scorePill }: ReviewBodyProps) {
  return (
    <div className="p-5 space-y-4">
      {detailLoading || !detail ? (
        <p className="text-xs text-[#64748b]">Memuat analisis…</p>
      ) : (
        <>
          <div>
            <p className="text-base font-extrabold text-[#0f172a]">{detail.candidateName}</p>
            <p className="text-[11px] text-[#64748b]">{detail.candidateEmail} · {detail.postingTitle} ({detail.department})</p>
          </div>

          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${RECO_STYLE[detail.recommendation] ?? RECO_STYLE.INSUFFICIENT_DATA}`}>
            Rekomendasi Sistem: {RECO_LABEL[detail.recommendation] ?? detail.recommendation}
            {detail.overallScore != null && <span>· Skor {detail.overallScore.toFixed(0)}</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {scorePill('ATS', detail.atsScore)}
            {scorePill('Psikometri', detail.psychometricScore)}
            {scorePill('Teknis', detail.technicalScore)}
            {scorePill('Wawancara', detail.interviewScore)}
          </div>
          <div className="text-[10px] text-[#64748b]">
            Gabungan asesmen (30/40/30): <strong>{detail.finalWeightedScore != null ? detail.finalWeightedScore.toFixed(0) : '–'}</strong>
            {detail.experienceYears != null && <> · Pengalaman: <strong>{detail.experienceYears} thn</strong></>}
            {detail.education && <> · Pendidikan: <strong>{detail.education}</strong></>}
          </div>

          {detail.matchedSkills.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-emerald-700 mb-1">Kualifikasi terpenuhi</p>
              <div className="flex flex-wrap gap-1">
                {detail.matchedSkills.slice(0, 12).map((s) => <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{s}</span>)}
              </div>
            </div>
          )}
          {detail.missingSkills.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-700 mb-1">Kualifikasi belum terlihat</p>
              <div className="flex flex-wrap gap-1">
                {detail.missingSkills.slice(0, 12).map((s) => <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{s}</span>)}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold text-indigo-700">Analisis AI {detail.aiConfigured === false ? '(fallback)' : ''}</span>
            </div>
            <div className="text-[11px] text-[#334155] whitespace-pre-wrap leading-relaxed">{detail.aiSummary}</div>
          </div>

          {detail.decision !== 'PENDING' && (
            <p className="text-[11px] font-semibold text-[#334155]">Keputusan saat ini: <strong>{detail.decision}</strong></p>
          )}

          <div className="flex flex-wrap gap-2 pt-1 border-t border-[#f1f5f9]">
            <button disabled={decisionBusy} onClick={() => onDecision('ACCEPTED')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#007a5a] text-white text-xs font-bold hover:bg-[#006347] disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" /> Terima
            </button>
            <button disabled={decisionBusy} onClick={() => onDecision('TALENT_POOL')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1d4ed8] text-white text-xs font-bold hover:bg-[#1e40af] disabled:opacity-50">
              <Users className="h-3.5 w-3.5" /> Talent Pool
            </button>
            <button disabled={decisionBusy} onClick={() => onDecision('REJECTED')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" /> Tolak
            </button>
          </div>
          <p className="text-[10px] text-[#94a3b8]">Rekomendasi AI bersifat asistif; keputusan akhir tetap milik HR.</p>
        </>
      )}
    </div>
  );
}

const GENDER_LABEL: Record<string, string> = { LAKI_LAKI: 'Laki-laki', PEREMPUAN: 'Perempuan' };
const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function CandidateProfile({ profile }: { profile: any }) {
  return (
    <>
      <div>
        <p className="text-base font-extrabold text-[#0f172a]">{profile.fullName}</p>
        <p className="text-[11px] text-[#64748b]">{profile.email} · {profile.phone || '—'}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#334155] mt-1">
          {profile.gender && <span>Jenis Kelamin: <strong>{GENDER_LABEL[profile.gender] ?? profile.gender}</strong></span>}
          {profile.birthDate && <span>Tgl Lahir: <strong>{String(profile.birthDate).slice(0, 10)}</strong></span>}
          {profile.nik && <span>NIK: <strong>{profile.nik}</strong></span>}
          <span>Melamar: <strong>{profile.postingTitle}</strong></span>
        </div>
        {profile.address && <p className="text-[11px] text-[#64748b] mt-1">Alamat: {profile.address}</p>}
      </div>

      {profile.skills?.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-[#334155] mb-1">Keahlian</p>
          <div className="flex flex-wrap gap-1">
            {profile.skills.map((s: string) => <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{s}</span>)}
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold text-[#334155] mb-1">Riwayat Pendidikan</p>
        {profile.educations?.length ? profile.educations.map((e: any) => (
          <div key={e.id} className="text-[11px] text-[#334155] py-1 border-b border-[#f8fafc] last:border-0">
            <strong>{e.level || e.degree || '—'}</strong> {e.major ? `· ${e.major}` : ''} — {e.institution || '—'}
            <span className="text-[10px] text-[#64748b]"> ({e.startYear || '?'}–{e.endYear || '?'}{e.gpa ? `, IPK ${e.gpa}` : ''})</span>
          </div>
        )) : <p className="text-[11px] text-[#94a3b8]">Tidak ada data.</p>}
      </div>

      <div>
        <p className="text-[11px] font-bold text-[#334155] mb-1">Riwayat Pekerjaan</p>
        {profile.experiences?.length ? profile.experiences.map((x: any) => (
          <div key={x.id} className="text-[11px] text-[#334155] py-1 border-b border-[#f8fafc] last:border-0">
            <strong>{x.roleTitle || '—'}</strong>{x.company ? ` · ${x.company}` : ''}
            {x.experienceType && <span className="text-[10px] text-[#64748b]"> [{x.experienceType}]</span>}
            <span className="text-[10px] text-[#64748b]"> {x.startMonth ? MONTH_SHORT[x.startMonth] : ''} {x.startYear || ''}–{x.isCurrent ? 'Sekarang' : `${x.endMonth ? MONTH_SHORT[x.endMonth] : ''} ${x.endYear || ''}`}</span>
            {x.location && <span className="text-[10px] text-[#64748b]"> · {x.location}</span>}
          </div>
        )) : <p className="text-[11px] text-[#94a3b8]">Tidak punya pengalaman.</p>}
      </div>

      <div>
        <p className="text-[11px] font-bold text-[#334155] mb-1">Sertifikasi / Penghargaan</p>
        {profile.certifications?.length ? profile.certifications.map((c: any) => (
          <div key={c.id} className="text-[11px] text-[#334155] py-1 border-b border-[#f8fafc] last:border-0 flex items-center justify-between">
            <span><strong>{c.name}</strong>{c.issuer ? ` · ${c.issuer}` : ''}<span className="text-[10px] text-[#64748b]"> {c.issuedDate ? `(${String(c.issuedDate).slice(0, 10)})` : ''}</span></span>
            {c.proofUrl && <a href={c.proofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[#0284c7] underline">Bukti</a>}
          </div>
        )) : <p className="text-[11px] text-[#94a3b8]">Tidak ada data.</p>}
      </div>

      <div>
        <p className="text-[11px] font-bold text-[#334155] mb-1">Berkas Lamaran</p>
        {profile.documents?.length ? profile.documents.map((d: any) => (
          <div key={d.id} className="text-[11px] text-[#334155] py-1 flex items-center justify-between">
            <span>{d.docType} — {d.fileName || 'dokumen'}</span>
            {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[#0284c7] underline">Lihat</a>}
          </div>
        )) : <p className="text-[11px] text-[#94a3b8]">Tidak ada berkas.</p>}
      </div>
    </>
  );
}
