const fs = require('fs');

/** Hapus baris berdasarkan nomor (1-based), lalu tambahkan koma pada baris
 *  sebelumnya bila baris yang dihapus adalah penutup daftar VALUES. */
function dropLinesByNumber(file, numbers, commaFixups) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const set = new Set(numbers);
  // commaFixups: nomor baris (1-based, SEBELUM penghapusan) yang perlu diberi koma
  const fix = new Set(commaFixups);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    if (set.has(n)) { continue; }
    out.push(fix.has(n) ? lines[i].replace(/\)(\r?)$/, '),$1') : lines[i]);
  }
  fs.writeFileSync(file, out.join('\n'), 'utf8');
  console.log(file + ' | dihapus: ' + [...set].join(',') + ' | koma di: ' + [...fix].join(','));
}

dropLinesByNumber('src/lib/db/seed/index.ts', [20, 68, 97, 517], [67, 516]);
dropLinesByNumber('src/lib/db/seed/lifecycle-seed.ts', [121, 130, 336], []);
dropLinesByNumber('src/lib/db/seed/talent-contract-seed.ts', [89, 231, 232, 233, 263], []);
