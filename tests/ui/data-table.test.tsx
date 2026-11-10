// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import DataTable, { matchesSearch, type DataTableColumn } from '@/components/ui/DataTable';

interface Row {
  id: string;
  name: string;
  dept: string;
}

const rows: Row[] = Array.from({ length: 23 }, (_, i) => ({
  id: `e${i + 1}`,
  name: `Pegawai ${i + 1}`,
  dept: i % 2 === 0 ? 'TI' : 'Keuangan',
}));

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Nama', value: (r) => r.name },
  { key: 'dept', header: 'Departemen', value: (r) => r.dept },
];

afterEach(() => cleanup());

describe('DataTable', () => {
  it('hanya menampilkan 10 baris per halaman', () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.id} itemLabel="karyawan" />);
    expect(screen.getAllByRole('row')).toHaveLength(11); // 1 header + 10 data
    expect(screen.getByText(/Menampilkan 1–10 dari 23 karyawan/)).toBeTruthy();
  });

  it('berpindah halaman menampilkan data berikutnya', () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.id} itemLabel="karyawan" />);
    fireEvent.click(screen.getByRole('button', { name: /Halaman berikutnya/i }));
    expect(screen.getByText('Pegawai 11')).toBeTruthy();
    expect(screen.getByText(/Halaman 2 \/ 3/)).toBeTruthy();
  });

  it('pencarian menyaring data dan mengembalikan ke halaman 1', () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Cari pegawai..."
        itemLabel="karyawan"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Halaman berikutnya/i }));
    fireEvent.change(screen.getByLabelText('Cari pegawai...'), { target: { value: 'Keuangan' } });
    // 11 baris Keuangan (indeks ganjil dari 23) -> tetap 10 baris halaman 1
    expect(screen.getByText(/Halaman 1 \/ 2/)).toBeTruthy();
    expect(screen.getByText('Pegawai 2')).toBeTruthy();
  });

  it('menampilkan pesan saat pencarian tidak menemukan apa pun', () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Cari..."
        itemLabel="karyawan"
      />
    );
    fireEvent.change(screen.getByLabelText('Cari...'), { target: { value: 'zzz-tidak-ada' } });
    expect(screen.getByText(/Tidak ada karyawan yang cocok/i)).toBeTruthy();
    expect(screen.getByText(/^0 karyawan$/)).toBeTruthy();
  });

  it('menyembunyikan kontrol paginasi bila data <= 10', () => {
    render(<DataTable rows={rows.slice(0, 5)} columns={columns} rowKey={(r) => r.id} />);
    expect(screen.queryByRole('button', { name: /Halaman berikutnya/i })).toBeNull();
  });

  it('matchesSearch mencocokkan lintas kolom tanpa peduli huruf besar/kecil', () => {
    // rows[0] = Pegawai 1 / TI ; rows[1] = Pegawai 2 / Keuangan
    expect(matchesSearch(rows[1], columns, 'keuangan')).toBe(true);
    expect(matchesSearch(rows[0], columns, 'ti')).toBe(true);
    expect(matchesSearch(rows[0], columns, 'TI')).toBe(true);
    expect(matchesSearch(rows[1], columns, '   ')).toBe(true);
    expect(matchesSearch(rows[1], columns, 'zzz')).toBe(false);
  });
});
