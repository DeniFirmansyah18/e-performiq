'use client';

import React from 'react';
import Header from '@/components/navigation/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col font-sans">
      <Header />
      <div className="flex flex-1">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#f8fafc]">
          {children}
        </main>
      </div>
    </div>
  );
}
