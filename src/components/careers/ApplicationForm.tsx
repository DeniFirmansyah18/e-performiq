'use client';

import React, { useRef, useState } from 'react';
import SearchableSelect from '@/components/careers/SearchableSelect';
import AddressSelect, { emptyAddr, type AddressValue } from '@/components/careers/AddressSelect';

export interface PostingOption { id: string; postingTitle: string }

interface Props {
  postings: PostingOption[];
  selectedPosting: string;
  onSelectPosting: (id: string) => void;
  onSubmitted: (applicationNo: string, ats: { score: number; matched: string[]; missing: string[] } | null) => void;
}

interface Education {
  level: string; institution: string; institutionCode: string; institutionExternalId: string; major: string;
  startYear: string; endYear: string; graduationStatus: string; gpa: string;
}
interface Experience {
  experienceType: string; roleTitle: string; company: string; location: string;
  startMonth: string; startYear: string; endMonth: string; endYear: string; isCurrent: boolean;
}
interface Certification {
  kind: string; name: string; issuer: string; issuedDate: string; expiryDate: string; proofUrl: string; proofName: string;
}

const emptyEdu = (): Education => ({ level: '', institution: '', institutionCode: '', institutionExternalId: '', major: '', startYear: '', endYear: '', graduationStatus: 'LULUS', gpa: '' });
const emptyExp = (): Experience => ({ experienceType: 'KERJA', roleTitle: '', company: '', location: '', startMonth: '', startYear: '', endMonth: '', endYear: '', isCurrent: false });
const emptyCert = (): Certification => ({ kind: 'CERTIFICATION', name: '', issuer: '', issuedDate: '', expiryDate: '', proofUrl: '', proofName: '' });

const LEVELS = ['SD', 'SMP', 'SMA/SMK', 'D3', 'D4', 'S1', 'S2'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Gagal membaca berkas.'));
    r.readAsDataURL(file);
  });
}

