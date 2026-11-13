'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';

interface PositionCourse {
  courseId: number;
  courseCode: string;
  title: string;
  category: string | null;
  isMandatory: boolean;
  orderIndex: number;
  defaultHours: number;
}

interface PositionWithCourses {
  positionId: string;
  title: string;
  departmentName: string | null;
  mappedCount: number;
  courses: PositionCourse[];
}

interface CourseOption {
  courseId: number;
  courseCode: string;
  title: string;
  category: string | null;
  targetPhase: string;
  isMandatoryDefault: boolean;
  defaultHours: number;
  moduleCount: number;
}


/**
 * Panel pemetaan kursus→posisi (Jalur A) untuk HR Command Center.
 * Memungkinkan HR memetakan kursus (termasuk OER) ke posisi, memicu generate
 * kurikulum berbantuan AI (menautkan materi gratis), dan menautkan modul OER.
 */
export default function PositionCourseMappingPanel() {
  const [positions, setPositions] = useState<PositionWithCourses[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  // Filter & pilih-banyak agar konfigurasi 18+ posisi tidak melelahkan.
  const [filterDept, setFilterDept] = useState('');
  const [cariPosisi, setCariPosisi] = useState('');
  const [pilihBanyak, setPilihBanyak] = useState<string[]>([]);
  // Penyuntingan kursus & materi oleh HR.
  const [editKursusId, setEditKursusId] = useState<number | null>(null);
  const [editKursus, setEditKursus] = useState<{ title: string; category: string; hours: string }>({
    title: '', category: '', hours: '',
  });
  const [bukaModul, setBukaModul] = useState<number | null>(null);
  const [modulList, setModulList] = useState<Array<{ id: number; title: string; contentType: string; contentUrl: string | null }>>([]);
  const [modulLoading, setModulLoading] = useState(false);
  const [editModulId, setEditModulId] = useState<number | null>(null);
  const [modulForm, setModulForm] = useState<{ title: string; contentUrl: string }>({ title: '', contentUrl: '' });
  // Unggah materi sendiri + pencarian materi untuk dipilih.
  const [unggahNama, setUnggahNama] = useState<string | null>(null);
  const [unggahBusy, setUnggahBusy] = useState(false);
  const [tautanPeringatan, setTautanPeringatan] = useState<string | null>(null);
  const [cariMateri, setCariMateri] = useState('');
  const [cariBusy, setCariBusy] = useState(false);
  const [hasilCari, setHasilCari] = useState<Array<{ title: string; url: string; provider: string }>>([]);
  // Ringkasan hasil generate terakhir (posisi → kursus yang dibuat).
  const [hasilGenerate, setHasilGenerate] = useState<Array<{ positionId: string; courseId: number | null; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);


  // Form katalog kursus manual.

  const load = useCallback(async () => {
    try {
      setErr(null);
      const res = await fetch('/api/v1/learning/position-courses');
      if (!res.ok) {
        setErr(res.status === 403 ? 'Anda tidak berwenang memetakan kursus.' : 'Gagal memuat data pemetaan.');
        return;
      }
      const json = await res.json();
      const list: PositionWithCourses[] = json.data?.positions ?? [];
      setPositions(list);
      setCourses(json.data?.courses ?? []);
      setSelected((prev) => prev || list[0]?.positionId || '');
    } catch {
      setErr('Gagal memuat data pemetaan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const current = positions.find((p) => p.positionId === selected) ?? null;

  /** Daftar departemen untuk filter. */
  const departemen = Array.from(
    new Set(positions.map((p) => p.departmentName).filter((d): d is string => Boolean(d)))
  ).sort();

  /** Posisi setelah disaring departemen & kata kunci. */
  const posisiTampil = positions.filter((p) => {
    if (filterDept && p.departmentName !== filterDept) return false;
    const q = cariPosisi.trim().toLowerCase();
    if (!q) return true;
    return `${p.title} ${p.departmentName ?? ''}`.toLowerCase().includes(q);
  });

  /**
   * Posisi yang menjadi tujuan pemetaan: semua yang dicentang; bila tidak ada
   * yang dicentang, pakai posisi pada `selected` (perilaku lama).
   */
  const tujuanPemetaan = pilihBanyak.length > 0 ? pilihBanyak : selected ? [selected] : [];

  async function petakanKeSemua(courseId: number, isMandatory = true) {
    for (const positionId of tujuanPemetaan) {
      await fetch('/api/v1/learning/position-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, courseId, isMandatory }),
      });
    }
  }

  /** Muat daftar materi sebuah kursus. */
  async function muatMateri(courseId: number) {
    setModulLoading(true);
    try {
      const res = await fetch(`/api/v1/learning/courses/${courseId}`);
      const json = await res.json().catch(() => ({}));
      setModulList(res.ok ? (json?.data?.modules ?? []) : []);
      if (!res.ok) setErr(json?.detail || 'Gagal memuat materi kursus.');
    } catch {
      setModulList([]);
      setErr('Gagal memuat materi kursus.');
    } finally {
      setModulLoading(false);
    }
  }

  /** Buka/tutup daftar materi kursus. */
  async function bukaMateri(courseId: number) {
    if (bukaModul === courseId) { setBukaModul(null); return; }
    setBukaModul(courseId);
    setEditModulId(null);
    setModulForm({ title: '', contentUrl: '' });
    await muatMateri(courseId);
  }

  /** Simpan perubahan atribut kursus (judul/kategori/jam). */
  async function simpanEditKursus(courseId: number) {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch(`/api/v1/learning/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editKursus.title.trim(),
          category: editKursus.category.trim() || null,
          hours: editKursus.hours === '' ? undefined : Number(editKursus.hours),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal memperbarui kursus.'); return; }
      setMsg('Kursus diperbarui.');
      setEditKursusId(null);
      await load();
    } catch {
      setErr('Gagal memperbarui kursus.');
    } finally { setBusy(false); }
  }

  /** Tambah materi baru, atau simpan perubahan materi yang sedang diedit. */
  async function simpanMateri(courseId: number) {
    setBusy(true); setMsg(null); setErr(null); setTautanPeringatan(null);

    const tautan = modulForm.contentUrl.trim();
    // Tautan unggahan internal (dari storage aplikasi) tidak perlu diperiksa
    // domainnya — berkasnya memang milik kita. Selain itu, periksa keabsahan.
    if (tautan && !tautan.startsWith('/api/v1/learning/materials/')) {
      try {
        const res = await fetch(`/api/v1/learning/materials/validasi?url=${encodeURIComponent(tautan)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.data?.hidup === false) {
          setTautanPeringatan(json?.data?.alasan || json?.detail || 'Tautan tidak valid atau halamannya kosong.');
          setBusy(false);
          return;
        }
      } catch {
        /* pemeriksaan gagal karena jaringan: izinkan, server tetap memvalidasi */
      }
    }

    try {
      const payload = {
        title: modulForm.title.trim(),
        contentUrl: modulForm.contentUrl.trim() || null,
        contentType: modulForm.contentUrl.trim() ? 'VIDEO' : 'TEXT',
      };
      const url = editModulId
        ? `/api/v1/learning/modules/${editModulId}`
        : `/api/v1/learning/courses/${courseId}`;
      const res = await fetch(url, {
        method: editModulId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal menyimpan materi.'); return; }
      setMsg(editModulId ? 'Materi diperbarui.' : 'Materi ditambahkan.');
      setEditModulId(null);
      setModulForm({ title: '', contentUrl: '' });
      await muatMateri(courseId);
    } catch {
      setErr('Gagal menyimpan materi.');
    } finally { setBusy(false); }
  }

  /** Isi form materi dengan data modul yang akan diubah. */
  function mulaiEditModul(m: { id: number; title: string; contentUrl: string | null }) {
    setEditModulId(m.id);
    setModulForm({ title: m.title, contentUrl: m.contentUrl ?? '' });
    setUnggahNama(null);
    setTautanPeringatan(null);
  }

  /** Unggah berkas materi sendiri ke storage, lalu pakai URL-nya. */
  async function unggahMateri(file: File | null) {
    if (!file) return;
    setUnggahBusy(true); setErr(null); setMsg(null); setTautanPeringatan(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/learning/materials/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal mengunggah materi.'); return; }
      const url = json?.data?.url as string;
      setModulForm((f) => ({ title: f.title || file.name.replace(/\.[^.]+$/, ''), contentUrl: url }));
      setUnggahNama(json?.data?.fileName ?? file.name);
      setMsg('Materi terunggah. Klik Simpan untuk melampirkan ke kursus.');
    } catch {
      setErr('Gagal mengunggah materi.');
    } finally { setUnggahBusy(false); }
  }

  /** Cari materi OER untuk posisi terpilih, lalu tampilkan untuk dipilih. */
  async function cariOer() {
    const q = cariMateri.trim();
    setCariBusy(true); setErr(null);
    try {
      const pos = tujuanPemetaan[0];
      const url = `/api/v1/learning/oer?q=${encodeURIComponent(q)}${pos ? `&positionId=${encodeURIComponent(pos)}` : ''}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal mencari materi.'); return; }
      const hasil = (json?.data?.results ?? []) as Array<{ title: string; url: string; provider: string }>;
      setHasilCari(hasil);
      if (hasil.length === 0) setErr('Tidak ada materi yang cocok. Coba kata kunci lain.');
    } catch {
      setErr('Gagal mencari materi.');
    } finally { setCariBusy(false); }
  }

  async function addMapping(courseId: number, isMandatory = true) {
    if (tujuanPemetaan.length === 0) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      // Bila lebih dari satu posisi dicentang, kursus dipetakan ke semuanya.
      if (tujuanPemetaan.length > 1) {
        await petakanKeSemua(courseId, isMandatory);
        setMsg(`Kursus dipetakan ke ${tujuanPemetaan.length} posisi.`);
        await load();
        return;
      }
      const res = await fetch('/api/v1/learning/position-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: tujuanPemetaan[0], courseId, isMandatory }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal menambah mapping.'); return; }
      setMsg('Kursus berhasil dipetakan ke posisi.');
      await load();
    } catch {
      setErr('Gagal menambah mapping.');
    } finally { setBusy(false); }
  }

  async function removeMapping(courseId: number) {
    if (!selected) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch(`/api/v1/learning/position-courses?positionId=${encodeURIComponent(selected)}&courseId=${courseId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal menghapus mapping.'); return; }
      setMsg('Mapping dihapus.');
      await load();
    } catch {
      setErr('Gagal menghapus mapping.');
    } finally { setBusy(false); }
  }

  async function toggleMandatory(pc: PositionCourse) {
    if (!selected) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch('/api/v1/learning/position-courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: selected, courseId: pc.courseId, isMandatory: !pc.isMandatory }),
      });
      if (!res.ok) { setErr('Gagal memperbarui mapping.'); return; }
      await load();
    } catch {
      setErr('Gagal memperbarui mapping.');
    } finally { setBusy(false); }
  }

  async function generateWithAi() {
    if (tujuanPemetaan.length === 0) return;
    setBusy(true); setMsg(null); setErr(null); setHasilGenerate([]);

    // Generate untuk SETIAP posisi terpilih agar kursus selalu sesuai posisi.
    let jumlahModul = 0;
    let jumlahOer = 0;
    const dibuat: Array<{ positionId: string; courseId: number | null; title: string }> = [];
    let gagal = 0;

    for (const positionId of tujuanPemetaan) {
      try {
        const res = await fetch('/api/v1/learning/position-courses/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positionId, useAi: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { gagal++; continue; }

        jumlahModul += json?.data?.modules?.length ?? 0;
        jumlahOer += json?.data?.oerCount ?? 0;

        // Cari kursus onboarding milik posisi ini pada respons.
        const kursus: any[] = json?.data?.positionCourses ?? [];
        const onb = kursus.find((c: any) => /^Onboarding /i.test(String(c.title ?? '')));
        if (onb) dibuat.push({ positionId, courseId: Number(onb.courseId ?? onb.id ?? 0) || null, title: onb.title });
      } catch {
        gagal++;
      }
    }

    await load();

    // Tampilkan ringkasannya agar HR tahu apa yang dihasilkan.
    setHasilGenerate(dibuat);
    if (gagal === tujuanPemetaan.length) {
      setErr('Gagal generate kurikulum untuk semua posisi terpilih.');
    } else {
      setMsg(
        `Kurikulum dibuat untuk ${dibuat.length} posisi · ${jumlahModul} modul · ${jumlahOer} materi OER gratis.` +
          (gagal ? ` (${gagal} posisi gagal)` : '')
      );
    }

    // Buka kursus onboarding posisi pertama agar materinya langsung terlihat.
    if (dibuat[0]?.courseId) {
      setBukaModul(null);
      await bukaMateri(dibuat[0].courseId);
    }
    setBusy(false);
  }



  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div>
          <h2 className="text-base font-extrabold text-[#0f172a]">Pemetaan Kursus per Posisi</h2>
          <p className="text-[11px] text-[#64748b]">Kursus &amp; materi OER gratis yang wajib diselesaikan karyawan pada masa onboarding posisi ini.</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ecfdf5] text-[#047857]">Jalur A</span>
      </div>

      {err && <p className="text-xs text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}
      {msg && <p className="text-xs text-[#047857] bg-[#ecfdf5] px-3 py-2 rounded-lg">{msg}</p>}

      {/* Ringkasan kursus yang baru dibuat AI agar langsung terlihat. */}
      {hasilGenerate.length > 0 && (
        <div className="rounded-xl border border-[#b7e1cd] bg-[#f6fdf9] px-3 py-2">
          <p className="text-[11px] font-bold text-[#0f172a] mb-1">Kursus dibuat oleh AI</p>
          <ul className="space-y-0.5">
            {hasilGenerate.map((h) => (
              <li key={h.positionId} className="text-[11px] text-[#334155] flex items-center gap-1.5">
                <span className="text-[#137333]">•</span>
                <span className="truncate">{h.title}</span>
                {h.courseId && (
                  <button
                    type="button"
                    onClick={() => void bukaMateri(h.courseId!)}
                    className="text-[10px] font-bold text-[#007a5a] underline shrink-0"
                  >
                    lihat materi
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {loading ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : positions.length === 0 ? (
        <p className="text-xs text-[#64748b]">Belum ada posisi.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[200px]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Departemen</span>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
              >
                <option value="">Semua departemen</option>
                {departemen.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 min-w-[220px]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
                Cari posisi
              </span>
              <input
                value={cariPosisi}
                onChange={(e) => setCariPosisi(e.target.value)}
                placeholder="Ketik nama posisi…"
                className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
              />
            </label>
            <button
              type="button"
              onClick={generateWithAi}
              disabled={busy || !selected}
              className="rounded-lg bg-[#007a5a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Memproses…' : 'Generate dengan AI'}
            </button>
          </div>

          {/* Daftar posisi sebagai kartu yang dapat dipilih lebih dari satu,
              agar HR dapat memetakan satu kursus ke banyak posisi sekaligus. */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] px-3 py-2">
              <p className="text-[11px] font-bold text-[#334155]">
                Pilih posisi ({posisiTampil.length} dari {positions.length})
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPilihBanyak(
                      pilihBanyak.length === posisiTampil.length ? [] : posisiTampil.map((p) => p.positionId)
                    )
                  }
                  className="text-[10px] font-bold text-[#007a5a] hover:underline"
                >
                  {pilihBanyak.length === posisiTampil.length && posisiTampil.length > 0
                    ? 'Batal pilih semua'
                    : 'Pilih semua'}
                </button>
                {pilihBanyak.length > 1 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333]">
                    {pilihBanyak.length} dipilih
                  </span>
                )}
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {posisiTampil.map((p) => {
                const dipilih = pilihBanyak.includes(p.positionId);
                return (
                  <label
                    key={p.positionId}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer text-[11px] ${
                      dipilih ? 'border-[#007a5a] bg-[#f0fdf9]' : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={dipilih}
                      onChange={(e) =>
                        setPilihBanyak((prev) =>
                          e.target.checked
                            ? [...prev, p.positionId]
                            : prev.filter((id) => id !== p.positionId)
                        )
                      }
                      className="mt-0.5 h-3.5 w-3.5 accent-[#007a5a]"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#0f172a] truncate">{p.title}</span>
                      <span className="block text-[10px] text-[#64748b] truncate">
                        {p.departmentName ?? '—'} · {p.mappedCount} kursus
                      </span>
                    </span>
                  </label>
                );
              })}
              {posisiTampil.length === 0 && (
                <p className="col-span-full p-2 text-[11px] text-[#64748b]">Tidak ada posisi yang cocok.</p>
              )}
            </div>
          </div>

          {pilihBanyak.length > 0 && (
            <p className="text-[11px] text-[#334155] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2">
              Pemetaan di bawah berlaku untuk{' '}
              <strong>{pilihBanyak.length === 1 ? 'posisi terpilih' : `${pilihBanyak.length} posisi terpilih`}</strong>.
              {pilihBanyak.length > 1 && ' Satu kursus akan dipetakan ke semuanya sekaligus.'}
            </p>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-bold text-[#334155]">
                Kursus Terpetakan{pilihBanyak.length > 1 ? ' (posisi pertama)' : ''}
              </h3>
              {current && current.courses.length > 0 && (
                <p className="text-[10px] text-[#64748b]">
                  AI sudah menyiapkan kursus &amp; materi OER gratis. Anda dapat menyesuaikannya.
                </p>
              )}
            </div>
            {!current || current.courses.length === 0 ? (
              <p className="text-xs text-[#64748b] bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-xl px-3 py-4">
                Belum ada kursus. Pilih posisi lalu klik <strong>Generate dengan AI</strong> — kursus dan materi
                OER gratis akan dibuat otomatis sesuai kebutuhan posisi.
              </p>
            ) : (
              <div className="space-y-2">
                {current.courses.map((c) => {
                  const sedangEdit = editKursusId === c.courseId;
                  const sedangBuka = bukaModul === c.courseId;
                  return (
                    <div key={c.courseId} className="rounded-xl border border-[#e2e8f0] bg-white">
                      <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-[#0f172a] truncate">{c.title}</div>
                          <div className="text-[10px] text-[#64748b] font-mono">
                            {c.courseCode} · {c.category ?? 'Umum'} · {c.defaultHours} jam
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void bukaMateri(c.courseId)}
                            className="text-[10px] font-bold px-2 py-1 rounded border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc]"
                          >
                            {sedangBuka ? 'Tutup materi' : 'Materi'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditKursusId(sedangEdit ? null : c.courseId);
                              setEditKursus({
                                title: c.title,
                                category: c.category ?? '',
                                hours: String(c.defaultHours),
                              });
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMandatory(c)}
                            disabled={busy}
                            className={`text-[10px] font-bold px-2 py-1 rounded ${c.isMandatory ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-[#f1f5f9] text-[#64748b]'}`}
                          >
                            {c.isMandatory ? 'WAJIB' : 'OPSIONAL'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMapping(c.courseId)}
                            disabled={busy}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-[#fef2f2] text-[#b91c1c]"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      {/* Form ubah kursus */}
                      {sedangEdit && (
                        <div className="border-t border-[#f1f5f9] px-3 py-2.5 space-y-2 bg-[#fbfdfc]">
                          <input
                            value={editKursus.title}
                            onChange={(e) => setEditKursus({ ...editKursus, title: e.target.value })}
                            placeholder="Judul kursus"
                            className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[12px]"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={editKursus.category}
                              onChange={(e) => setEditKursus({ ...editKursus, category: e.target.value })}
                              placeholder="Kategori"
                              className="rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[12px]"
                            />
                            <input
                              type="number"
                              min="0"
                              value={editKursus.hours}
                              onChange={(e) => setEditKursus({ ...editKursus, hours: e.target.value })}
                              placeholder="Jam belajar"
                              className="rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[12px]"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void simpanEditKursus(c.courseId)}
                              disabled={busy || !editKursus.title.trim()}
                              className="rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                            >
                              Simpan kursus
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditKursusId(null)}
                              className="rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-[11px] font-semibold text-[#475569]"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Daftar materi/OER kursus + tambah materi sendiri */}
                      {sedangBuka && (
                        <div className="border-t border-[#f1f5f9] px-3 py-2.5 space-y-2">
                          {modulLoading ? (
                            <p className="text-[11px] text-[#64748b]">Memuat materi…</p>
                          ) : modulList.length === 0 ? (
                            <p className="text-[11px] text-[#64748b]">Belum ada materi pada kursus ini.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {modulList.map((m) => (
                                <li key={m.id} className="flex items-start justify-between gap-2 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-[#0f172a] truncate">{m.title}</p>
                                    <p className="text-[10px] text-[#64748b]">
                                      {m.contentType}
                                      {m.contentUrl ? (
                                        <>
                                          {' · '}
                                          <a
                                            href={m.contentUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[#007a5a] underline break-all"
                                          >
                                            buka materi
                                          </a>
                                        </>
                                      ) : (
                                        ' · tanpa tautan'
                                      )}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => mulaiEditModul(m)}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded border border-[#e2e8f0] text-[#334155] shrink-0"
                                  >
                                    Edit
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Form materi: tambah baru atau ubah yang dipilih.
                              Tiga sumber materi: unggah berkas sendiri, tautan
                              manual, atau pilih dari hasil pencarian OER. */}
                          <div className="rounded-lg border border-[#e2e8f0] bg-[#fbfdfc] p-2.5 space-y-1.5">
                            <p className="text-[10px] font-bold text-[#334155]">
                              {editModulId ? 'Ubah materi' : 'Tambah materi'}
                            </p>
                            <input
                              value={modulForm.title}
                              onChange={(e) => setModulForm({ ...modulForm, title: e.target.value })}
                              placeholder="Judul materi"
                              className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[12px]"
                            />

                            {/* Sumber A: unggah berkas sendiri */}
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#334155] cursor-pointer">
                                <Upload className="h-3 w-3" />
                                {unggahNama || 'Unggah materi (PDF/video/slide)'}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.mp4,.webm,.png,.jpg,.jpeg,.pptx,.docx"
                                  onChange={(e) => void unggahMateri(e.target.files?.[0] ?? null)}
                                />
                              </label>
                              {unggahBusy && <span className="text-[10px] text-[#64748b]">Mengunggah…</span>}
                            </div>

                            {/* Sumber B: tautan manual */}
                            <input
                              value={modulForm.contentUrl}
                              onChange={(e) => setModulForm({ ...modulForm, contentUrl: e.target.value })}
                              placeholder="…atau tempel tautan (open.edu, learn.microsoft.com, …)"
                              className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[12px]"
                            />

                            {tautanPeringatan && (
                              <p className="text-[10px] font-semibold text-[#b45309] bg-[#fffbeb] border border-[#fde68a] rounded px-2 py-1">
                                {tautanPeringatan}
                              </p>
                            )}
                            {unggahNama && (
                              <p className="text-[10px] text-[#047857]">
                                Materi terunggah: <strong>{unggahNama}</strong> (akan dipakai sebagai tautan materi)
                              </p>
                            )}

                            {/* Sumber C: pilih dari hasil pencarian OER */}
                            <div className="flex gap-1.5">
                              <input
                                value={cariMateri}
                                onChange={(e) => setCariMateri(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); void cariOer(); }
                                }}
                                placeholder="Cari materi gratis untuk posisi ini…"
                                className="flex-1 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[12px]"
                              />
                              <button
                                type="button"
                                onClick={() => void cariOer()}
                                disabled={cariBusy}
                                className="rounded-lg border border-[#007a5a] px-2.5 py-1.5 text-[11px] font-bold text-[#007a5a] disabled:opacity-50"
                              >
                                {cariBusy ? 'Mencari…' : 'Cari'}
                              </button>
                            </div>
                            {hasilCari.length > 0 && (
                              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-[#e2e8f0] bg-white p-1.5">
                                {hasilCari.map((r) => (
                                  <button
                                    key={r.url}
                                    type="button"
                                    onClick={() =>
                                      setModulForm({
                                        title: modulForm.title || r.title,
                                        contentUrl: r.url,
                                      })
                                    }
                                    className="block w-full text-left rounded px-2 py-1 hover:bg-[#f0fdf9]"
                                  >
                                    <span className="block text-[11px] font-semibold text-[#0f172a] truncate">{r.title}</span>
                                    <span className="block text-[10px] text-[#64748b] truncate">{r.provider} · {r.url}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void simpanMateri(c.courseId)}
                                disabled={busy || !modulForm.title.trim() || !(modulForm.contentUrl.trim() || unggahNama)}
                                className="rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                              >
                                {editModulId ? 'Simpan materi' : 'Tambah materi'}
                              </button>
                              {editModulId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditModulId(null);
                                    setModulForm({ title: '', contentUrl: '' });
                                    setUnggahNama(null);
                                    setTautanPeringatan(null);
                                  }}
                                  className="rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-[11px] font-semibold text-[#475569]"
                                >
                                  Batal
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-[#94a3b8]">
                              Tautan divalidasi otomatis: harus halaman resmi penyedia tepercaya,
                              tidak berbayar, dan tidak kosong.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kursus baru ditambahkan lewat "Generate dengan AI" (otomatis
              sesuai posisi & kebutuhan) atau lewat form materi di bawah.
              Katalog manual lama sengaja dihapus agar alurnya sederhana. */}

        </>
      )}
    </div>
  );
}
