// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ListPager, { matchesText } from '@/components/ui/ListPager';

interface Item {
  id: string;
  nama: string;
}

const items: Item[] = Array.from({ length: 25 }, (_, i) => ({
  id: `a${i + 1}`,
  nama: i === 4 ? 'Karyawan Khusus' : `Alumni ${i + 1}`,
}));

const props = {
  items,
  itemKey: (it: Item) => it.id,
  renderItem: (it: Item) => <span>{it.nama}</span>,
  searchText: (it: Item) => it.nama,
  searchPlaceholder: 'Cari alumni...',
  itemLabel: 'alumni',
};

afterEach(() => cleanup());

describe('ListPager', () => {
  it('memotong daftar menjadi 10 baris per halaman', () => {
    render(<ListPager {...props} />);
    expect(screen.getByText('Alumni 1')).toBeTruthy();
    expect(screen.queryByText('Alumni 11')).toBeNull();
    expect(screen.getByText(/Menampilkan 1–10 dari 25 alumni/)).toBeTruthy();
  });

  it('berpindah halaman menampilkan sisa data', () => {
    render(<ListPager {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Halaman berikutnya/i }));
    expect(screen.getByText('Alumni 11')).toBeTruthy();
    expect(screen.getByText(/Halaman 2 \/ 3/)).toBeTruthy();
  });

  it('pencarian menyaring dan kembali ke halaman 1', () => {
    render(<ListPager {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Halaman berikutnya/i }));
    fireEvent.change(screen.getByLabelText('Cari alumni...'), { target: { value: 'Khusus' } });
    expect(screen.getByText('Karyawan Khusus')).toBeTruthy();
    expect(screen.getByText(/Halaman 1 \/ 1/)).toBeTruthy();
  });

  it('menampilkan pesan bila pencarian tidak menemukan apa pun', () => {
    render(<ListPager {...props} />);
    fireEvent.change(screen.getByLabelText('Cari alumni...'), { target: { value: 'zzz' } });
    expect(screen.getByText(/Tidak ada alumni yang cocok/i)).toBeTruthy();
  });

  it('data <= 10 tidak menampilkan pencarian maupun paginasi', () => {
    render(<ListPager {...props} items={items.slice(0, 3)} />);
    expect(screen.queryByLabelText('Cari alumni...')).toBeNull();
    expect(screen.queryByRole('button', { name: /Halaman berikutnya/i })).toBeNull();
    expect(screen.getByText('Alumni 1')).toBeTruthy();
  });

  it('matchesText mengabaikan huruf besar/kecil dan spasi kosong', () => {
    expect(matchesText('Karyawan Khusus', 'KHUSUS')).toBe(true);
    expect(matchesText('Karyawan Khusus', '   ')).toBe(true);
    expect(matchesText('Karyawan Khusus', 'zzz')).toBe(false);
  });
});
