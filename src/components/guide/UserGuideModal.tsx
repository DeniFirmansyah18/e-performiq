'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  X,
  Search,
  Scale,
  ShieldCheck,
  Users,
  CheckCircle2,
  ChevronDown,
  Calculator,
  Layers,
  FileText,
  AlertTriangle,
  ArrowUp,
  Filter,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import {
  FAQ_DATA,
  FAQ_CATEGORIES,
  FaqCategory,
  FaqItem,
} from './faqData';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: FaqCategory;
}

const ROLE_FILTERS = [
  { id: 'all', label: 'Semua Peran' },
  { id: 'Pemula', label: 'Khusus Pemula' },
  { id: 'Karyawan', label: 'Karyawan' },
  { id: 'Atasan', label: 'Atasan Langsung' },
  { id: 'HR', label: 'HR & People Ops' },
  { id: 'Penilai', label: 'Komite Assessor' },
  { id: 'Direksi', label: 'Direksi (C-Level)' },
  { id: 'Auditor', label: 'Auditor SPI' },
];

export default function UserGuideModal({
  isOpen,
  onClose,
  defaultCategory = 'all',
}: UserGuideModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>(defaultCategory);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'pemula-1': true,
    'konsep-1': true,
  });

  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press and prevent background page scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Set default category when prop changes
  useEffect(() => {
    if (defaultCategory) {
      setSelectedCategory(defaultCategory);
    }
  }, [defaultCategory]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      // Category match
      const matchCategory =
        selectedCategory === 'all' || item.category === selectedCategory;

      // Role filter match
      const matchRole =
        selectedRoleFilter === 'all' ||
        (item.roleTag &&
          item.roleTag.toLowerCase().includes(selectedRoleFilter.toLowerCase())) ||
        item.question.toLowerCase().includes(selectedRoleFilter.toLowerCase()) ||
        item.summary.toLowerCase().includes(selectedRoleFilter.toLowerCase());

      if (!searchQuery.trim()) {
        return matchCategory && matchRole;
      }

      const q = searchQuery.toLowerCase();
      const matchSearch =
        item.question.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        (item.roleTag && item.roleTag.toLowerCase().includes(q)) ||
        (item.detail.background && item.detail.background.toLowerCase().includes(q)) ||
        item.detail.explanation.some((exp) => exp.toLowerCase().includes(q)) ||
        (item.detail.caseStudy &&
          item.detail.caseStudy.content.some((cs) => cs.toLowerCase().includes(q))) ||
        (item.detail.steps &&
          item.detail.steps.items.some((st) => st.toLowerCase().includes(q)));

      return matchCategory && matchRole && matchSearch;
    });
  }, [selectedCategory, selectedRoleFilter, searchQuery]);

  // Auto-expand all matching items when searching
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const allIds: Record<string, boolean> = {};
      filteredFaqs.forEach((item) => {
        allIds[item.id] = true;
      });
      setExpandedIds(allIds);
    }
  }, [searchQuery, filteredFaqs]);

  const handleExpandAll = () => {
    const allIds: Record<string, boolean> = {};
    filteredFaqs.forEach((item) => {
      allIds[item.id] = true;
    });
    setExpandedIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds({});
  };

  const scrollToTop = () => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: FAQ_DATA.length,
    };
    FAQ_CATEGORIES.forEach((cat) => {
      counts[cat.id] = 0;
    });
    counts['all'] = FAQ_DATA.length;
    FAQ_DATA.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, []);

  const activeCategoryMeta = useMemo(() => {
    return (
      FAQ_CATEGORIES.find((cat) => cat.id === selectedCategory) ||
      FAQ_CATEGORIES[0]
    );
  }, [selectedCategory]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#F6F6F7] text-[#202223] w-screen h-screen overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faq-fullscreen-title"
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER - Clean Shopify Admin Dark Header (#1A1A1A, border #2D2D2D) */}
      {/* ========================================================================= */}
      <header className="bg-[#1A1A1A] text-white px-4 sm:px-6 py-3.5 border-b border-[#2D2D2D] flex-shrink-0 flex items-center justify-between gap-4">
        {/* Left: Brand Identity & Title */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <div className="p-2.5 rounded-xl bg-[#008060] text-white shadow-xs flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A3E5C2]">
                Pusat Bantuan &amp; Panduan Penggunaan
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2A2A2A] border border-[#3D3D3D] text-[#8C9196]">
                E-PerformIQ v1.0
              </span>
              <span className="hidden lg:inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#008060]/20 border border-[#008060]/50 text-[#A3E5C2]">
                Panduan Pengguna Baru
              </span>
            </div>
            <h1
              id="faq-fullscreen-title"
              className="text-base sm:text-lg font-bold text-white tracking-tight"
            >
              Panduan Lengkap Operasional &amp; Tanya Jawab
            </h1>
          </div>
        </div>

        {/* Center: Live Search Box */}
        <div className="hidden md:flex flex-1 max-w-xl mx-2">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8C9196]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari panduan, istilah, cara kerja (contoh: kuota 100%, hitung pesangon, rapor GPA, 9-box)..."
              className="w-full pl-10 pr-24 py-2 rounded-[12px] bg-[#2A2A2A] border border-[#3D3D3D] text-xs text-white placeholder-[#8C9196] focus:outline-none focus:border-[#008060] shadow-inner transition-colors"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1.5 px-2 py-1 text-[11px] font-semibold text-[#8C9196] hover:text-white bg-[#333333] hover:bg-[#3D3D3D] rounded-md transition-colors cursor-pointer"
              >
                Bersihkan
              </button>
            ) : (
              <span className="absolute right-3 top-2 text-[10px] font-mono text-[#8C9196] bg-[#222222] px-1.5 py-0.5 rounded border border-[#333333]">
                Pencarian Cepat
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons & Close */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 bg-[#2A2A2A] p-1 rounded-xl border border-[#3D3D3D] text-xs">
            <button
              onClick={handleExpandAll}
              className="px-2.5 py-1 text-xs font-semibold text-[#8C9196] hover:text-white hover:bg-[#333333] rounded-lg transition-colors cursor-pointer"
              title="Buka seluruh rincian penjelasan"
            >
              Buka Semua
            </button>
            <span className="text-[#3D3D3D]">|</span>
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1 text-xs font-semibold text-[#8C9196] hover:text-white hover:bg-[#333333] rounded-lg transition-colors cursor-pointer"
              title="Tutup seluruh rincian penjelasan"
            >
              Tutup Semua
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#2A2A2A] hover:bg-[#333333] border border-[#3D3D3D] text-white text-xs font-bold transition-all cursor-pointer shadow-xs group"
            aria-label="Tutup Pusat Panduan"
            title="Tutup Panduan (Tombol Esc)"
          >
            <X className="h-4 w-4 text-[#8C9196] group-hover:text-white transition-colors" />
            <span>Tutup Panduan</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-[#1A1A1A] border border-[#3D3D3D] rounded text-[#8C9196] font-mono">
              Esc
            </kbd>
          </button>
        </div>
      </header>

      {/* Mobile Search Bar (Visible only on small screens) */}
      <div className="md:hidden px-4 py-2.5 bg-[#202223] border-b border-[#2D2D2D] flex-shrink-0">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#8C9196]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari topik panduan atau kata kunci..."
            className="w-full pl-10 pr-20 py-2 rounded-[12px] bg-[#2A2A2A] border border-[#3D3D3D] text-xs text-white placeholder-[#8C9196] focus:outline-none focus:border-[#008060]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1.5 px-2 py-0.5 text-[11px] font-semibold text-[#8C9196] hover:text-white bg-[#333333] rounded-md"
            >
              Hapus
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN BODY: 2-COLUMN SPLIT READER VIEW (SIDEBAR NAV + MAIN READER)     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* A. LEFT SIDEBAR NAVIGATION (Desktop) */}
        <aside className="w-72 lg:w-80 bg-white border-r border-[#E1E3E5] flex flex-col flex-shrink-0 overflow-y-auto hidden md:flex">
          {/* Category Navigation Header */}
          <div className="p-4 border-b border-[#E1E3E5] bg-[#F6F6F7]/50">
            <div className="flex items-center justify-between text-xs font-bold text-[#6D7175] uppercase tracking-wider">
              <span>Daftar Kategori Panduan</span>
              <span className="font-mono text-[#008060] bg-[#E3F1DF] px-2 py-0.5 rounded-full text-[10px]">
                {FAQ_DATA.length} Topik
              </span>
            </div>
          </div>

          {/* Category List */}
          <div className="p-3 space-y-1.5 flex-1">
            {FAQ_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id as FaqCategory);
                    scrollToTop();
                  }}
                  className={`w-full text-left p-3 rounded-[12px] transition-all cursor-pointer flex items-start justify-between gap-2.5 group ${
                    isSelected
                      ? 'bg-[#008060] text-white shadow-xs font-semibold'
                      : 'text-[#202223] hover:bg-[#F6F6F7] border border-transparent hover:border-[#E1E3E5]'
                  }`}
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-white' : 'text-[#202223]'
                        }`}
                      >
                        {cat.label}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-[#F1F1F1] text-[#6D7175] group-hover:bg-[#E1E3E5]'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] line-clamp-1 leading-snug ${
                        isSelected ? 'text-[#E3F1DF]' : 'text-[#6D7175]'
                      }`}
                    >
                      {cat.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Role Filter Pill Box */}
          <div className="p-4 border-t border-[#E1E3E5] bg-[#F6F6F7]/60 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6D7175]">
              <Filter className="h-3.5 w-3.5 text-[#008060]" />
              <span>Saring Berdasarkan Peran</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_FILTERS.map((rf) => {
                const isActive = selectedRoleFilter === rf.id;
                return (
                  <button
                    key={rf.id}
                    onClick={() => setSelectedRoleFilter(rf.id)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#202223] text-white shadow-xs'
                        : 'bg-white text-[#6D7175] border border-[#E1E3E5] hover:bg-[#F1F1F1] hover:text-[#202223]'
                    }`}
                  >
                    {rf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Footer Info Card */}
          <div className="p-4 border-t border-[#E1E3E5] bg-white">
            <div className="p-3 rounded-xl bg-[#E3F1DF]/50 border border-[#B4E3B2] flex items-start gap-2.5 text-xs">
              <HelpCircle className="h-4 w-4 text-[#008060] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-[#008060] font-bold block text-[11px]">
                  Butuh Simulasi Angka?
                </strong>
                <p className="text-[11px] text-[#202223] leading-relaxed">
                  Gunakan tombol kalkulator interaktif langsung pada menu dashboard untuk menghitung pesangon atau IPK GPA.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* B. RIGHT MAIN READER CANVAS */}
        <main
          ref={contentScrollRef}
          className="flex-1 h-full overflow-y-auto bg-[#F6F6F7] p-4 sm:p-6 lg:p-8"
        >
          <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-4 pb-20">
            {/* Mobile Category Pill Selector (Horizontal Bar on small screens) */}
            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {FAQ_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as FaqCategory)}
                    className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#008060] text-white shadow-xs'
                        : 'bg-white text-[#6D7175] border border-[#E1E3E5]'
                    }`}
                  >
                    {cat.label} ({categoryCounts[cat.id] || 0})
                  </button>
                );
              })}
            </div>

            {/* Active Category Header Banner Card */}
            <div className="p-5 sm:p-6 rounded-[20px] bg-white border border-[#E1E3E5] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#008060] bg-[#E3F1DF] px-2.5 py-0.5 rounded-full border border-[#B4E3B2]">
                    Kategori Aktif
                  </span>
                  {selectedRoleFilter !== 'all' && (
                    <span className="text-[11px] font-semibold text-[#202223] bg-[#F1F1F1] px-2 py-0.5 rounded-full border border-[#E1E3E5]">
                      Peran: {selectedRoleFilter}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#202223] tracking-tight">
                  {activeCategoryMeta.label}
                </h2>
                <p className="text-xs sm:text-sm text-[#6D7175] leading-relaxed">
                  {activeCategoryMeta.description}
                </p>
              </div>

              {/* Status counter & Reset button */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E1E3E5]">
                <span className="text-xs font-bold text-[#202223] bg-[#F6F6F7] px-3 py-1.5 rounded-lg border border-[#E1E3E5]">
                  {filteredFaqs.length} Topik Tersedia
                </span>
                {(searchQuery || selectedRoleFilter !== 'all' || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRoleFilter('all');
                      setSelectedCategory('all');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-[#008060] hover:underline font-semibold cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset Semua Filter
                  </button>
                )}
              </div>
            </div>

            {/* FAQ CARDS LIST */}
            {filteredFaqs.length > 0 ? (
              <div className="space-y-3.5">
                {filteredFaqs.map((faq, index) => {
                  const isExpanded = !!expandedIds[faq.id];

                  return (
                    <div
                      key={faq.id}
                      className={`rounded-[16px] border transition-all duration-150 overflow-hidden bg-white ${
                        isExpanded
                          ? 'border-[#C9CCCF] border-l-4 border-l-[#008060] shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
                          : 'border-[#E1E3E5] hover:border-[#C9CCCF] shadow-xs'
                      }`}
                    >
                      {/* Accordion Header Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(faq.id)}
                        className="w-full p-4 sm:p-5 text-left flex items-start justify-between gap-4 cursor-pointer select-none transition-colors hover:bg-[#F6F6F7]/50"
                        aria-expanded={isExpanded}
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#008060] bg-[#E3F1DF] px-2 py-0.5 rounded-md">
                              Q{index + 1}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${faq.categoryColor}`}
                            >
                              {faq.categoryLabel}
                            </span>
                            {faq.roleTag && (
                              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded bg-[#F1F1F1] text-[#202223] border border-[#E1E3E5]">
                                {faq.roleTag}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-[#202223] leading-snug">
                            {faq.question}
                          </h3>

                          {!isExpanded && (
                            <p className="text-xs sm:text-sm text-[#6D7175] line-clamp-1 leading-relaxed">
                              {faq.summary}
                            </p>
                          )}
                        </div>

                        <div
                          className={`p-2 rounded-[10px] border flex-shrink-0 transition-transform duration-200 mt-1 ${
                            isExpanded
                              ? 'bg-[#008060] text-white border-[#008060] rotate-180'
                              : 'bg-[#F6F6F7] text-[#6D7175] border-[#E1E3E5]'
                          }`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </button>

                      {/* Accordion Detail Body (Expanded) */}
                      {isExpanded && (
                        <div className="px-5 sm:px-7 pb-6 pt-2 space-y-4 border-t border-[#E1E3E5] bg-white text-sm text-[#202223] leading-relaxed animate-in fade-in duration-150">
                          {/* Summary Tagline */}
                          <div className="p-3 rounded-[12px] bg-[#F6F6F7] border border-[#E1E3E5] flex items-center gap-2 text-xs text-[#202223] font-medium">
                            <span className="font-bold text-[#008060]">Intisari:</span>
                            <span>{faq.summary}</span>
                          </div>

                          {/* 1. Latar Belakang / Konteks Kebutuhan */}
                          {faq.detail.background && (
                            <div className="p-4 rounded-[12px] bg-[#F6F6F7]/80 border border-[#E1E3E5] space-y-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6D7175] block">
                                Konteks &amp; Latar Belakang:
                              </span>
                              <p className="text-[#6D7175] text-xs sm:text-sm leading-relaxed">
                                {faq.detail.background}
                              </p>
                            </div>
                          )}

                          {/* 2. Main Explanation */}
                          <div className="space-y-2.5">
                            <span className="text-xs font-bold text-[#202223] uppercase tracking-wider block">
                              Penjelasan Terperinci:
                            </span>
                            <div className="space-y-2 text-[#202223] text-xs sm:text-sm">
                              {faq.detail.explanation.map((paragraph, pIdx) => (
                                <p key={pIdx} className="leading-relaxed">
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          </div>

                          {/* 3. Contoh Kasus Nyata / Simulasi Angka */}
                          {faq.detail.caseStudy && (
                            <div className="p-4 sm:p-5 rounded-[14px] bg-[#F4F9F6] border border-[#D4E8DF] border-l-4 border-l-[#008060] space-y-2.5">
                              <div className="flex items-center gap-2 text-[#008060] font-bold text-xs sm:text-sm">
                                <Calculator className="h-4 w-4" />
                                <span>Contoh Kasus Nyata: {faq.detail.caseStudy.title}</span>
                              </div>
                              <div className="space-y-1.5 text-xs sm:text-sm text-[#202223]">
                                {faq.detail.caseStudy.content.map((csText, csIdx) => (
                                  <p key={csIdx} className="leading-relaxed">
                                    {csText}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4. Langkah Praktis di Aplikasi */}
                          {faq.detail.steps && (
                            <div className="p-4 sm:p-5 rounded-[14px] bg-[#F6F6F7] border border-[#E1E3E5] space-y-3">
                              <div className="flex items-center gap-2 text-[#202223] font-bold text-xs sm:text-sm">
                                <CheckCircle2 className="h-4 w-4 text-[#008060]" />
                                <span>{faq.detail.steps.title}</span>
                              </div>
                              <ol className="space-y-2.5 text-xs sm:text-sm text-[#202223]">
                                {faq.detail.steps.items.map((stepText, sIdx) => (
                                  <li key={sIdx} className="flex items-start gap-3 leading-relaxed">
                                    <span className="flex h-5 w-5 rounded-full bg-[#008060] text-white text-[11px] font-bold items-center justify-center flex-shrink-0 mt-0.5">
                                      {sIdx + 1}
                                    </span>
                                    <span>{stepText}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {/* 5. Catatan Penting Pemula */}
                          {faq.detail.importantNote && (
                            <div className="p-4 rounded-[12px] bg-[#FFF8E5] border border-[#FEDB87] flex items-start gap-3 text-[#5C4500] text-xs sm:text-sm">
                              <AlertTriangle className="h-5 w-5 text-[#B98900] flex-shrink-0 mt-0.5" />
                              <div>
                                <strong className="block font-bold text-xs sm:text-sm">
                                  Catatan Penting:
                                </strong>
                                <p className="text-xs sm:text-sm text-[#5C4500] mt-0.5 leading-relaxed">
                                  {faq.detail.importantNote}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 6. Legal Basis / Standar Sah */}
                          {faq.detail.legalBasis && (
                            <div className="flex items-center gap-2 pt-3 border-t border-[#E1E3E5] text-xs text-[#6D7175] font-medium">
                              <Scale className="h-4 w-4 text-[#008060] flex-shrink-0" />
                              <span>
                                <strong>Rujukan Sah &amp; Standar:</strong> {faq.detail.legalBasis}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty Search Result */
              <div className="p-10 text-center bg-white rounded-[24px] border border-[#E1E3E5] space-y-4">
                  <div className="inline-flex p-4 rounded-full bg-[#F6F6F7] text-[#6D7175]">
                    <Search className="h-8 w-8" />
                  </div>
                  <h4 className="text-lg font-bold text-[#202223]">
                    Tidak ditemukan panduan yang cocok
                  </h4>
                  <p className="text-xs sm:text-sm text-[#6D7175] max-w-md mx-auto leading-relaxed">
                    Tidak ada topik yang cocok dengan kata kunci &ldquo;{searchQuery}&rdquo;. Coba gunakan kata kunci yang lebih umum seperti <em>bobot</em>, <em>pesangon</em>, <em>9-box</em>, atau reset pencarian.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRoleFilter('all');
                      setSelectedCategory('all');
                    }}
                    className="px-5 py-2.5 rounded-[12px] bg-[#008060] text-white text-xs sm:text-sm font-semibold hover:bg-[#006E52] transition-colors cursor-pointer shadow-xs"
                  >
                    Reset Pencarian &amp; Tampilkan Semua
                  </button>
                </div>
              )}
          </div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM FIXED STATUS BAR                                               */}
      {/* ========================================================================= */}
      <footer className="h-12 bg-white border-t border-[#E1E3E5] px-4 sm:px-6 flex items-center justify-between gap-4 text-xs text-[#6D7175] flex-shrink-0">
        <div className="flex items-center gap-2 truncate">
          <ShieldCheck className="h-4 w-4 text-[#008060] flex-shrink-0" />
          <span className="truncate">
            Standar Sah: <strong>PP No. 35/2021</strong> &bull; <strong>ISO 30414:2019</strong> &bull; <strong>KNKG TARIF</strong> &bull; <strong>BSC Kaplan-Norton</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={scrollToTop}
            className="hidden sm:inline-flex items-center gap-1 text-[#6D7175] hover:text-[#202223] font-medium transition-colors cursor-pointer"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>Kembali ke Atas</span>
          </button>
          <span className="hidden sm:inline text-[#E1E3E5]">|</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-[10px] bg-[#F6F6F7] hover:bg-[#E1E3E5] text-[#202223] font-semibold text-xs transition-colors cursor-pointer border border-[#E1E3E5]"
          >
            Tutup Panduan (Esc)
          </button>
        </div>
      </footer>
    </div>
  );
}

