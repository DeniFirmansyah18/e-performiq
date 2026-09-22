import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/context/AuthContext';

export const metadata: Metadata = {
  title: 'E-PerformIQ | Enterprise Employee Performance & Lifecycle Analytics',
  description:
    'Sistem Manajemen Kinerja Karyawan Terintegrasi Berbasis GCG & Employee Lifecycle Standard ISO 9001/30414 & PP 35/2021',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