/** Form lamaran lengkap (WS-13): ATS auto-fill, pendidikan, riwayat kerja, sertifikasi, berkas. */
export default function ApplicationForm({ postings, selectedPosting, onSelectPosting, onSubmitted }: Props) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', birthDate: '', gender: '', nik: '' });
  const [address, setAddress] = useState<AddressValue>(emptyAddr());
  const [educations, setEducations] = useState<Education[]>([emptyEdu()]);
  const [experienceMode, setExperienceMode] = useState<'NONE' | 'MAGANG' | 'KERJA'>('NONE');
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [coverLetterFile, setCoverLetterFile] = useState<{ url: string; name: string } | null>(null);
  const [resumeDoc, setResumeDoc] = useState<{ url: string; name: string } | null>(null);
  const [videoFile, setVideoFile] = useState<{
    url: string;
    name: string;
    size: number;
    duration: number | null;
    localPreviewUrl?: string;
  } | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [upload, setUpload] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoFilled, setAutoFilled] = useState<string[]>([]);
  const [ptInfo, setPtInfo] = useState<Record<string, { loading: boolean; detail?: any; prodi?: any[] }>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  /** Ambil detail PT (+prodi) dari scraper PDDikti lewat proxy server (best-effort). */
  const loadPtInfo = async (key: string, id: string) => {
    if (!id) return;
    setPtInfo((s) => ({ ...s, [key]: { loading: true } }));
    try {
      const res = await fetch(`/api/v1/reference/pt/${encodeURIComponent(id)}?withProdi=1`);
      const j = await res.json().catch(() => ({}));
      const data = j?.data ?? {};
      setPtInfo((s) => ({ ...s, [key]: { loading: false, detail: data.detail ?? null, prodi: data.prodi ?? [] } }));
    } catch {
      setPtInfo((s) => ({ ...s, [key]: { loading: false } }));
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /** Auto-fill dari hasil parsing CV. */
  const applyParsed = (parsed: any) => {
    const filled: string[] = [];
    setForm((f) => {
      const next = { ...f };
      if (!next.fullName && parsed.fullName) { next.fullName = parsed.fullName; filled.push('Nama'); }
      if (!next.email && parsed.contact?.email) { next.email = parsed.contact.email; filled.push('Email'); }
      if (!next.phone && parsed.contact?.phone) { next.phone = parsed.contact.phone; filled.push('Telepon'); }
      if (!next.gender && parsed.gender) { next.gender = parsed.gender; filled.push('Jenis Kelamin'); }
      if (!next.nik && parsed.nik) { next.nik = parsed.nik; filled.push('NIK'); }
      if (!next.birthDate && parsed.birthDate) { next.birthDate = parsed.birthDate; filled.push('Tanggal Lahir'); }
      return next;
    });
    // Alamat dari CV → isi cascade (best-effort; kandidat dapat sesuaikan).
    const hasAddr = parsed.address || parsed.city || parsed.province || parsed.postalCode;
    if (hasAddr) {
      setAddress((a) => ({
        address: a.address || parsed.address || '',
        province: a.province || parsed.province || '',
        city: a.city || parsed.city || '',
        district: a.district || '',
        village: a.village || '',
        postalCode: a.postalCode || parsed.postalCode || '',
      }));
      filled.push('Alamat');
    }
    if (Array.isArray(parsed.educations) && parsed.educations.length > 0) {
      // Petakan tiap hasil parsing ke baris form; BUANG baris yang benar-benar
      // kosong agar tidak memunculkan kotak riwayat pendidikan kosong.
      const mapped = parsed.educations.slice(0, 5)
        .map((e: any) => ({
          level: e.level ?? e.degree ?? '', institution: e.institution ?? '', institutionCode: '', institutionExternalId: '',
          major: e.major ?? '', startYear: e.startYear ? String(e.startYear) : '',
          endYear: e.endYear ? String(e.endYear) : '', graduationStatus: 'LULUS', gpa: e.gpa ? String(e.gpa) : '',
        }))
        .filter((e: Education) => Boolean(e.institution || e.major || e.level || e.startYear || e.endYear || e.gpa));
      if (mapped.length > 0) {
        setEducations(mapped);
        filled.push('Pendidikan');
      }
    }
    if (Array.isArray(parsed.experiences) && parsed.experiences.length > 0) {
      setExperienceMode('KERJA');
      setExperiences(parsed.experiences.slice(0, 10).map((x: any) => ({
        experienceType: 'KERJA', roleTitle: x.roleTitle ?? '', company: x.company ?? '', location: '',
        startMonth: x.startDate ? String(Number(x.startDate.slice(5, 7))) : '',
        startYear: x.startDate ? x.startDate.slice(0, 4) : '',
        endMonth: x.endDate ? String(Number(x.endDate.slice(5, 7))) : '',
        endYear: x.endDate ? x.endDate.slice(0, 4) : '', isCurrent: !x.endDate,
      })));
      filled.push('Riwayat Kerja');
    }
    setAutoFilled(Array.from(new Set(filled)));
  };

  const handleFile = async (file: File) => {
    setUploadError(null); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/careers/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setUploadError(j?.detail || 'Gagal mengunggah berkas.'); return; }
      setUpload(j.data);
      setResumeDoc({ url: await fileToDataUrl(file), name: file.name });
      if (j.data?.parsed) applyParsed(j.data.parsed);
    } catch { setUploadError('Terjadi kesalahan saat mengunggah.'); }
    finally { setUploading(false); }
  };

  const handleVideoSelect = async (file: File) => {
    setVideoError(null);
    if (!file) return;

    // 1. Validasi ukuran (maksimal 10 MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setVideoError(`Ukuran video melebihi batas maksimal 10 MB (terdeteksi: ${mb} MB).`);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    // 2. Validasi format file (MP4, WebM, MOV)
    const lower = file.name.toLowerCase();
    const validExts = ['.mp4', '.webm', '.mov', '.ogg', '.m4v'];
    const validMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-m4v'];
    if (!validExts.some((ext) => lower.endsWith(ext)) && !validMimes.includes(file.type)) {
      setVideoError('Format video tidak didukung. Harap unggah berkas MP4, WebM, atau MOV.');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    // 3. Validasi durasi (maksimal 2 menit / 120 detik) via HTML5 video element
    const objectUrl = URL.createObjectURL(file);
    const videoElem = document.createElement('video');
    videoElem.preload = 'metadata';

    const checkDurationAndUpload = async (durationSec: number | null) => {
      if (durationSec != null && durationSec > 121.5) {
        const m = Math.floor(durationSec / 60);
        const s = Math.floor(durationSec % 60);
        setVideoError(`Durasi video (${m}:${String(s).padStart(2, '0')}) melebihi batas maksimal 2 menit.`);
        URL.revokeObjectURL(objectUrl);
        if (videoInputRef.current) videoInputRef.current.value = '';
        return;
      }

      setVideoUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (durationSec != null) fd.append('duration', String(durationSec));

        const res = await fetch('/api/v1/careers/upload-video', {
          method: 'POST',
          body: fd,
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setVideoError(j?.detail || 'Gagal mengunggah video perkenalan.');
          URL.revokeObjectURL(objectUrl);
          if (videoInputRef.current) videoInputRef.current.value = '';
          return;
        }

        setVideoFile({
          url: j.data.fileUrl,
          name: file.name,
          size: file.size,
          duration: j.data.duration ?? durationSec,
          localPreviewUrl: objectUrl,
        });
      } catch {
        setVideoError('Terjadi kesalahan saat mengunggah video.');
        URL.revokeObjectURL(objectUrl);
      } finally {
        setVideoUploading(false);
      }
    };

    videoElem.onloadedmetadata = () => {
      const dur = videoElem.duration;
      void checkDurationAndUpload(Number.isFinite(dur) ? dur : null);
    };

    videoElem.onerror = () => {
      // Jika browser tidak dapat membaca metadata lokal (mis. MOV tertentu),
      // serahkan validasi ke server
      void checkDurationAndUpload(null);
    };

    videoElem.src = objectUrl;
  };

  const removeVideo = () => {
    if (videoFile?.localPreviewUrl) URL.revokeObjectURL(videoFile.localPreviewUrl);
    setVideoFile(null);
    setVideoError(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const field = (k: keyof typeof form, label: string, type = 'text', required = false) => (
    <label className="block text-[11px] text-[#334155]">
      <span className="font-semibold">{label}{required ? ' *' : ''}</span>
      <input type={type} value={form[k]} required={required} onChange={(e) => set(k, e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
    </label>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!videoFile) {
      setMsg('Video perkenalan diri (unjuk spesialisasi) wajib diunggah.');
      document.getElementById('video-perkenalan-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setBusy(true);
    const payload = {
      ...form,
      // Field opsional: kirim undefined (bukan '') agar lolos validasi enum/opsional.
      gender: form.gender || undefined,
      birthDate: form.birthDate || undefined,
      phone: form.phone || undefined,
      nik: form.nik || undefined,
      address: [address.address, address.village, address.district, address.city, address.province, address.postalCode]
        .map((s) => String(s ?? '').trim()).filter(Boolean).join(', ') || undefined,
      jobPostingId: selectedPosting,
      resumeText: upload?.extracted ? upload.rawText : undefined,
      resumeFileName: upload?.fileName,
      noExperience: experienceMode === 'NONE',
      educations: educations.filter((x) => x.institution || x.major || x.level).map((x) => ({
        level: x.level || null, institution: x.institution || null, institutionCode: x.institutionCode || null,
        degree: x.level || null, major: x.major || null,
        startYear: x.startYear ? Number(x.startYear) : null, endYear: x.endYear ? Number(x.endYear) : null,
        graduationStatus: x.graduationStatus || null, gpa: x.gpa ? Number(x.gpa) : null,
      })),
      experiences: experienceMode === 'NONE' ? [] : experiences.map((x) => ({
        experienceType: x.experienceType || 'KERJA', roleTitle: x.roleTitle || null, company: x.company || null,
        location: x.location || null,
        startMonth: x.startMonth ? Number(x.startMonth) : null, startYear: x.startYear ? Number(x.startYear) : null,
        endMonth: x.isCurrent ? null : (x.endMonth ? Number(x.endMonth) : null),
        endYear: x.isCurrent ? null : (x.endYear ? Number(x.endYear) : null),
        isCurrent: x.isCurrent,
      })),
      certifications: certifications.filter((c) => c.name).map((c) => ({
        kind: c.kind || 'CERTIFICATION', name: c.name, issuer: c.issuer || null,
        issuedDate: c.issuedDate || null, expiryDate: c.expiryDate || null, proofUrl: c.proofUrl || null,
      })),
      documents: [
        ...(resumeDoc ? [{ docType: 'CV', fileName: resumeDoc.name, mimeType: 'application/pdf', fileUrl: resumeDoc.url }] : []),
        ...(coverLetterFile ? [{ docType: 'COVER_LETTER', fileName: coverLetterFile.name, fileUrl: coverLetterFile.url }] : []),
        ...(videoFile ? [{ docType: 'INTRODUCTION_VIDEO', fileName: videoFile.name, mimeType: 'video/mp4', fileUrl: videoFile.url }] : []),
        ...certifications.filter((c) => c.proofUrl).map((c) => ({ docType: 'CERTIFICATE', fileName: `${c.name}-bukti`, fileUrl: c.proofUrl })),
      ],
    };
    const res = await fetch('/api/v1/careers/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onSubmitted(j.data.applicationNo, j.data.ats ?? null);
    else setMsg(j?.detail || 'Gagal mengirim lamaran.');
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* ==== ATS UPLOAD ==== */}
      <div className="p-3 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] space-y-2">
        <p className="text-xs font-semibold text-[#334155]">Unggah CV (PDF/DOCX/TXT) — dianalisis otomatis & mengisi form</p>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.rtf"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          className="block w-full text-[11px] text-[#334155] file:mr-2 file:rounded-lg file:border-0 file:bg-[#007a5a] file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white" />
        {uploading && <p className="text-[11px] text-[#64748b]">Menganalisis berkas…</p>}
        {uploadError && <p className="text-[11px] font-semibold text-rose-600">{uploadError}</p>}
        {autoFilled.length > 0 && <p className="text-[11px] font-semibold text-emerald-700">Terisi otomatis: {autoFilled.join(', ')}</p>}
        {upload?.detectedSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {upload.detectedSkills.slice(0, 18).map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{s}</span>
            ))}
          </div>
        )}
        {upload && <p className="text-[10px] text-[#64748b]">{upload.note}</p>}
      </div>

      {/* ==== POSISI & DATA DIRI ==== */}
      <label className="block text-[11px] text-[#334155]">
        <span className="font-semibold">Posisi yang dilamar *</span>
        <select value={selectedPosting} onChange={(e) => onSelectPosting(e.target.value)} required
          className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
          {postings.map((p) => <option key={p.id} value={p.id}>{p.postingTitle}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('fullName', 'Nama Lengkap', 'text', true)}
        {field('email', 'Email', 'email', true)}
        {field('phone', 'Telepon')}
        {field('birthDate', 'Tanggal Lahir', 'date')}
        <label className="block text-[11px] text-[#334155]">
          <span className="font-semibold">Jenis Kelamin</span>
          <select value={form.gender} onChange={(e) => set('gender', e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
            <option value="">— Pilih —</option>
            <option value="LAKI_LAKI">Laki-laki</option>
            <option value="PEREMPUAN">Perempuan</option>
          </select>
        </label>
        {field('nik', 'NIK (opsional)')}
      </div>
      <AddressSelect value={address} onChange={setAddress} />
      {/* ==== PENDIDIKAN ==== */}
      <div className="p-3 rounded-xl border border-[#e2e8f0] space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#0f172a]">Riwayat Pendidikan</p>
          <button type="button" onClick={() => setEducations((a) => [...a, emptyEdu()])} className="text-[11px] font-semibold text-[#007a5a]">+ Tambah</button>
        </div>
        {educations.map((edu, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-[#f8fafc]">
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Jenjang</span>
              <select value={edu.level} onChange={(e) => setEducations((a) => a.map((x, j) => j === i ? { ...x, level: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                <option value="">— Pilih —</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select></label>
            <label className="text-[11px] text-[#334155] sm:col-span-2"><span className="font-semibold">Sekolah / Kampus</span>
              <SearchableSelect value={edu.institution} placeholder="Cari sekolah/kampus…"
                fetchUrl={(q) => `/api/v1/reference/institutions?q=${encodeURIComponent(q)}`}
                mapOptions={(rows) => rows.map((r) => ({ label: r.name, sublabel: [r.level, r.city, r.province].filter(Boolean).join(' · '), value: r.name, code: r.code, externalId: r.externalId }))}
                onChange={(v, o) => {
                  setEducations((a) => a.map((x, j) => j === i ? { ...x, institution: v, institutionCode: o?.code ?? x.institutionCode, institutionExternalId: o?.externalId ?? '' } : x));
                  if (o?.externalId) loadPtInfo(String(i), o.externalId);
                  else setPtInfo((s) => { const n = { ...s }; delete n[String(i)]; return n; });
                }} /></label>
            {ptInfo[String(i)] && (
              <div className="sm:col-span-3 text-[10px] text-[#475569] rounded-lg border border-indigo-100 bg-indigo-50/60 px-2 py-1.5">
                {ptInfo[String(i)].loading && <span>Memuat info kampus dari PDDikti…</span>}
                {!ptInfo[String(i)].loading && ptInfo[String(i)].detail && (
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#0f172a]">{ptInfo[String(i)].detail?.nama_pt}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {ptInfo[String(i)].detail?.status_pt && <span>Status: <b>{ptInfo[String(i)].detail.status_pt}</b></span>}
                      {ptInfo[String(i)].detail?.akreditasi_pt && <span>Akreditasi: <b>{ptInfo[String(i)].detail.akreditasi_pt}</b></span>}
                      {ptInfo[String(i)].detail?.provinsi_pt && <span>{ptInfo[String(i)].detail.provinsi_pt}</span>}
                    </p>
                    {ptInfo[String(i)].prodi && ptInfo[String(i)].prodi!.length > 0 && (
                      <p>Prodi: {ptInfo[String(i)].prodi!.slice(0, 6).map((p) => p.nama_prodi).filter(Boolean).join(', ')}
                        {ptInfo[String(i)].prodi!.length > 6 ? ` +${ptInfo[String(i)].prodi!.length - 6} lainnya` : ''}</p>
                    )}
                  </div>
                )}
                {!ptInfo[String(i)].loading && !ptInfo[String(i)].detail && <span>Info kampus tidak tersedia (offline).</span>}
              </div>
            )}
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Jurusan / Prodi</span>
              <SearchableSelect value={edu.major} placeholder="Cari jurusan…"
                fetchUrl={(q) => `/api/v1/reference/majors?q=${encodeURIComponent(q)}`}
                mapOptions={(rows) => rows.map((r) => ({ label: r.name, sublabel: r.groupName, value: r.name }))}
                onChange={(v) => setEducations((a) => a.map((x, j) => j === i ? { ...x, major: v } : x))} /></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Tahun Masuk</span>
              <input type="number" min="1950" max="2100" value={edu.startYear}
                onChange={(e) => setEducations((a) => a.map((x, j) => j === i ? { ...x, startYear: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Tahun Lulus</span>
              <input type="number" min="1950" max="2100" value={edu.endYear}
                onChange={(e) => setEducations((a) => a.map((x, j) => j === i ? { ...x, endYear: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Status</span>
              <select value={edu.graduationStatus} onChange={(e) => setEducations((a) => a.map((x, j) => j === i ? { ...x, graduationStatus: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                <option value="LULUS">Lulus</option><option value="AKTIF">Masih Aktif</option>
              </select></label>
            {educations.length > 1 && (
              <button type="button" onClick={() => setEducations((a) => a.filter((_, j) => j !== i))}
                className="text-[10px] font-semibold text-rose-600 sm:col-start-3 justify-self-end">Hapus</button>
            )}
          </div>
        ))}
      </div>

      {/* ==== RIWAYAT PEKERJAAN ==== */}
      <div className="p-3 rounded-xl border border-[#e2e8f0] space-y-3">
        <p className="text-xs font-bold text-[#0f172a]">Riwayat Pekerjaan</p>
        <div className="flex flex-wrap gap-2">
          {([['NONE', 'Tidak punya pengalaman'], ['MAGANG', 'Magang'], ['KERJA', 'Kerja']] as const).map(([v, l]) => (
            <label key={v} className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${experienceMode === v ? 'border-[#007a5a] bg-[#e6f4ea] text-[#137333]' : 'border-[#e2e8f0] text-[#334155]'}`}>
              <input type="radio" name="expmode" className="hidden" checked={experienceMode === v}
                onChange={() => { setExperienceMode(v); if (v !== 'NONE' && experiences.length === 0) setExperiences([{ ...emptyExp(), experienceType: v }]); }} />
              {l}
            </label>
          ))}
        </div>
        {experienceMode !== 'NONE' && (
          <>
            <button type="button" onClick={() => setExperiences((a) => [...a, { ...emptyExp(), experienceType: experienceMode }])} className="text-[11px] font-semibold text-[#007a5a]">+ Tambah pengalaman</button>
            {experiences.map((x, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-[#f8fafc]">
                <label className="text-[11px] text-[#334155] sm:col-span-2"><span className="font-semibold">Posisi / Jabatan</span>
                  <input value={x.roleTitle} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, roleTitle: e.target.value } : y))}
                    className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
                <label className="text-[11px] text-[#334155]"><span className="font-semibold">Tempat Kerja</span>
                  <input value={x.company} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, company: e.target.value } : y))}
                    className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
                <label className="text-[11px] text-[#334155]"><span className="font-semibold">Lokasi</span>
                  <input value={x.location} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, location: e.target.value } : y))}
                    className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
                <div className="sm:col-span-2 grid grid-cols-4 gap-1 items-end">
                  <label className="text-[10px] text-[#334155]"><span className="font-semibold">Bln mulai</span>
                    <select value={x.startMonth} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, startMonth: e.target.value } : y))}
                      className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-1 py-1.5 text-[11px]">
                      <option value="">—</option>{MONTHS.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}</select></label>
                  <label className="text-[10px] text-[#334155]"><span className="font-semibold">Thn</span>
                    <input type="number" value={x.startYear} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, startYear: e.target.value } : y))}
                      className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-1 py-1.5 text-[11px]" /></label>
                  <label className="text-[10px] text-[#334155]"><span className="font-semibold">Bln akhir</span>
                    <select disabled={x.isCurrent} value={x.endMonth} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, endMonth: e.target.value } : y))}
                      className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-1 py-1.5 text-[11px] disabled:opacity-40">
                      <option value="">—</option>{MONTHS.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}</select></label>
                  <label className="text-[10px] text-[#334155]"><span className="font-semibold">Thn</span>
                    <input type="number" disabled={x.isCurrent} value={x.endYear} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, endYear: e.target.value } : y))}
                      className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-1 py-1.5 text-[11px] disabled:opacity-40" /></label>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-[#334155]">
                  <input type="checkbox" checked={x.isCurrent} onChange={(e) => setExperiences((a) => a.map((y, j) => j === i ? { ...y, isCurrent: e.target.checked } : y))} className="accent-[#007a5a]" /> Masih bekerja di sini
                </label>
                {experiences.length > 1 && (
                  <button type="button" onClick={() => setExperiences((a) => a.filter((_, j) => j !== i))}
                    className="text-[10px] font-semibold text-rose-600 sm:col-start-3 justify-self-end">Hapus</button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ==== SERTIFIKASI / PENGHARGAAN ==== */}
      <div className="p-3 rounded-xl border border-[#e2e8f0] space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#0f172a]">Sertifikasi / Penghargaan</p>
          <button type="button" onClick={() => setCertifications((a) => [...a, emptyCert()])} className="text-[11px] font-semibold text-[#007a5a]">+ Tambah</button>
        </div>
        {certifications.length === 0 && <p className="text-[11px] text-[#64748b]">Belum ada. Klik &quot;+ Tambah&quot; bila ada.</p>}
        {certifications.map((c, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-[#f8fafc]">
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Jenis</span>
              <select value={c.kind} onChange={(e) => setCertifications((a) => a.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                <option value="CERTIFICATION">Sertifikat</option><option value="AWARD">Penghargaan</option>
              </select></label>
            <label className="text-[11px] text-[#334155] sm:col-span-2"><span className="font-semibold">Nama Sertifikat / Pencapaian</span>
              <input value={c.name} onChange={(e) => setCertifications((a) => a.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Pemberi</span>
              <input value={c.issuer} onChange={(e) => setCertifications((a) => a.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Mulai berlaku</span>
              <input type="date" value={c.issuedDate} onChange={(e) => setCertifications((a) => a.map((x, j) => j === i ? { ...x, issuedDate: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Berakhir (opsional)</span>
              <input type="date" value={c.expiryDate} onChange={(e) => setCertifications((a) => a.map((x, j) => j === i ? { ...x, expiryDate: e.target.value } : x))}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
            <label className="text-[11px] text-[#334155] sm:col-span-2"><span className="font-semibold">Upload Bukti (PDF/gambar)</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const url = await fileToDataUrl(f); setCertifications((a) => a.map((x, j) => j === i ? { ...x, proofUrl: url, proofName: f.name } : x)); } }}
                className="mt-1 block w-full text-[10px] text-[#334155]" />
              {c.proofName && <span className="text-[10px] text-emerald-700">Lampiran: {c.proofName}</span>}
            </label>
            <button type="button" onClick={() => setCertifications((a) => a.filter((_, j) => j !== i))}
              className="text-[10px] font-semibold text-rose-600 justify-self-end">Hapus</button>
          </div>
        ))}
      </div>

      {/* ==== VIDEO PERKENALAN DIRI (UNJUK SPESIALISASI) - WAJIB ==== */}
      <div id="video-perkenalan-section" className="p-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-[#0f172a]">Video Perkenalan Diri (Unjuk Spesialisasi)</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">Wajib</span>
            </div>
            <p className="text-[11px] text-[#475569] mt-0.5">
              Unggah video singkat untuk memperkenalkan diri dan memaparkan keahlian / spesialisasi yang Anda kuasai.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-white border border-[#cbd5e1] font-semibold text-[#334155]">Maks. 10 MB</span>
            <span className="px-2 py-0.5 rounded bg-white border border-[#cbd5e1] font-semibold text-[#334155]">Maks. 2 Menit</span>
            <span className="px-2 py-0.5 rounded bg-white border border-[#cbd5e1] font-semibold text-[#334155]">MP4, WebM, MOV</span>
          </div>
        </div>

        {!videoFile ? (
          <div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleVideoSelect(f);
              }}
              disabled={videoUploading}
              className="block w-full text-[11px] text-[#334155] file:mr-2 file:rounded-lg file:border-0 file:bg-[#1d4ed8] file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-[#1e40af] cursor-pointer disabled:opacity-50"
            />
            {videoUploading && (
              <p className="text-[11px] text-indigo-700 font-semibold mt-1 animate-pulse">
                Mengunggah &amp; memverifikasi video…
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 p-3 rounded-lg bg-white border border-indigo-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-[#0f172a] truncate max-w-[200px] sm:max-w-md">{videoFile.name}</span>
                <span className="text-[10px] text-[#64748b]">
                  ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  {videoFile.duration ? ` · ${Math.floor(videoFile.duration / 60)}:${String(Math.floor(videoFile.duration % 60)).padStart(2, '0')}` : ''})
                </span>
              </div>
              <button
                type="button"
                onClick={removeVideo}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
              >
                Ganti / Hapus
              </button>
            </div>

            <video
              controls
              playsInline
              preload="metadata"
              src={videoFile.localPreviewUrl || videoFile.url}
              className="w-full max-h-56 rounded-lg bg-black object-contain"
            >
              Peramban Anda tidak mendukung pemutar video.
            </video>
          </div>
        )}

        {videoError && (
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
            {videoError}
          </div>
        )}
      </div>

      {/* ==== SURAT LAMARAN (FILE) ==== */}
      <div className="p-3 rounded-xl border border-[#e2e8f0] space-y-2">
        <p className="text-xs font-bold text-[#0f172a]">Surat Lamaran / Dokumen Pendukung</p>
        <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCoverLetterFile({ url: await fileToDataUrl(f), name: f.name }); }}
          className="block w-full text-[11px] text-[#334155] file:mr-2 file:rounded-lg file:border-0 file:bg-[#0f172a] file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white" />
        {coverLetterFile && <p className="text-[10px] text-emerald-700">Lampiran: {coverLetterFile.name}</p>}
      </div>

      {/* Honeypot anti-bot */}
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {msg && <p className="text-[11px] font-semibold text-rose-600">{msg}</p>}
      <button type="submit" disabled={busy}
        className="px-5 py-2.5 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-50">
        {busy ? 'Mengirim…' : 'Kirim Lamaran'}
      </button>
    </form>
  );
}
