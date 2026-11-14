'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Users,
  Target,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Sparkles,
} from 'lucide-react';

interface CascadeNode {
  id: string;
  title: string;
  level: 'CORPORATE' | 'DIVISION' | 'MANAGER' | 'POSITION';
  code: string;
  targetValue: number;
  weightPct?: number;
  owner: string | null;
  children: CascadeNode[];
}

interface CascadeIntegrity {
  tersambung: unknown[];
  putus: Array<{ kode: string; judul: string; tingkat: string; alasan: string }>;
  kedalamanMaksimal: number;
  kesimpulan: string;
}

/**
 * "Alur KPI Berjenjang" — peta turunan KPI end-to-end:
 *   Visi & Misi (BOD) → KPI Korporat → KPI Divisi (HR)
 *     → KPI People Manager → KPI Posisi → KPI Individu.
 *
 * Panel ini sengaja disambungkan ke "Indikator Pencapaian Target" supaya pengguna
 * dapat memahami bagaimana target karyawan tersambung sampai visi & misi.
 */
export default function KpiCascadePanel({ onClose }: { onClose?: () => void }) {
  const [tree, setTree] = useState<CascadeNode[]>([]);
  const [integritas, setIntegritas] = useState<CascadeIntegrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [treeRes, intRes] = await Promise.all([
        fetch('/api/v1/performance/kpi-cascade/tree'),
        fetch('/api/v1/performance/kpi-cascade/integrity'),
      ]);
      const treeJson = await treeRes.json().catch(() => ({}));
      const intJson = await intRes.json().catch(() => ({}));
      if (treeRes.ok) setTree(treeJson?.data?.items ?? []);
      if (intRes.ok) setIntegritas(intJson?.data ?? null);
      if (!treeRes.ok) setError(treeJson?.detail || 'Gagal memuat alur KPI berjenjang.');
    } catch {
      setError('Gagal memuat alur KPI berjenjang.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setLoading(true);
    try {
      await fetch('/api/v1/performance/kpi-cascade/corporate/generate', { method: 'POST' });
      await load();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-indigo-600" />
          Alur KPI Berjenjang: BOD → HR → People Manager → Posisi → Pegawai
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            Susun dari Visi &amp; Misi
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#64748b] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] text-[#475569] text-[11px] font-semibold hover:bg-[#f8fafc] cursor-pointer"
            >
              Tutup
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Pita integritas */}
      {integritas && (
        <div
          className={`rounded-xl border px-3 py-2.5 flex items-start gap-2 ${
            (integritas.putus?.length ?? 0) === 0
              ? 'bg-[#ecfdf5] border-[#a7f3d0]'
              : 'bg-[#fffbeb] border-[#fde68a]'
          }`}
        >
          {(integritas.putus?.length ?? 0) === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-[#059669] flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[#d97706] flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p
              className={`text-xs font-bold ${
                (integritas.putus?.length ?? 0) === 0 ? 'text-[#065f46]' : 'text-[#92400e]'
              }`}
            >
              {integritas.kesimpulan}
            </p>
            {(integritas.putus?.length ?? 0) > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {integritas.putus.slice(0, 5).map((p) => (
                  <li key={p.kode} className="text-[10px] text-[#92400e]">
                    • {p.judul} ({p.tingkat}) — {p.alasan}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Pohon cascade */}
      {loading ? (
        <p className="text-[11px] text-[#64748b]">Memuat peta KPI berjenjang…</p>
      ) : tree.length === 0 ? (
        <p className="text-[11px] text-[#64748b] bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg p-3">
          Belum ada KPI korporat. Gunakan tombol Susun dari Visi &amp; Misi untuk memulai.
        </p>
      ) : (
        <div className="space-y-3">
          {tree.map((node) => (
            <CascadeBranch key={node.id} node={node} depth={0} expanded={expanded} setExpanded={setExpanded} />
          ))}
        </div>
      )}
    </div>
  );
}

function CascadeBranch({
  node,
  depth,
  expanded,
  setExpanded,
}: {
  node: CascadeNode;
  depth: number;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const isOpen = expanded[node.id] ?? depth < 2;
  const [icon, label] =
    node.level === 'CORPORATE'
      ? [Target, 'Korporat (BOD)']
      : node.level === 'DIVISION'
      ? [Building2, 'Divisi (HR)']
      : node.level === 'MANAGER'
      ? [Users, 'People Manager']
      : [Target, 'Posisi'];

  const Icon = icon;
  return (
    <div style={{ marginLeft: depth * 18 }} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 text-[#007a5a] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#0f172a] truncate">{node.title}</p>
            <p className="text-[10px] text-[#64748b] truncate">
              {label} · Target {node.targetValue}
              {node.owner ? ` · ${node.owner}` : ''}
              {node.weightPct != null ? ` · Bobot ${node.weightPct}%` : ''}
            </p>
          </div>
        </div>
        {node.children.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => ({ ...e, [node.id]: !(e[node.id] ?? depth < 2) }))}
            className="text-[10px] font-bold text-[#007a5a] hover:underline cursor-pointer flex-shrink-0"
          >
            {node.children.length} turunan
          </button>
        )}
      </div>
      {isOpen && node.children.length > 0 && (
        <div className="space-y-1.5">
          {node.children.map((c) => (
            <CascadeBranch key={c.id} node={c} depth={depth + 1} expanded={expanded} setExpanded={setExpanded} />
          ))}
        </div>
      )}
    </div>
  );
}
