import { describe, it, expect } from 'vitest';
import {
  OER_CATALOG,
  TRUSTED_OER_DOMAINS,
  SCRAPE_ALLOWED_DOMAINS,
  isTrustedOerUrl,
  bolehDiambilOtomatis,
  validateModuleUrl,
  matchOerResources,
} from '@/lib/services/oerCatalogService';
import { alasanTidakDiambilOtomatis } from '@/lib/services/oerFetcherService';

describe('whitelist OER diperluas', () => {
  it('memuat penyedia OER & industri yang mapan', () => {
    for (const d of [
      'open.edu', 'ocw.mit.edu', 'openstax.org', 'oercommons.org',
      'learn.microsoft.com', 'aws.amazon.com', 'skillshop.exceedlms.com',
      'skillsbuild.org', 'alison.com', 'coursera.org', 'edx.org',
      'moodleshare.org', 'moodle.net', 'class-central.com',
    ]) {
      expect(TRUSTED_OER_DOMAINS, d).toContain(d);
    }
  });

  it('menerima URL resmi penyedia', () => {
    expect(isTrustedOerUrl('https://www.open.edu/openlearn/x')).toBe(true);
    expect(isTrustedOerUrl('https://learn.microsoft.com/id-id/training/')).toBe(true);
    expect(isTrustedOerUrl('https://skillsbuild.org/students/course-catalog')).toBe(true);
    expect(isTrustedOerUrl('https://alison.com/courses')).toBe(true);
  });

  it('menolak domain asing, http, dan skema lain', () => {
    expect(isTrustedOerUrl('https://situs-asing.example.com/kursus')).toBe(false);
    expect(isTrustedOerUrl('http://www.open.edu/openlearn')).toBe(false);
    expect(isTrustedOerUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedOerUrl('bukan-url')).toBe(false);
  });

  it('hanya sumber ber-API publik yang boleh diambil otomatis', () => {
    expect(SCRAPE_ALLOWED_DOMAINS.length).toBeGreaterThan(0);
    expect(bolehDiambilOtomatis('https://api.openverse.org/v1/images/?q=x')).toBe(true);
    expect(bolehDiambilOtomatis('https://archive.org/details/x')).toBe(true);
    // Penyedia yang melarang scraping.
    expect(bolehDiambilOtomatis('https://www.coursera.org/learn/x')).toBe(false);
    expect(bolehDiambilOtomatis('https://www.udemy.com/course/x')).toBe(false);
    expect(bolehDiambilOtomatis('https://aws.amazon.com/training/')).toBe(false);

    expect(alasanTidakDiambilOtomatis('https://www.coursera.org/learn/x')).toMatch(/ditautkan|tidak mengizinkan/i);
  });
});

describe('katalog OER per posisi', () => {
  it('seluruh entri katalog berasal dari domain tepercaya', () => {
    const luar = OER_CATALOG.filter((r) => !isTrustedOerUrl(r.url)).map((r) => r.url);
    expect(luar, `URL di luar whitelist: ${luar.join(' | ')}`).toEqual([]);
  });

  it('memuat kursus, kuis/asesmen, dan sertifikat gratis', () => {
    const semua = OER_CATALOG.map((r) => `${r.title} ${r.topics.join(' ')}`).join(' ').toLowerCase();
    expect(semua).toMatch(/sertifikat|certificate/);
    expect(semua).toMatch(/kuis|asesmen|assessment/);
    expect(semua).toMatch(/kursus|course/);
  });

  it('setiap posisi di aplikasi mendapat materi', () => {
    const posisi = [
      'Chief Executive Officer (CEO)', 'Chief Internal Auditor', 'Risk & Governance Compliance Analyst',
      'VP of Human Capital', 'Compensation & Benefit Specialist', 'HR System Administrator',
      'Learning & Organizational Development Specialist', 'Senior Talent Acquisition Lead',
      'Lead Talent Assessor & Facilitator', 'Head of Engineering & Ops', 'Senior Software Engineer',
      'Junior Software Engineer (Internship)', 'Lead Cloud & DevOps Engineer',
      'Cyber Security & IT Governance Specialist', 'Data Engineer & Analytics Specialist',
      'Mobile Application Developer', 'Lead UI/UX & Product Designer',
      'Technical Support & Operations Specialist',
    ];
    const tanpaMateri: string[] = [];
    for (const p of posisi) {
      if (matchOerResources([p.replace(/[(),]/g, ' ')], 3).length === 0) tanpaMateri.push(p);
    }
    expect(tanpaMateri, `posisi tanpa materi: ${tanpaMateri.join(', ')}`).toEqual([]);
  });

  it('materi tiap posisi relevan (bukan sekadar fallback)', () => {
    const hr = matchOerResources(['compensation benefit'], 3);
    expect(hr.some((r) => /kompensasi|payroll|reward/i.test(r.title + r.topics.join(' ')))).toBe(true);

    const audit = matchOerResources(['internal auditor'], 3);
    expect(audit.some((r) => /audit/i.test(r.title + r.topics.join(' ')))).toBe(true);

    const devops = matchOerResources(['lead cloud devops'], 3);
    expect(devops.some((r) => /devops|cloud|kubernetes/i.test(r.title + r.topics.join(' ')))).toBe(true);
  });
});

describe('validasi tautan modul', () => {
  it('tautan VIDEO/PDF wajib dari domain tepercaya', () => {
    expect(validateModuleUrl('VIDEO', 'https://ocw.mit.edu/courses/x').ok).toBe(true);
    expect(validateModuleUrl('VIDEO', 'https://situs-asing.example.com/x').ok).toBe(false);
    expect(validateModuleUrl('PDF', '').ok).toBe(false);
  });

  it('tipe lain boleh tanpa tautan', () => {
    expect(validateModuleUrl('TEXT', null).ok).toBe(true);
  });
});
