import AccountManagementPanel from '@/components/admin/AccountManagementPanel';

export const metadata = { title: 'Manajemen Akun — E-PerformIQ' };

export default function AccountManagementPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AccountManagementPanel />
    </div>
  );
}
