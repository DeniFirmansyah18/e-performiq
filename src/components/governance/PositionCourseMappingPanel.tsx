'use client';

import React, { useCallback, useEffect, useState } from 'react';

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

interface OerResource { title: string; url: string; provider: string; format?: string; level?: string | null; aiRecommended?: boolean }

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [pickCourse, setPickCourse] = useState<string>('');
  const [oerQuery, setOerQuery] = useState('');
  const [oerResults, setOerResults] = useState<OerResource[] | null>(null);
  const [oerBusy, setOerBusy] = useState(false);
  const [oerErr, setOerErr] = useState<string | null>(null);
  const [oerAiUsed, setOerAiUsed] = useState(false);

  // Form katalog kursus manual.
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catTitle, setCatTitle] = useState('');
  const [catCategory, setCatCategory] = useState('');
  const [catHours, setCatHours] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catMandatory, setCatMandatory] = useState(true);
  const [catBusy, setCatBusy] = useState(false);

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

  async function addMapping(courseId: number, isMandatory = true) {
    if (tujuanPemetaan.length === 0) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      // Bila lebih dari satu posisi dicentang, kursus dipetakan ke semuanya.
      if (tujuanPemetaan.length > 1) {
        await petakanKeSemua(courseId, isMandatory);
        setMsg(`Kursus dipetakan ke ${tujuanPemetaan.length} posisi.`);
        setPickCourse('');
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
      setPickCourse('');
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
    if (!selected) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch('/api/v1/learning/position-courses/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: selected, useAi: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal generate kurikulum.'); return; }
      setMsg(`${json?.message ?? 'Kurikulum dibuat.'} (${json?.data?.modules?.length ?? 0} modul, ${json?.data?.oerCount ?? 0} materi OER)`);
      await load();
    } catch {
      setErr('Gagal generate kurikulum.');
    } finally { setBusy(false); }
  }

  async function searchOer() {
    const q = oerQuery.trim();
    setOerBusy(true);
    setOerErr(null);
    setOerResults(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (selected) params.set('positionId', selected);
      const res = await fetch(`/api/v1/learning/oer?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOerErr('Gagal mencari materi OER.');
        return;
      }
      setOerAiUsed(!!json.data?.aiUsed);
      setOerResults(Array.isArray(json.data?.results) ? json.data.results : []);
    } catch {
      setOerErr('Gagal mencari materi OER. Periksa koneksi.');
    } finally {
      setOerBusy(false);
    }
  }

  async function createCatalogCourse() {
    const title = catTitle.trim();
    if (!title) { setErr('Judul kursus wajib diisi.'); return; }
    setCatBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch('/api/v1/learning/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category: catCategory.trim() || null,
          description: catDesc.trim() || null,
          defaultHours: catHours ? Number(catHours) : 0,
          isMandatory: catMandatory,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal menambah kursus.'); return; }
      const newId = json?.data?.courseId;
      setMsg(`Kursus "${title}" ditambahkan ke katalog${json?.data?.courseCode ? ` (${json.data.courseCode})` : ''}.`);
      setCatTitle(''); setCatCategory(''); setCatHours(''); setCatDesc(''); setCatMandatory(true);
      await load();
      // Auto-petakan ke posisi terpilih.
      if (newId && selected) await addMapping(Number(newId), catMandatory);
    } catch {
      setErr('Gagal menambah kursus.');
    } finally {
      setCatBusy(false);
    }
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
            <h3 className="text-xs font-bold text-[#334155] mb-2">
              Kursus Terpetakan{pilihBanyak.length > 1 ? ' (posisi pertama)' : ''}
            </h3>
            {!current || current.courses.length === 0 ? (
              <p className="text-xs text-[#64748b]">Belum ada kursus dipetakan ke posisi ini. Tambahkan dari katalog atau generate dengan AI.</p>
            ) : (
              <div className="space-y-2">
                {current.courses.map((c) => (
                  <div key={c.courseId} className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-[#0f172a] truncate">{c.title}</div>
                      <div className="text-[10px] text-[#64748b] font-mono">{c.courseCode} · {c.category ?? 'Umum'} · {c.defaultHours} jam</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#f1f5f9]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[#334155]">Tambah dari Katalog Kursus</h3>
                <button
                  type="button"
                  onClick={() => setShowCatalogForm((v) => !v)}
                  className="text-[10px] font-bold text-[#007a5a] hover:underline"
                >
                  {showCatalogForm ? 'Tutup form' : '+ Katalog kursus baru'}
                </button>
              </div>

              {showCatalogForm && (
                <div className="mb-3 rounded-xl border border-[#e2e8f0] bg-[#fbfdfc] p-3 space-y-2">
                  <input
                    value={catTitle}
                    onChange={(e) => setCatTitle(e.target.value)}
                    placeholder="Judul kursus (wajib) *"
                    className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={catCategory}
                      onChange={(e) => setCatCategory(e.target.value)}
                      placeholder="Kategori (mis. Teknis)"
                      className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
                    />
                    <input
                      value={catHours}
                      onChange={(e) => setCatHours(e.target.value)}
                      type="number"
                      min="0"
                      placeholder="Jam belajar"
                      className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
                    />
                  </div>
                  <textarea
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    rows={2}
                    placeholder="Deskripsi singkat (opsional)"
                    className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
                  />
                  <label className="flex items-center gap-2 text-[11px] text-[#334155]">
                    <input type="checkbox" checked={catMandatory} onChange={(e) => setCatMandatory(e.target.checked)} className="rounded" />
                    Wajib untuk posisi ini
                  </label>
                  <button
                    type="button"
                    onClick={() => void createCatalogCourse()}
                    disabled={catBusy || !catTitle.trim()}
                    className="rounded-lg bg-[#007a5a] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {catBusy ? 'Menyimpan…' : 'Simpan & Petakan'}
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <select
                  value={pickCourse}
                  onChange={(e) => setPickCourse(e.target.value)}
                  className="flex-1 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
                >
                  <option value="">Pilih kursus…</option>
                  {courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.title} ({c.courseCode}, {c.moduleCount} modul)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => pickCourse && addMapping(Number(pickCourse))}
                  disabled={busy || !pickCourse}
                  className="rounded-lg bg-[#0f172a] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Tambah
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#334155] mb-2">Cari Materi OER Gratis (AI)</h3>
              <p className="text-[10px] text-[#94a3b8] mb-2">Rekomendasi AI mengacu Professional Learning Module perusahaan &amp; posisi terpilih. Hasil PDF/DOC/video dari portal gratis tepercaya.</p>
              <div className="flex gap-2">
                <input
                  value={oerQuery}
                  onChange={(e) => setOerQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void searchOer(); } }}
                  placeholder="mis. typescript, leadership, k3"
                  className="flex-1 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]"
                />
                <button
                  type="button"
                  onClick={() => void searchOer()}
                  disabled={oerBusy}
                  className="rounded-lg bg-[#007a5a] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {oerBusy ? 'Mencari…' : 'Cari'}
                </button>
              </div>

              {oerErr && (
                <p className="mt-2 text-[11px] text-[#b91c1c] bg-[#fef2f2] px-2 py-1.5 rounded-lg">{oerErr}</p>
              )}

              {oerResults === null && !oerErr ? (
                <p className="mt-2 text-[10px] text-[#94a3b8]">Kotak kosong = pakai skill posisi terpilih sebagai kata kunci otomatis. Tekan Enter atau klik Cari.</p>
              ) : oerResults && oerResults.length === 0 ? (
                <p className="mt-2 text-[11px] text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] px-3 py-2 rounded-lg">
                  Tidak ada materi OER untuk &ldquo;{oerQuery.trim() || '(skill posisi)'}&rdquo;. Coba kata kunci lain seperti <em>typescript</em>, <em>cloud</em>, <em>leadership</em>, atau <em>k3</em>.
                </p>
              ) : oerResults ? (
                <>
                  <p className="mt-1.5 text-[10px] font-semibold text-[#047857]">
                    {oerAiUsed ? 'Direkomendasikan AI' : 'Dari katalog terkurasi'} · {oerResults.length} materi
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {oerResults.map((r) => (
                      <li key={r.url} className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2">
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-[#0f172a] hover:text-[#007a5a] hover:underline">
                          {r.title}
                        </a>
                        <div className="text-[10px] text-[#64748b] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-[#ecfdf5] text-[#047857] font-bold">{r.provider}</span>
                          {r.format && <span className="inline-block px-1.5 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] font-bold">{r.format}</span>}
                          {r.level && <span className="text-[#94a3b8]">{r.level}</span>}
                          <span className="break-all">{r.url}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
