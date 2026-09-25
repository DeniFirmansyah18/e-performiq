'use client';

import React from 'react';
import { Compass, GraduationCap, ArrowRight, CheckCircle2, Award, ExternalLink } from 'lucide-react';

interface CareerPathModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CareerPathModal({ isOpen, onClose }: CareerPathModalProps) {
  if (!isOpen) return null;

  const careerSteps = [
    {
      title: 'Junior Software Engineer',
      level: 'Grade 7',
      status: 'COMPLETED',
      desc: 'Penguasaan dasar arsitektur web dan kepatuhan unit testing.',
    },
    {
      title: 'Senior Software Engineer (Posisi Saat Ini)',
      level: 'Grade 9',
      status: 'CURRENT',
      desc: 'Penyusunan microservices terdistribusi, optimasi database, dan mentoring junior.',
    },
    {
      title: 'Lead Systems Architect / Tech Lead',
      level: 'Grade 11 (Target Berikutnya)',
      status: 'NEXT',
      desc: 'Desain skalabilitas sistem level enterprise, tata kelola keamanan AES-256, & suksesi 9-Box.',
      requirements: [
        'Minimal Composite GPA: 3.50',
        'Masa kerja posisi saat ini: Minimal 18 bulan',
        'Sertifikasi Moodle Wajib: Cloud Infrastructure & Enterprise Microservices',
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600 text-white">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Peta Jenjang Karir &amp; Akademi Pelatihan</h3>
              <p className="text-[11px] text-slate-400">Kotak 2: Learning &amp; Career Ladder (ISO 30414)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Career Path Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tangga Kemajuan Karir (Job Grade Progression)
            </h4>
            <div className="space-y-3">
              {careerSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border text-xs ${
                    step.status === 'CURRENT'
                      ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400'
                      : step.status === 'COMPLETED'
                      ? 'bg-slate-50 border-slate-200 opacity-75'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-800">{step.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        step.status === 'CURRENT'
                          ? 'bg-emerald-600 text-white'
                          : step.status === 'COMPLETED'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {step.level}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1 leading-relaxed">{step.desc}</p>

                  {step.requirements && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                      <span className="font-bold text-slate-700 block text-[11px]">
                        Syarat Kelayakan Promosi:
                      </span>
                      {step.requirements.map((req, rIdx) => (
                        <div key={rIdx} className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                          <span>{req}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Moodle LMS Module Self-Enrollment Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                <h5 className="font-bold text-xs text-slate-800">Modul Rekomendasi Moodle SSO</h5>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Target 24 Jam/Tahun (ISO 30414)
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Daftar mandiri ke modul pelatihan untuk menutup celah kompetensi dan mempercepat kenaikan pangkat Anda.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-700">Course #101: Enterprise Cloud Architecture</span>
              <button
                onClick={() => alert('Berhasil mendaftar ke modul Moodle Course #101 via LTI SSO.')}
                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
              >
                Daftar Mandiri
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
