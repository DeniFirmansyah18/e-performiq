# ADR 013 — UI Kartu (Card Grid) & Navigasi Top-Bar Tanpa Sidebar

Status: Diterima
Tanggal: 2026-10-01

## Konteks

Dahulu setiap dashboard menampilkan seluruh kontennya sekaligus (halaman panjang)
dan navigasi utama berada pada sidebar kiri. Pengguna menginginkan UI yang lebih
ringkas: tiap fitur menjadi **kartu yang diklik untuk menampilkan isinya**, serta
**sidebar dihilangkan** (top bar dan tampilan lain tetap).

## Keputusan

1. Hapus `src/components/navigation/Sidebar.tsx`; navigasi peran dipindahkan ke
   `NavMenu` di dalam `Header` (dropdown Portals & Modul/Tata Kelola yang sadar-peran).
2. Tambah primitif UI:
   - `FeatureGrid` — grid responsif 1/2/3 kolom.
   - `FeatureCard` — tombol nyata (`<button>`) dengan focus ring & hover lift (aksesibel keyboard).
   - `ExpandablePanel` — panel `role="region"` + `aria-label` dengan tombol tutup.
   - `AiAnalyzePanel` — memanggil `/api/v1/ai/analyze` per fitur.
3. Setiap dashboard (executive, hr-command, manager-cockpit, employee-portal,
   ninebox-matrix, audit-governance) direfaktor: konten yang ada **dipindahkan utuh**
   ke dalam panel; kartu hanya menjadi pembuka. Logika & API fitur tidak diubah.
4. Tambah `AiChatDrawer` yang dibuka dari tombol "Tanya AI" pada Header.

## Konsekuensi

- Halaman lebih ringkas; pengguna fokus pada satu fitur pada satu waktu.
- Tidak ada fitur yang hilang — konten hanya direlokasi ke dalam panel.
- Aksesibilitas terjaga (kartu = tombol, panel punya label region).
- Navigasi kini bergantung pada Header; tautan ber-peran tetap terjangkau dari menu.

## Alternatif yang ditolak

- **Sidebar collapsible**: tetap memakan ruang horizontal; pengguna meminta dihilangkan.
- **Tabs alih-alih kartu**: kehilangan ringkasan metrik sekilas pada kartu.
