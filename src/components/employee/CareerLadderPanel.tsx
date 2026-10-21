'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

interface Step {
  stepId: string;
  stepName: string;
  requirementType: string;
  threshold: number | null;
  actual: number;
  met: boolean;
}

interface Readiness {
  targetPositionId: string | null;
  percent: number;
  met: number;
  total: number;
}

export default function CareerLadderPanel() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/me/career-ladder')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active) return;
        setSteps(j?.data?.steps ?? []);
        setReadiness(j?.data?.readiness ?? null);
      })
      .catch(() => { /* biarkan kosong */ })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  if (!loaded) {
    return (
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-xs text-[#64748b]">
        Memuat jenjang karir…
      </section>
    );
  }

  if (!readiness || readiness.total === 0) {
    return (
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <h2 className="text-sm font-extrabold text-[#0f172a]">Jenjang Karir Terukur</h2>
        <p className="mt-2 text-xs text-[#64748b]">
          Belum ada tahapan karir yang ditetapkan untuk posisi Anda. Hubungi HRD.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Jenjang Karir Terukur</h2>
      <p className="mt-1 text-xs text-[#475569]">
        Kesiapan <span className="font-extrabold text-[#0f172a]">{readiness.percent}%</span>
        {' · '}{readiness.met} dari {readiness.total} tahapan terpenuhi
      </p>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]"
        role="progressbar"
        aria-valuenow={readiness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Kesiapan jenjang karir"
      >
        <div className="h-full rounded-full bg-[#007a5a]" style={{ width: `${readiness.percent}%` }} />
      </div>

      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.stepId} className="flex items-start gap-2 rounded-xl border border-[#e2e8f0] p-2.5">
            {s.met
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#007a5a]" aria-hidden="true" />
              : <CircleDashed className="mt-0.5 h-4 w-4 text-[#94a3b8]" aria-hidden="true" />}
            <div>
              <p className="text-xs font-bold text-[#0f172a]">{s.stepName}</p>
              <p className="text-[11px] text-[#64748b]">
                {s.met ? 'Terpenuhi' : 'Belum terpenuhi'} · {s.actual}
                {s.threshold !== null ? ` / ${s.threshold}` : ''} · {s.requirementType}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
