/**
 * Seed data wilayah Indonesia (FALLBACK LOKAL) — provinsi, kabupaten/kota, kecamatan.
 *
 * Dipakai bila layanan Wilayah Alamat API (WILAYAH_API_URL) tidak dikonfigurasi/mati,
 * sehingga dropdown alamat tetap menampilkan data nyata (offline). Level desa/kelurahan
 * (83rb+ baris) hanya tersedia via API.
 *
 * Sumber: dataset publik kodepos-id (mrayhanfadil/kodepos-id, kode wilayah Kemendagri).
 * Format baris: `kode|nama` (provinsi), `kode|tipe|nama` (kab/kota), `kode|nama` (kecamatan).
 */

const RAW_PROVINSI = `35|Jawa Timur
33|Jawa Tengah
75|Gorontalo
34|DI Yogyakarta
76|Sulawesi Barat
95|Papua Pegunungan
94|Papua Tengah
91|Papua
92|Papua Barat Daya
74|Sulawesi Tenggara
53|Nusa Tenggara Timur (NTT)
52|Nusa Tenggara Barat (NTB)
11|Aceh (NAD)
73|Sulawesi Selatan
71|Sulawesi Utara
18|Lampung
81|Maluku
72|Sulawesi Tengah
32|Jawa Barat
82|Maluku Utara
36|Banten
64|Kalimantan Timur
93|Papua Selatan
16|Sumatera Selatan
63|Kalimantan Selatan
12|Sumatera Utara
13|Sumatera Barat
15|Jambi
17|Bengkulu
62|Kalimantan Tengah
14|Riau
21|Kepulauan Riau
51|Bali
61|Kalimantan Barat
65|Kalimantan Utara
19|Kepulauan Bangka Belitung
31|DKI Jakarta`;
const RAW_KABUPATEN = `3507|Kabupaten|Malang
3511|Kabupaten|Bondowoso
3310|Kabupaten|Klaten
7502|Kabupaten|Boalemo
3403|Kabupaten|Gunungkidul
3309|Kabupaten|Boyolali
3321|Kabupaten|Demak
3517|Kabupaten|Jombang
3514|Kabupaten|Pasuruan
3326|Kabupaten|Pekalongan
7604|Kabupaten|Polewali Mandar
3513|Kabupaten|Probolinggo
3578|Kota|Surabaya
3312|Kabupaten|Wonogiri
3505|Kabupaten|Blitar
3323|Kabupaten|Temanggung
3515|Kabupaten|Sidoarjo
9504|Kabupaten|Tolikara
9507|Kabupaten|Lanny Jaya
9405|Kabupaten|Puncak
9403|Kabupaten|Paniai
3508|Kabupaten|Lumajang
9103|Kabupaten|Jayapura
9503|Kabupaten|Yahukimo
9508|Kabupaten|Nduga
9106|Kabupaten|Biak Numfor
9209|Kabupaten|Tambrauw
9105|Kabupaten|Kepulauan Yapen
9401|Kabupaten|Nabire
3519|Kabupaten|Madiun
3574|Kota|Probolinggo
3510|Kabupaten|Banyuwangi
7402|Kabupaten|Konawe
9207|Kabupaten|Teluk Wondama
5308|Kabupaten|Ende
5316|Kabupaten|Nagekeo
7404|Kabupaten|Buton
5309|Kabupaten|Ngada
9501|Kabupaten|Jayawijaya
7401|Kabupaten|Kolaka
7472|Kota|Bau Bau
7405|Kabupaten|Konawe Selatan
5205|Kabupaten|Dompu
5206|Kabupaten|Bima
1105|Kabupaten|Aceh Barat
7324|Kabupaten|Luwu Timur
5306|Kabupaten|Flores Timur
7106|Kabupaten|Minahasa Utara
9115|Kabupaten|Waropen
3325|Kabupaten|Batang
1806|Kabupaten|Tanggamus
3307|Kabupaten|Wonosobo
3509|Kabupaten|Jember
5311|Kabupaten|Sumba Timur
5313|Kabupaten|Lembata
8103|Kabupaten|Kepulauan Tanimbar (Maluku Tenggara Barat)
7471|Kota|Kendari
3525|Kabupaten|Gresik
7409|Kabupaten|Konawe Utara
7206|Kabupaten|Morowali
3315|Kabupaten|Grobogan
3471|Kota|Yogyakarta
3318|Kabupaten|Pati
3308|Kabupaten|Magelang
3518|Kabupaten|Nganjuk
1117|Kabupaten|Bener Meriah
3521|Kabupaten|Ngawi
3212|Kabupaten|Indramayu
3523|Kabupaten|Tuban
5321|Kabupaten|Malaka
5318|Kabupaten|Sumba Barat Daya
8108|Kabupaten|Maluku Barat Daya
3311|Kabupaten|Sukoharjo
3209|Kabupaten|Cirebon
8105|Kabupaten|Seram Bagian Timur
9206|Kabupaten|Teluk Bintuni
7171|Kota|Manado
9201|Kabupaten|Sorong
3324|Kabupaten|Kendal
9506|Kabupaten|Yalimo
5315|Kabupaten|Manggarai Barat
3320|Kabupaten|Jepara
9502|Kabupaten|Pegunungan Bintang
8202|Kabupaten|Halmahera Tengah
9111|Kabupaten|Keerom
3506|Kabupaten|Kediri
3401|Kabupaten|Kulon Progo
7314|Kabupaten|Sidenreng Rappang
7315|Kabupaten|Pinrang
8206|Kabupaten|Halmahera Timur
9205|Kabupaten|Raja Ampat
3328|Kabupaten|Tegal
3327|Kabupaten|Pemalang
3203|Kabupaten|Cianjur
3202|Kabupaten|Sukabumi
3602|Kabupaten|Lebak
3272|Kota|Sukabumi
9204|Kabupaten|Sorong Selatan
1808|Kabupaten|Way Kanan
1804|Kabupaten|Lampung Barat
1801|Kabupaten|Lampung Selatan
1811|Kabupaten|Mesuji
1802|Kabupaten|Lampung Tengah
1809|Kabupaten|Pesawaran
1813|Kabupaten|Pesisir Barat
1812|Kabupaten|Tulang Bawang Barat
1807|Kabupaten|Lampung Timur
1871|Kota|Bandar Lampung
7412|Kabupaten|Konawe Kepulauan
3528|Kabupaten|Pamekasan
6409|Kabupaten|Penajam Paser Utara
9203|Kabupaten|Fak Fak
9302|Kabupaten|Boven Digoel
9120|Kabupaten|Mamberamo Raya
9202|Kabupaten|Manokwari
1609|Kabupaten|Ogan Komering Ulu Selatan
3604|Kabupaten|Serang
7373|Kota|Palopo
3329|Kabupaten|Brebes
5203|Kabupaten|Lombok Timur
3301|Kabupaten|Cilacap
6304|Kabupaten|Barito Kuala
3205|Kabupaten|Garut
3304|Kabupaten|Banjarnegara
1205|Kabupaten|Langkat
7317|Kabupaten|Luwu
7209|Kabupaten|Tojo Una Una
8104|Kabupaten|Buru
9402|Kabupaten|Puncak Jaya
5312|Kabupaten|Sumba Barat
9404|Kabupaten|Mimika
3302|Kabupaten|Banyumas
7407|Kabupaten|Wakatobi
7504|Kabupaten|Pahuwato
9407|Kabupaten|Intan Jaya
3214|Kabupaten|Purwakarta
7408|Kabupaten|Kolaka Utara
3503|Kabupaten|Trenggalek
7403|Kabupaten|Muna
3673|Kota|Serang
7410|Kabupaten|Buton Utara
7371|Kota|Makassar
5307|Kabupaten|Sikka
8109|Kabupaten|Buru Selatan
5310|Kabupaten|Manggarai
3211|Kabupaten|Sumedang
7413|Kabupaten|Muna Barat
9301|Kabupaten|Merauke
1305|Kabupaten|Padang Pariaman
1509|Kabupaten|Tebo
9303|Kabupaten|Mappi
1706|Kabupaten|Muko Muko
6212|Kabupaten|Murung Raya
5204|Kabupaten|Sumbawa
1707|Kabupaten|Lebong
6309|Kabupaten|Tabalong
9304|Kabupaten|Asmat
7271|Kota|Palu
7411|Kabupaten|Kolaka Timur
1204|Kabupaten|Nias
7303|Kabupaten|Bantaeng
1212|Kabupaten|Toba
1705|Kabupaten|Seluma
1221|Kabupaten|Padang Lawas
1613|Kabupaten|Musi Rawas Utara
1213|Kabupaten|Mandailing Natal
1601|Kabupaten|Ogan Komering Ulu
1611|Kabupaten|Empat Lawang
1225|Kabupaten|Nias Barat
1701|Kabupaten|Bengkulu Selatan
1214|Kabupaten|Nias Selatan
1703|Kabupaten|Bengkulu Utara
1118|Kabupaten|Pidie Jaya
1171|Kota|Banda Aceh
7308|Kabupaten|Bone
1405|Kabupaten|Pelalawan
7302|Kabupaten|Bulukumba
3273|Kota|Bandung
1208|Kabupaten|Simalungun
3322|Kabupaten|Semarang
2102|Kabupaten|Karimun
3319|Kabupaten|Kudus
5317|Kabupaten|Sumba Tengah
7605|Kabupaten|Majene
1220|Kabupaten|Padang Lawas Utara
1406|Kabupaten|Rokan Hulu
7372|Kota|Pare Pare
1708|Kabupaten|Kepahiang
1603|Kabupaten|Muara Enim
5104|Kabupaten|Gianyar
7110|Kabupaten|Bolaang Mongondow Timur
7309|Kabupaten|Maros
3524|Kabupaten|Lamongan
3404|Kabupaten|Sleman
7304|Kabupaten|Jeneponto
3316|Kabupaten|Blora
1506|Kabupaten|Tanjung Jabung Barat
1606|Kabupaten|Musi Banyuasin
1607|Kabupaten|Banyuasin
7105|Kabupaten|Minahasa Selatan
6104|Kabupaten|Ketapang
3504|Kabupaten|Tulungagung
1602|Kabupaten|Ogan Komering Ilir
6503|Kabupaten|Nunukan
3501|Kabupaten|Pacitan
1201|Kabupaten|Tapanuli Tengah
1903|Kabupaten|Bangka Selatan
6107|Kabupaten|Bengkayang
1224|Kabupaten|Nias Utara
1115|Kabupaten|Nagan Raya
3516|Kabupaten|Mojokerto
3526|Kabupaten|Bangkalan
7107|Kabupaten|Minahasa Tenggara
7207|Kabupaten|Banggai Kepulauan
7208|Kabupaten|Parigi Moutong
3527|Kabupaten|Sampang
1222|Kabupaten|Labuhanbatu Selatan
9110|Kabupaten|Sarmi
7606|Kabupaten|Mamuju Tengah
7406|Kabupaten|Bombana
7602|Kabupaten|Mamuju
7111|Kabupaten|Bolaang Mongondow Selatan
7505|Kabupaten|Gorontalo Utara
7102|Kabupaten|Minahasa
7306|Kabupaten|Gowa
7204|Kabupaten|Toli Toli
7501|Kabupaten|Gorontalo
7201|Kabupaten|Banggai
5302|Kabupaten|Timor Tengah Selatan
6102|Kabupaten|Mempawah
8203|Kabupaten|Halmahera Utara
7310|Kabupaten|Pangkajene Kepulauan
7326|Kabupaten|Toraja Utara
7173|Kota|Tomohon
1605|Kabupaten|Musi Rawas
3374|Kota|Semarang
1408|Kabupaten|Siak
6202|Kabupaten|Kotawaringin Timur
1471|Kota|Pekanbaru
1101|Kabupaten|Aceh Selatan
3522|Kabupaten|Bojonegoro
3215|Kabupaten|Karawang
1107|Kabupaten|Pidie
3373|Kota|Salatiga
1209|Kabupaten|Asahan
1215|Kabupaten|Pakpak Bharat
1310|Kabupaten|Dharmasraya
6203|Kabupaten|Kapuas
7503|Kabupaten|Bone Bolango
7205|Kabupaten|Buol
1306|Kabupaten|Agam
6103|Kabupaten|Sanggau
2101|Kabupaten|Bintan
8272|Kota|Tidore Kepulauan
1502|Kabupaten|Merangin
6205|Kabupaten|Barito Utara
6206|Kabupaten|Katingan
6210|Kabupaten|Gunung Mas
1109|Kabupaten|Simeulue
1114|Kabupaten|Aceh Jaya
8101|Kabupaten|Maluku Tengah
3603|Kabupaten|Tangerang
1771|Kota|Bengkulu
6408|Kabupaten|Kutai Timur
6112|Kabupaten|Kubu Raya
1274|Kota|Tanjung Balai
5305|Kabupaten|Alor
6105|Kabupaten|Sintang
1404|Kabupaten|Indragiri Hilir
1905|Kabupaten|Bangka Barat
7313|Kabupaten|Wajo
2104|Kabupaten|Lingga
5106|Kabupaten|Bangli
1113|Kabupaten|Gayo Lues
3201|Kabupaten|Bogor
1116|Kabupaten|Aceh Tamiang
6402|Kabupaten|Kutai Kartanegara
1704|Kabupaten|Kaur
9212|Kabupaten|Pegunungan Arfak
8271|Kota|Ternate
6407|Kabupaten|Kutai Barat
6101|Kabupaten|Sambas
5108|Kabupaten|Buleleng
3376|Kota|Tegal
1218|Kabupaten|Serdang Bedagai
6310|Kabupaten|Tanah Bumbu
9208|Kabupaten|Kaimana
6403|Kabupaten|Berau
6111|Kabupaten|Kayong Utara
1410|Kabupaten|Kepulauan Meranti
1276|Kota|Tebing Tinggi
6311|Kabupaten|Balangan
3174|Kota|Jakarta Selatan
8172|Kota|Tual
3313|Kabupaten|Karanganyar
3278|Kota|Tasikmalaya
7603|Kabupaten|Mamasa
7103|Kabupaten|Kepulauan Sangihe
6303|Kabupaten|Banjar
5304|Kabupaten|Belu
7601|Kabupaten|Pasangkayu (Mamuju Utara)
1308|Kabupaten|Pasaman
1302|Kabupaten|Solok
9408|Kabupaten|Deiyai
1206|Kabupaten|Karo
1211|Kabupaten|Dairi
8171|Kota|Ambon
7307|Kabupaten|Sinjai
1571|Kota|Jambi
6306|Kabupaten|Hulu Sungai Selatan
1202|Kabupaten|Tapanuli Utara
3216|Kabupaten|Bekasi
6571|Kota|Tarakan
3206|Kabupaten|Tasikmalaya
1216|Kabupaten|Humbang Hasundutan
1401|Kabupaten|Kampar
3314|Kabupaten|Sragen
1102|Kabupaten|Aceh Tenggara
1203|Kabupaten|Tapanuli Selatan
1604|Kabupaten|Lahat
3213|Kabupaten|Subang
1219|Kabupaten|Batu Bara
3276|Kota|Depok
6305|Kabupaten|Tapin
6501|Kabupaten|Bulungan
1610|Kabupaten|Ogan Ilir
1803|Kabupaten|Lampung Utara
3172|Kota|Jakarta Utara
2172|Kota|Tanjung Pinang
1902|Kabupaten|Belitung
1207|Kabupaten|Deli Serdang
1407|Kabupaten|Rokan Hilir
1372|Kota|Solok
6401|Kabupaten|Paser
1303|Kabupaten|Sijunjung
1304|Kabupaten|Tanah Datar
5208|Kabupaten|Lombok Utara
8106|Kabupaten|Seram Bagian Barat
3671|Kota|Tangerang
1112|Kabupaten|Aceh Barat Daya
7311|Kabupaten|Barru
7203|Kabupaten|Donggala
7210|Kabupaten|Sigi
1508|Kabupaten|Bungo
3271|Kota|Bogor
6110|Kabupaten|Melawi
1108|Kabupaten|Aceh Utara
1572|Kota|Sungai Penuh
1501|Kabupaten|Kerinci
3171|Kota|Jakarta Pusat
1612|Kabupaten|Penukal Abab Lematang Ilir
3207|Kabupaten|Ciamis
1971|Kota|Pangkal Pinang
3173|Kota|Jakarta Barat
1505|Kabupaten|Muaro Jambi
3577|Kota|Madiun
8208|Kabupaten|Pulau Taliabu
1373|Kota|Sawahlunto
3529|Kabupaten|Sumenep
1403|Kabupaten|Bengkalis
5207|Kabupaten|Sumbawa Barat
9211|Kabupaten|Manokwari Selatan
7109|Kabupaten|Kepulauan Siau Tagulandang Biaro (Sitaro)
5301|Kabupaten|Kupang
1709|Kabupaten|Bengkulu Tengah
1312|Kabupaten|Pasaman Barat
7414|Kabupaten|Buton Tengah
3210|Kabupaten|Majalengka
6301|Kabupaten|Tanah Laut
3520|Kabupaten|Magetan
7301|Kabupaten|Kepulauan Selayar
7322|Kabupaten|Luwu Utara
6504|Kabupaten|Tana Tidung
7104|Kabupaten|Kepulauan Talaud
5102|Kabupaten|Tabanan
1301|Kabupaten|Pesisir Selatan
1110|Kabupaten|Aceh Singkil
9119|Kabupaten|Supiori
1901|Kabupaten|Bangka
6502|Kabupaten|Malinau
6308|Kabupaten|Hulu Sungai Utara
1472|Kota|Dumai
1904|Kabupaten|Bangka Tengah
1103|Kabupaten|Aceh Timur
1402|Kabupaten|Indragiri Hulu
6472|Kota|Samarinda
6302|Kabupaten|Kotabaru
3601|Kabupaten|Pandeglang
1311|Kabupaten|Solok Selatan
3512|Kabupaten|Situbondo
3317|Kabupaten|Rembang
3573|Kota|Malang
3502|Kabupaten|Ponorogo
3572|Kota|Blitar
1810|Kabupaten|Pringsewu
1175|Kota|Subulussalam
6207|Kabupaten|Seruyan
1307|Kabupaten|Lima Puluh Kota
8205|Kabupaten|Kepulauan Sula
9406|Kabupaten|Dogiyai
1671|Kota|Palembang
6208|Kabupaten|Sukamara
1106|Kabupaten|Aceh Besar
1172|Kota|Sabang
6106|Kabupaten|Kapuas Hulu
2103|Kabupaten|Natuna
3208|Kabupaten|Kuningan
3305|Kabupaten|Kebumen
3402|Kabupaten|Bantul
7212|Kabupaten|Morowali Utara
9271|Kota|Sorong
3204|Kabupaten|Bandung
6108|Kabupaten|Landak
8107|Kabupaten|Kepulauan Aru
1309|Kabupaten|Kepulauan Mentawai
1217|Kabupaten|Samosir
7571|Kota|Gorontalo
7415|Kabupaten|Buton Selatan
1503|Kabupaten|Sarolangun
6172|Kota|Singkawang
1409|Kabupaten|Kuantan Singingi
3217|Kabupaten|Bandung Barat
1702|Kabupaten|Rejang Lebong
1906|Kabupaten|Belitung Timur
1111|Kabupaten|Bireuen
1104|Kabupaten|Aceh Tengah
7318|Kabupaten|Tana Toraja
5107|Kabupaten|Karangasem
3218|Kabupaten|Pangandaran
1273|Kota|Sibolga
1272|Kota|Pematangsiantar
2105|Kabupaten|Kepulauan Anambas
3674|Kota|Tangerang Selatan
3372|Kota|Surakarta
1608|Kabupaten|Ogan Komering Ulu Timur
6209|Kabupaten|Lamandau
5271|Kota|Mataram
2171|Kota|Batam
5201|Kabupaten|Lombok Barat
6109|Kabupaten|Sekadau
6211|Kabupaten|Pulang Pisau
7305|Kabupaten|Takalar
7108|Kabupaten|Bolaang Mongondow Utara
7101|Kabupaten|Bolaang Mongondow
8201|Kabupaten|Halmahera Barat
5319|Kabupaten|Manggarai Timur
1507|Kabupaten|Tanjung Jabung Timur
5320|Kabupaten|Sabu Raijua
6271|Kota|Palangkaraya
5314|Kabupaten|Rote Ndao
3275|Kota|Bekasi
1805|Kabupaten|Tulang Bawang
5272|Kota|Bima
7172|Kota|Bitung
3303|Kabupaten|Purbalingga
6213|Kabupaten|Barito Timur
1210|Kabupaten|Labuhanbatu
1674|Kota|Prabumulih
3672|Kota|Cilegon
3279|Kota|Banjar
3306|Kabupaten|Purworejo
3575|Kota|Pasuruan
3175|Kota|Jakarta Timur
8207|Kabupaten|Pulau Morotai
8204|Kabupaten|Halmahera Selatan
5202|Kabupaten|Lombok Tengah
3576|Kota|Mojokerto
7202|Kabupaten|Poso
6171|Kota|Pontianak
5103|Kabupaten|Badung
3571|Kota|Kediri
1504|Kabupaten|Batanghari
5101|Kabupaten|Jembrana
3375|Kota|Pekalongan
3274|Kota|Cirebon
1376|Kota|Payakumbuh
1371|Kota|Padang
1377|Kota|Pariaman
6201|Kabupaten|Kotawaringin Barat
6307|Kabupaten|Hulu Sungai Tengah
1277|Kota|Padangsidimpuan
1374|Kota|Padang Panjang
1672|Kota|Pagar Alam
5105|Kabupaten|Klungkung
5371|Kota|Kupang
5303|Kabupaten|Timor Tengah Utara
9171|Kota|Jayapura
1173|Kota|Lhokseumawe
1223|Kabupaten|Labuhanbatu Utara
1872|Kota|Metro
9505|Kabupaten|Mamberamo Tengah
1271|Kota|Medan
7312|Kabupaten|Soppeng
9210|Kabupaten|Maybrat
7316|Kabupaten|Enrekang
8102|Kabupaten|Maluku Tenggara
3371|Kota|Magelang
1375|Kota|Bukittinggi
1673|Kota|Lubuk Linggau
6411|Kabupaten|Mahakam Ulu
6372|Kota|Banjarbaru
1174|Kota|Langsa
7211|Kabupaten|Banggai Laut
7174|Kota|Kotamobagu
3101|Kabupaten|Kepulauan Seribu
6204|Kabupaten|Barito Selatan
3579|Kota|Batu
1278|Kota|Gunungsitoli
5171|Kota|Denpasar
3277|Kota|Cimahi
6474|Kota|Bontang
1275|Kota|Binjai
6371|Kota|Banjarmasin
6471|Kota|Balikpapan`;
const RAW_KECAMATAN = `350732|Wonosari
351109|Wonosari
331015|Wonosari
750202|Wonosari
340301|Wonosari
330922|Wonosamodro
332106|Wonosalam
351705|Wonosalam
351407|Wonorejo
332612|Wonopringgo
760403|Wonomulyo
351322|Wonomerto
357804|Wonokromo
332619|Wonokerto
331212|Wonogiri
350501|Wonodadi
357802|Wonocolo
332319|Wonoboyo
351510|Wonoayu
950432|Yuneri
950446|Yuko
950715|Yugungwi
940517|Yugumuak
940318|Youtadi
350807|Yosowilangun
910319|Yokari
950349|Yogosem
950733|Yiluk
950713|Yiginua
950803|Yigi
950813|Yenggelo
910611|Yendidori
920903|Yembun
910613|Yawosi
910516|Yawakukat
940103|Yaur
940309|Yatamo
940110|Yaro
910315|Yapsi
910507|Yapen Utara
910503|Yapen Timur
910501|Yapen Selatan
910502|Yapen Barat
351915|Wonoasri
357402|Wonoasih
950410|Woniki
351018|Wongsorejo
740241|Wonggeduku Barat
740219|Wonggeduku
920704|Wondiboy
910511|Wonawa
530808|Wolowaru
531605|Wolowae
740428|Wolowa
530916|Wolomeze (Riung Selatan)
530809|Wolojita
950108|Wolo
740110|Wolo
747202|Wolio
740518|Wolasi
520505|Woja
520603|Woha
110504|Woyla
950115|Wouma
732406|Wotu
530609|Wotan Ulumando
950804|Wosak
710604|Wori
911514|Wonti
332501|Wonotunggal
350508|Wonotirto
180603|Wonosobo
330709|Wonosobo
330918|Wonosegoro
950406|Wunim
351907|Wungu
740101|Wundulako
350911|Wuluhan
531111|Wulla Waijelu (Wula Waijelu)
530601|Wulanggitang
531308|Wulandoni
950438|Wugi
810307|Wuar Labobar
747107|Wua-Wua
352506|Wringinanom (Wringin Anom)
351112|Wringin
110511|Woyla Timur
110510|Woyla Barat
350517|Wlingi
357820|Wiyung
740902|Wiwirano
530612|Witihama
950122|Wita Waya
720612|Wita Ponda
331510|Wirosari
347107|Wirobrajan
950719|Wiringgambut
332616|Wiradesa
351419|Winongan
331804|Winong
330821|Windusari
910512|Windesi
920702|Windesi
950407|Wina
920919|Wilhem Roumbouts
351815|Wilangan
111706|Wih Pesam
352112|Widodaren
321207|Widasari
352319|Widang
532103|Wewiku
531802|Wewewa Utara
531803|Wewewa Timur
531810|Wewewa Tengah
531805|Wewewa Selatan
531804|Wewewa Barat
530807|Wewaria
810813|Wetar Utara
810815|Wetar Timur
810806|Wetar Selatan
810814|Wetar Barat
950140|Wesaput
331101|Weru
320919|Weru
810303|Wertamrian (Wer Tamrian)
810304|Wermaktian (Wer Maktian)
810503|Werinama
950317|Werima
920621|Weriagar
950717|Wereka
520607|Wera
717104|Wenang
950437|Wenam
920145|Wemak
532104|Weliman
950135|Welesi
332412|Weleri
950605|Welarek
531507|Welak
332003|Welahan
950227|Weime
940311|Wegee Muka
940312|Wegee Bino
332113|Wedung
331003|Wedi
331815|Wedarijaksa
820204|Weda Utara
820209|Weda Timur
820207|Weda Tengah
820205|Weda Selatan
820201|Weda
911104|Web
350606|Wates
350520|Wates
340102|Wates
731408|Watang Sidenreng (Wattang Sidenreng)
731504|Watang Sawitto (Watang Sawito)
731403|Watang Pulu
732411|Wasuponda
920701|Wasior
820606|Wasile Utara
820607|Wasile Timur
820605|Wasile Tengah
820604|Wasile Selatan
820601|Wasile
920514|Warwarbomi
332817|Warureja (Warurejo)
332714|Warungpring
320302|Warungkondang
320209|Warungkiara
360215|Warunggunung
332512|Warungasem
327204|Warudoyong
920412|Wayer
180808|Way Tuba
180407|Way Tenong
180123|Way Sulan
181104|Way Serdang
180225|Way Seputih
180911|Way Ratai
180124|Way Panji
180217|Way Pangubuan
180904|Way Lima
181307|Way Krui
180909|Way Khilau
181206|Way Kenanga
180707|Way Jepara
187115|Way Halim
180723|Way Bungur
740203|Wawotobi
741202|Wawonii Utara
352810|Waru
640902|Waru
351518|Waru
920311|Wartutin
910609|Warsa
930203|Waropko
911501|Waropen Bawah
912006|Waropen Atas
920203|Warmare
160913|Warkuk Ranau Selatan
911101|Waris
360406|Waringinkurung (Waringin Kurung)
950429|Wari/Taiyeve II
737302|Wara Utara
737305|Wara Timur
737303|Wara Selatan
737306|Wara Barat
737301|Wara
911512|Wapoga
940111|Wapoga
332908|Wanasari
360221|Wanasalam
520314|Wanasaba
330115|Wanareja
630416|Wanaraya
320503|Wanaraja
330410|Wanadadi (Wonodadi)
120508|Wampu
920607|Wamesa (Idoor)
920705|Wamesa
950101|Wamena
950139|Wame
320220|Waluran
950325|Walma
731716|Walenrang Utara
731717|Walenrang Timur
731715|Walenrang Barat
731706|Walenrang
950106|Walelagama
320901|Waled
720903|Walea Kepulauan
720909|Walea Besar
810406|Waplau
940219|Wanwi
531211|Wanokaka
950723|Wano Barat
940416|Wania
330202|Wangon
740705|Wangi Wangi Selatan
740701|Wangi Wangi
750411|Wanggarasi
940105|Wanggar
940502|Wangbe
717107|Wanea
940703|Wandai
321409|Wanayasa
330417|Wanayasa
741203|Wawonii Timur Laut
741204|Wawonii Timur
741205|Wawonii Tenggara
741207|Wawonii Tengah
741206|Wawonii Selatan
741201|Wawonii Barat
740911|Wawolesea
520605|Wawo
740807|Wawo
180720|Waway Karya
740809|Watunohu
330710|Watumalang
350308|Watulimo
332704|Watukumpul
740108|Watubangga
740319|Watopute
367303|Walantaka
950114|Walaik
950433|Wakuwo
741006|Wakorumba Utara
740313|Wakorumba Selatan
810505|Wakate
737105|Wajo
350708|Wajak
530709|Waigete
920502|Waigeo Utara
920508|Waigeo Timur
920503|Waigeo Selatan
920515|Waigeo Barat Kepulauan
920507|Waigeo Barat
910313|Waibu
530713|Waiblama
350721|Wagir
810902|Waesama
810412|Waelata
940221|Waegi
810403|Waeapo
531001|Wae Rii
321101|Wado
330701|Wadaslintang
950124|Wadangku
741304|Wadaga
740429|Wabula
930119|Waan
130505|VII Koto Sungai Sarik
150911|VII Koto Ilir
150906|VII Koto
930310|Venaha
130514|V Koto Timur
130506|V Koto Kampung Dalam
170612|V Koto
940104|Uwapa
621210|Uut Murung
520406|Utan
950121|Usilimo
911508|Urei Faisei
170711|Uram Jaya
630910|Upau
910309|Unurum Guay
520422|Unter Iwes (Unterwiris)
930410|Unir Sirau
332713|Ulujami
727105|Ulujadi
741108|Uluiwoi
120427|Ulugawo
730306|Uluere
720906|Ulubongka
121210|Uluan
170513|Ulu Talo
122114|Ulu Sosa
161307|Ulu Rawas
121311|Ulu Pungkut
160120|Ulu Ogan
161103|Ulu Musi
122508|Ulu Moro'o (Ulu Narwo)
170109|Ulu Manna
121434|Ulu Idanotae
180615|Ulu Belu (Ulubelu)
122106|Ulu Barumun
170323|Ulok Kupai
111802|Ulim
930109|Ulilin
117109|Ulee Kareng
730814|Ulaweng
130510|Ulakan Tapakih
140501|Ukui
950319|Ukha
352507|Ujungpangkah (Ujung Pangkah)
730209|Ujungloe (Ujung Loe)
321125|Ujungjaya
327326|Ujungberung (Ujung Berung)
737108|Ujung Tanah
737104|Ujung Pandang
120830|Ujung Padang
730202|Ujung Bulu
332219|Ungaran Timur
332218|Ungaran Barat
210211|Ungar
331904|Undaan
740202|Unaaha
720901|Una Una
180815|Umpu Semenguk
121414|Umbunasi
350905|Umbulsari
347113|Umbulharjo
531706|Umbu Ratu Nggay Tengah
531702|Umbu Ratu Nggay Barat
531704|Umbu Ratu Nggay
531108|Umalulu
950408|Umagi
121424|Ulususua
121419|Ulunoyo
760505|Ulumanda (Ulumunda)
122012|Ujung Batu
140601|Ujung Batu
737202|Ujung
170802|Ujan Mas
160311|Ujan Mas
940707|Ugimba
740218|Uepai
741111|Ueesi
350502|Udanawu
510405|Ubud
950328|Ubalihi
950323|Ubahak
711001|Tutuyan
351402|Tutur
810506|Tutuk Tolu
760405|Tutar (Tubbi Taramanu, Tutallu)
730914|Turikale
352421|Turi
340415|Turi
350709|Turen
730408|Turatea
332206|Tuntang
331610|Tunjungan
360420|Tunjung Teja
150601|Tungkal Ulu
160612|Tungkal Jaya
160715|Tungkal Ilir
150602|Tungkal Ilir
350716|Tumpang
710512|Tumpaan
717102|Tuminting (Tuminiting)
181202|Tumijajar
610413|Tumbang Titi
350401|Tulungagung
160211|Tulung Selapan
331019|Tulung
332510|Tulis
650314|Tulin Onsoi
351509|Tulangan
181203|Tulang Bawang Udik
181201|Tulang Bawang Tengah
350110|Tulakan
120114|Tukka
321230|Tukdana
190306|Tukak Sadai
610717|Tujuh Belas
920612|Tuhiba
122403|Tuhemberua
111509|Tripa Makmur
180205|Trimurjo
950112|Trikora
111808|Trienggadeng
332311|Tretep
350311|Trenggalek
351604|Trawas
331821|Trangkil
352614|Tragah
732403|Towuti
740337|Towea
911107|Towe
710707|Touluaan Selatan
710706|Touluaan
720715|Totikum Selatan
720703|Totikum (Totikung)
351424|Tosari
720809|Torue
331504|Toroh
352702|Torjun
720813|Toribulu
122203|Torgamba
940207|Torere
911002|Tor Atas
760604|Topoyo
170706|Topos
940323|Topiyai
740620|Tontonunu
730805|Tonra
332906|Tonjong
740332|Tongkuno Selatan
740327|Tongkuno
740242|Tongauna Utara
740215|Tongauna
351323|Tongas
760211|Tommo
720805|Tomini
711107|Tomini
750507|Tomilito (Tomolito)
740707|Tomia Timur
740703|Tomia
710214|Tombulu
730610|Tombolopao (Tombolo Pao)
710710|Tombatu Utara
710709|Tombatu Timur
710705|Tombatu
710224|Tombariri Timur
710215|Tombariri
920317|Tomage
121412|Toma
750505|Tolinggula
720409|Toli-Toli Utara (Tolitoli Utara)
750113|Tolangohula
740815|Tolala
720907|Tojo Barat
720908|Tojo
720112|Toili Barat
720109|Toili
530216|Toianas
610206|Toho
740708|Togo Binongko
720902|Togean
331614|Todanan
530231|Tobu
920918|Tobouw
190301|Toboali
820310|Tobelo Utara
820312|Tobelo Timur
820311|Tobelo Tengah
820306|Tobelo Selatan
820313|Tobelo Barat
731012|Tondong Tallasa
732616|Tondon
710216|Tondano Utara
710202|Tondano Timur
710218|Tondano Selatan
710201|Tondano Barat
920619|Tomu
730911|Tompobulu (Tompu Bulu)
730603|Tompobullu (Tompobulu)
730304|Tompo Bulu (Tompobulu)
710502|Tompaso Baru
710225|Tompaso Barat
710207|Tompaso
940708|Tomosiga
930424|Tomor Birip
732409|Tomoni Timur
732408|Tomoni
717303|Tomohon Utara
717305|Tomohon Timur
717302|Tomohon Tengah
717301|Tomohon Selatan
717304|Tomohon Barat
321124|Tomo
160501|Tugumulyo
350305|Tugu
337416|Tugu
122408|Tugala Oyo
760507|Tubo Sendana
170709|Tubei (Pelabai)
930115|Tubang
352316|Tuban
140804|Tualang
620216|Tualan Hulu
147113|Tuahmadani
160520|Tuah Negeri
110116|Trumon Timur
110118|Trumon Tengah
110109|Trumon
352223|Trucuk
331006|Trucuk
351612|Trowulan
332615|Tirto
360413|Tirtayasa
321516|Tirtamulya
321509|Tirtajaya
731509|Tiroang
110721|Tiro/Truseb
351307|Tiris
741101|Tirawuta
920519|Tiplol Mayalibit
950708|Tiomneri
950714|Tiom Ollo
950701|Tiom
741109|Tinondo
720810|Tinombo Selatan
720803|Tinombo
337302|Tingkir
920920|Tinggouw
940208|Tingginambut
730604|Tinggimoncong
120926|Tinggi Raja
720719|Tinangkung Utara
720711|Tinangkung Selatan
720704|Tinangkung
740501|Tinanggea
760401|Tinambung
121507|Tinada
131006|Timpeh
620310|Timpah
950422|Timori
111707|Timang Gajah
750306|Tilongkabila
720507|Tiloan
130609|Tilatang Kamang
750118|Tilango
750204|Tilamuta
352423|Tikung
820305|Tobelo
760601|Tobadak
610313|Toba
740124|Toari
210112|Toapaya
331814|Tlogowungu
351103|Tlogosari
332314|Tlogomulyo
352801|Tlanakan
740814|Tiwu
741308|Tiworo Utara
741307|Tiworo Tengah
741305|Tiworo Selatan
741309|Tiworo Kepulauan
131008|Tiumang
110731|Titeue
530602|Titehena
350730|Tirtoyudo
331205|Tirtomoyo
827205|Tidore Utara
827208|Tidore Timur
827204|Tidore Selatan
827201|Tidore
750104|Tibawa
160518|Tiang Pumpung Kepungut
150224|Tiang Pumpung
930315|Ti Zain
620504|Teweh Timur
620505|Teweh Tengah
620508|Teweh Selatan
620507|Teweh Baru
620603|Tewang Sangalang Garing
621003|Tewah
110909|Teupah Tengah
110907|Teupah Selatan
110903|Teupah Barat
111401|Teunom
940410|Tembagapura
352221|Temayang
332303|Temanggung
810123|Telutih
360313|Teluknaga
321503|Telukjambe Timur
321527|Telukjambe Barat
187109|Telukbetung Utara
187119|Telukbetung Timur
187107|Telukbetung Selatan
187108|Telukbetung Barat
810515|Teluk Waru
940108|Teluk Umar
177103|Teluk Segara
620211|Teluk Sampit
920309|Teluk Patipi
180910|Teluk Pandan
640813|Teluk Pandan
611208|Teluk Pakedai
127404|Teluk Nibung
530501|Teluk Mutiara
330811|Tempuran
321520|Tempuran
610502|Tempunak
140405|Tempuling
190505|Tempilang
340414|Tempel
350805|Tempeh
731306|Tempe
340101|Temon
920401|Teminabuan
210412|Temiang Pesisir
920609|Tembuni
510603|Tembuku
140413|Tembilahan Hulu
140404|Tembilahan
351713|Tembelang
332302|Tembarak
337410|Tembalang
111304|Terangun (Terangon)
170608|Teramang Jaya
340307|Tepus
810510|Teor
810102|Teon Nila Serua
320140|Tenjolaya
320123|Tenjo
111611|Tenggulun
357824|Tenggilis Mejoyo
640216|Tenggarong Seberang
640206|Tenggarong
351108|Tenggarang
332202|Tengaran
320935|Tengah Tani
150909|Tengah Ilir
710509|Tenga
147110|Tenayan Raya
350801|Tempursari
350918|Tempurejo
170412|Tetap (Muara Tetap)
921208|Testega
180213|Terusan Nunyai
332506|Tersono
827108|Ternate Barat
321226|Terisi (Trisi)
111310|Teripe Jaya (Tripe Jaya)
640719|Tering
610709|Teriak
611204|Terentang
180207|Terbanggi Besar
170603|Teras Terunjam
330907|Teras
520303|Terara
750102|Telaga
350809|Tekung
610112|Tekarang
510809|Tejakula
950231|Teiraplu
810111|Tehoru
331518|Tegowanu
180903|Tegineneng
321408|Tegalwaru (Tegal Waru)
321528|Tegalwaru
351320|Tegalsiwalan (Tegal Siwalan)
351023|Tegalsari
357805|Tegalsari
330819|Tegalrejo
347101|Tegalrejo
350109|Tegalombo
510406|Tegallalang
351004|Tegaldlimo
320245|Tegalbuleud
351113|Tegalampel
337602|Tegal Timur
140509|Teluk Meranti
121803|Teluk Mengkudu
920509|Teluk Mayalibit
940109|Teluk Kimi
610102|Teluk Keramat
631012|Teluk Kepayang
810414|Teluk Kaiely
160223|Teluk Gelam
920804|Teluk Etna
810121|Teluk Elpaputih
920703|Teluk Duairi
940316|Teluk Deya
120931|Teluk Dalam
110905|Teluk Dalam
121406|Teluk Dalam
210108|Teluk Bintan
140416|Teluk Belengkong
640309|Teluk Bayur
611103|Teluk Batang
920806|Teluk Arguni Bawah (Yerusi)
920803|Teluk Arguni Atas
337603|Tegal Selatan
337601|Tegal Barat
150903|Tebo Ulu
150901|Tebo Tengah
150902|Tebo Ilir
141007|Tebing Tinggi Timur
127605|Tebing Tinggi Kota
141004|Tebing Tinggi Barat
150606|Tebing Tinggi
631108|Tebing Tinggi
141001|Tebing Tinggi
161104|Tebing Tinggi
121813|Tebing Tinggi
121816|Tebing Syahbandar
210205|Tebing
317401|Tebet
170803|Tebat Karai
610104|Tebas
331819|Tayu
817203|Tayando Tam
610310|Tayan Hulu
610311|Tayan Hilir
331103|Tawangsari
331306|Tawangmangu
331511|Tawangharjo
327803|Tawang
760314|Tawalian
727107|Tawaeli
710311|Tatoareng
710519|Tatapaan
727106|Tatanga
630319|Tatah Makmur
331310|Tasikmadu
141008|Tasik Putri Puyu
620611|Tasik Payawan
530402|Tasifeto Timur
530404|Tasifeto Barat
760108|Tikke Raya
717105|Tikala
732609|Tikala
130813|Tigo Nagari
130218|Tigo Lurah
940802|Tigi Timur
940804|Tigi Barat
940801|Tigi
360303|Tigaraksa
120604|Tigapanah (Tiga Panah)
120617|Tiganderket
121103|Tigalingga (Tiga Lingga)
120608|Tigabinanga (Tiga Binanga)
160918|Tiga Dihaji
910509|Teluk Ampimoi
817104|Teluk Ambon
210110|Telok Sebong (Teluk Sebong)
737304|Telluwanua
730825|Tellulimpoe (Tellu Limpoe)
730817|Tellu Siattinge
731402|Tellu Limpoe
730708|Tellu Limpoe
950435|Telenggeme
640807|Telen
620214|Telawang
157101|Telanaipura
321517|Telagasari (Talagasari)
630603|Telaga Langsat
750110|Telaga Biru
630318|Telaga Bauntung
620217|Telaga Antang
120201|Tarutung
950219|Tarup
321601|Tarumajaya
332814|Tarub
730411|Tarowang
350620|Tarokan
320505|Tarogong Kidul
320504|Tarogong Kaler
351501|Tarik
710513|Tareran
520425|Tarano
657104|Tarakan Utara
657103|Tarakan Timur
657102|Tarakan Tengah
657101|Tarakan Barat
320613|Taraju
121610|Tarabintang (Tara Bintang)
140112|Tapung Hulu
630903|Tanta
730907|Tanralili
331412|Tanon
110215|Tanoh Alas (Tanah Alas)
120330|Tano Tombangan Angkola
160427|Tanjungtebat (Tanjung Tebat)
321314|Tanjungsiang
320136|Tanjungsari
340317|Tanjungsari
321111|Tanjungsari
160401|Tanjungsakti Pumu (Tanjung Sakti Pumu)
321121|Tanjungmedar
321120|Tanjungkerta
187105|Tanjungkarang Timur (Tanjung Karang Timur)
187106|Tanjungkarang Pusat (Tanjung Karang Pusat)
187103|Tanjungkarang Barat (Tanjung Karang Barat)
320616|Tanjungjaya
127402|Tanjungbalai Utara (Tanjung Balai Utara)
127401|Tanjungbalai Selatan (Tanjung Balai Selatan)
351811|Tanjunganom
121906|Tanjung Tiram
140111|Tapung Hilir
140110|Tapung
327610|Tapos
630504|Tapin Utara
630503|Tapin Tengah
630502|Tapin Selatan
120107|Tapian Nauli
120828|Tapian Dolok
351110|Tapen
760407|Tapango
760213|Tapalang Barat
760202|Tapalang
110108|Tapaktuan (Tapak Tuan)
750301|Tapa
720814|Taopa
187111|Tanjung Senang
650105|Tanjung Selor
180122|Tanjung Sari
160424|Tanjung Sakti Pumi
640305|Tanjung Redeb
181107|Tanjung Raya
130603|Tanjung Raya
161003|Tanjung Raja
180304|Tanjung Raja
120511|Tanjung Pura (Tanjungpura)
317202|Tanjung Priok
217202|Tanjung Pinang Timur
217203|Tanjung Pinang Kota
217201|Tanjung Pinang Barat
190201|Tanjung Pandan
650103|Tanjung Palas Utara
650104|Tanjung Palas Timur
650106|Tanjung Palas Tengah
650102|Tanjung Palas Barat
650101|Tanjung Palas
130601|Tanjung Mutiara
120702|Tanjung Morawa
140716|Tanjung Medan
160202|Tanjung Lubuk
160712|Tanjung Lago
170402|Tanjung Kemuning
137202|Tanjung Harapan
640102|Tanjung Harapan
130303|Tanjung Gadang
130405|Tanjung Emas
530605|Tanjung Bunga
352609|Tanjung Bumi (Tanjungbumi)
180105|Tanjung Bintang
121805|Tanjung Beringin
161002|Tanjung Batu
120910|Tanjung Balai
170322|Tanjung Agung Palik
160301|Tanjung Agung
630904|Tanjung
520801|Tanjung
332913|Tanjung
130412|Tanjuang Baru (Tanjung Baru)
810610|Taniwel Timur
810603|Taniwel
810305|Tanimbar Utara
810301|Tanimbar Selatan
110719|Tangse
950318|Tangma
331519|Tanggungharjo
350419|Tanggunggunung (Tanggung Gunung)
351506|Tanggulangin
350906|Tanggul
320319|Tanggeung
740118|Tanggetada
367101|Tangerang
331419|Tangen
610117|Tangaran
111202|Tangan-Tangan
731102|Tanete Rilau
730823|Tanete Riattang Timur
730822|Tanete Riattang Barat
730821|Tanete Riattang
731101|Tanete Riaja
140611|Tandun
760309|Tanduk Kalua
357814|Tandes
731308|Tanasitolo
360414|Tanara
720319|Tanantovea
721010|Tanambulava
150801|Tanah Tumbuh
621207|Tanah Siang Selatan
621202|Tanah Siang
150817|Tanah Sepenggal Lintas
150805|Tanah Sepenggal
327106|Tanah Sareal (Tanah Sereal)
920217|Tanah Rubuh
140709|Tanah Putih Tanjung Melawan
140703|Tanah Putih
611011|Tanah Pinoh Barat
611006|Tanah Pinoh
121106|Tanah Pinem
110813|Tanah Pasir
930106|Tanah Miring
352613|Tanah Merah
140410|Tanah Merah
121431|Tanah Masa
110812|Tanah Luas
157204|Tanah Kampung
120811|Tanah Jawa
640104|Tanah Grogot
150122|Tanah Cogok
317107|Tanah Abang
161205|Tanah Abang
530717|Tana Wawo
531204|Tana Righu
630402|Tamban
357810|Tambaksari
320716|Tambaksari
331803|Tambakromo
352202|Tambakrejo
321325|Tambakdahan
352306|Tambakboyo
330208|Tambak
352518|Tambak
330921|Tamansari
327807|Tamansari
320131|Tamansari
351102|Tamanan
197102|Taman Sari
317303|Taman Sari
150511|Taman Rajo
351121|Taman Krocok
332709|Taman
357703|Taman
351513|Taman
640302|Talisayan
530708|Talibura
820804|Taliabu Utara
820806|Taliabu Timur Selatan
820805|Taliabu Timur
820807|Taliabu Selatan
820802|Taliabu Barat Laut
820801|Taliabu Barat
320537|Talegong
137304|Talawi
121905|Talawi
710609|Talawaan
720912|Talatako
352904|Talango
161201|Talang Ubi
180602|Talang Padang
161106|Talang Padang
140315|Talang Muandau
730402|Tamalatea
737110|Tamalate
737114|Tamalanrea
710312|Tamako
320914|Talun (Cirebon Selatan)
350514|Talun
332605|Talun
750407|Taluditi (Taluduti)
170512|Talo Kecil
170503|Talo
732611|Tallunglipu
737107|Tallo
520702|Taliwang
921206|Taige
332011|Tahunan
710324|Tahuna Timur
710323|Tahuna Barat
710317|Tahuna
921106|Tahota
710906|Tagulandang Utara
710910|Tagulandang Selatan
710903|Tagulandang
950431|Tagineri
950129|Tagineri
950440|Tagime
950127|Tagime
940224|Taganombak
950118|Taelarek
530124|Taebenu
111508|Tadu Raya
630401|Tabunganen
531105|Tabundung
760305|Tabulahan
710308|Tabukan Utara
160710|Talang Kelapa
170902|Talang Empat
332812|Talang
950329|Talambo
131204|Talamau
741405|Talaga Raya
750122|Talaga Jaya (Telaga Jaya)
321004|Talaga
367306|Taktakan
320316|Takokak
731303|Takkalalla
630101|Takisung
352004|Takeran
530111|Takari
730108|Taka Bonerate (Takabonerate)
320137|Tajurhalang
350715|Tajinan
732212|Tana Lili
650403|Tana Lia
710410|Tampan' Amma (Tampan Amma)
510404|Tampaksiring (Tampak Siring)
121222|Tampahan
760506|Tammerodo Sendana (Tammeredo Sendana)
111607|Tamiang Hulu
140609|Tambusai Utara
140604|Tambusai
321605|Tambun Utara
321606|Tambun Selatan
317304|Tambora
520614|Tambora
352708|Tambelangan
321604|Tambelang
210109|Tambelan
121310|Tambangan
630108|Tambang Ulang
140103|Tambang
620313|Tamban Catur
710314|Tabukan Tengah
710320|Tabukan Selatan Tenggara
710319|Tabukan Selatan Tengah
710315|Tabukan Selatan
630412|Tabukan
930118|Tabonji
750119|Tabongo
820808|Tabona
150207|Tabir Ulu
150215|Tabir Timur
150208|Tabir Selatan
150222|Tabir Lintas
150214|Tabir Ilir
150223|Tabir Barat
150205|Tabir
760310|Tabang
640212|Tabang
510205|Tabanan
640310|Tabalar
170906|Taba Penanjung
110814|T. Jambo Aye (Tanah Jambo Aye)
920907|Syujak
111703|Syiah Utama
117104|Syiah Kuala
110811|Syamtalira Bayu
110810|Syamtalira Aron
930311|Syahcame
910615|Swandiwe
520316|Suwela (Suela)
750311|Suwawa Timur
750313|Suwawa Tengah
750312|Suwawa Selatan
750303|Suwawa
350512|Sutojayan
610710|Suti Semarang
130108|Sutera
510601|Susut
320908|Susukan Lebak
332203|Susukan
330401|Susukan
320927|Susukan
121409|Susua
111204|Susoh
921204|Sururey
332204|Suruh
350314|Suruh
930408|Suru-suru
950309|Suru Suru
111012|Suro Makmur
321109|Surian
320939|Suranenggala
520313|Suralaga
320224|Surade
332816|Suradadi (Surodadi)
731502|Suppa
920523|Supnin
911902|Supiori Utara
911903|Supiori Timur
911901|Supiori Selatan
911905|Supiori Barat
180409|Suoh
950341|Suntamon
920146|Sunook
180308|Sungkai Utara
180318|Sungkai Tengah
180303|Sungkai Selatan
180320|Sungkai Jaya
180321|Sungkai Barat
120723|Sunggal
130407|Sungayang
190101|Sungailiat (Sungai Liat)
650215|Sungai Tubu
610520|Sungai Tebelian
130408|Sungai Tarab
630810|Sungai Tabukan
630304|Sungai Tabuk
177108|Sungai Serut
147204|Sungai Sembilan
190403|Sungai Selan
170615|Sungai Rumbai
131003|Sungai Rumbai
160316|Sungai Rotan
610715|Sungai Raya Kepulauan
110319|Sungai Raya
611201|Sungai Raya
630601|Sungai Raya
631003|Sungai Loban
130508|Sungai Limau
160607|Sungai Lilin
610407|Sungai Laur
140211|Sungai Lala
610212|Sungai Kunyit
647206|Sungai Kunjang
160603|Sungai Keruh
122204|Sungai Kanan (Sei)
611209|Sungai Kakap
150508|Sungai Gelam
130507|Sungai Garingging
630215|Sungai Durian (Sungaidurian)
157208|Sungai Bungkal
650209|Sungai Boh
610714|Sungai Betung
131201|Sungai Beremas (Sei Beremas)
140420|Sungai Batang
150507|Sungai Bahar
621208|Sungai Babuat
131209|Sungai Aur (Sungaiaur)
160915|Sungai Are
140802|Sungai Apit
611203|Sungai Ambawang
920614|Sumuri (Simuri)
327319|Sumur Bandung
360101|Sumur
130309|Sumpur Kudus
330207|Sumpiuh
332209|Sumowono
351711|Sumobito
950351|Sumo
321118|Sumedang Utara
321117|Sumedang Selatan
121102|Sumbul
351118|Sumberwringin (Sumber Wringin)
350821|Sumbersuko
350921|Sumbersari (Sumber Sari)
350712|Sumberpucung
350704|Sumbermanjing Wetan
610701|Sungai Raya
130612|Sungai Pua (Puar)
610207|Sungai Pinyuh (Sei Pinyuh)
647208|Sungai Pinang
630310|Sungai Pinang
161012|Sungai Pinang
157201|Sungai Penuh
630803|Sungai Pandan
131102|Sungai Pagu
160215|Sungai Menang
610425|Sungai Melayu Rayak
110503|Sungai Mas
140805|Sungai Mandau
150204|Sungai Manau
351215|Sumbermalang
331415|Sumberlawang
321017|Sumberjaya
350931|Sumberjambe (Sumber Jambe)
350410|Sumbergempol
180613|Sumberejo (Sumber Rejo)
352212|Sumberejo
350903|Sumberbaru (Sumber Baru)
351321|Sumberasih
160718|Sumber Marga Telang
180405|Sumber Jaya
160519|Sumber Harta
621205|Sumber Barito
320915|Sumber
331701|Sumber
351302|Sumber
357304|Sukun
321224|Sukra
350929|Sukowono
352224|Sukosewu
351104|Sukosari
350215|Sukorejo
357202|Sukorejo
332403|Sukorejo
351409|Sukorejo
352401|Sukorame
350915|Sukorambi
351812|Sukomoro
352009|Sukomoro
357827|Sukomanunggal
331801|Sukolilo
357809|Sukolilo
331104|Sukoharjo
330714|Sukoharjo
181008|Sukoharjo
520408|Sumbawa
330221|Sumbang
150905|Sumay
760306|Sumarorong
750511|Sumalata Timur
750504|Sumalata
710523|Suluun Tareran
117504|Sultan Daulat
620710|Suling Tambun
130701|Suliki
731719|Suli Barat
731703|Suli
331708|Sulang
530107|Sulamu
820508|Sulabesi Timur
820507|Sulabesi Tengah
820509|Sulabesi Selatan
820503|Sulabesi Barat
351514|Sukodono
331417|Sukodono
350815|Sukodono
352417|Sukodadi
327605|Sukmajaya
940605|Sukikai Selatan
320515|Sukawening
510401|Sukawati
321603|Sukawangi
180411|Sukau
321615|Sukatani
321405|Sukatani
321324|Sukasari
321112|Sukasari
321415|Sukasari
327301|Sukasari
510805|Sukasada
320313|Sukaresmi
360129|Sukaresmi
320521|Sukaresmi
320639|Sukaresik
320631|Sukaratu
167107|Sukarami
187102|Sukarame
320626|Sukarame
170501|Sukaraja
320104|Sukaraja
320233|Sukaraja
320617|Sukaraja
351301|Sukapura
320314|Sukanagara
360327|Sukamulya
520306|Sukamulia
160429|Sukamerindu
620801|Sukamara
320733|Sukamantri
110606|Sukamakmur (Suka Makmur)
320109|Sukamakmur
117203|Sukamakmue
732213|Sukamaju Selatan
732206|Sukamaju
320309|Sukaluyu
320236|Sukalarang
117201|Sukakarya
321614|Sukakarya
117202|Sukajaya
320135|Sukajaya
327307|Sukajadi
147101|Sukajadi
320633|Sukahening
321008|Sukahaji
321227|Sukagumiwang
360310|Sukadiri
611101|Sukadana
180701|Sukadana
320714|Sukadana
187112|Sukabumi
320232|Sukabumi
111506|Suka Makmue
160521|Suka Karya (Sukakarya)
120118|Suka Bangun
610622|Suhaid
352412|Sugio
352207|Sugihwaras
210214|Sugie Besar
940701|Sugapa
350112|Sudimoro
320542|Sucinaraja
930215|Subur
351203|Suboh
210309|Subi
320803|Subang
321303|Subang
332509|Subah
610110|Subah
930407|Suator
160716|Suak Tapeh
210322|Suak Midai
120720|STM Hulu (Sinembah Tanjung Muda Hulu)
120708|STM Hilir (Sinembah Tanjung Muda Hilir)
160510|STL Ulu Terawas (Suku Tengah Lakitan Ulu Terawas)
120507|Stabat
330514|Sruweng
330805|Srumbung
351008|Srono
352701|Sreseh
350503|Srengat
340201|Srandakan
180115|Sragi
332610|Sragi
331410|Sragen
911515|Soyoi Mambai
721207|Soyo Jaya
920713|Soug Jaya
930108|Sota
120109|Sosorgadong (Sosor Gadong)
122101|Sosopan
160107|Sosoh Buay Rayap
122117|Sosa Timur
122115|Sosa Julu
122108|Sosa
740211|Soropia
927105|Sorong Utara
927102|Sorong Timur
927106|Sorong Manoi
927107|Sorong Kota
927104|Sorong Kepulauan
927103|Sorong Barat
920143|Sorong
927101|Sorong
520615|Soromandi
120110|Sorkam Barat
120102|Sorkam
737203|Soreang
320437|Soreang
747203|Sorawolio (Sora Walio / Sorowalio)
930425|Sor Ep
731104|Soppeng Riaja
732608|Sopai
350206|Sooko
351613|Sooko
351019|Songgon
332910|Songgom
710211|Sonder
610813|Sompak
120429|Somolo-Molo (Samolo)
730608|Somba Opu (Upu)
121426|Somambawa
330209|Somagede
530607|Solor Timur
530619|Solor Selatan
530606|Solor Barat
352415|Solokuro
320434|Solokanjeruk (Solokan Jeruk)
950336|Soloikma
360331|Solear
352711|Sokobanah
352311|Soko
330219|Sokaraja
611007|Sokan
720330|Sojol Utara
720314|Sojol
120435|Sogae'adu (Sogae Adu / Sogaeadu)
320612|Sodonghilir
352602|Socah
360135|Sobang
360222|Sobang
950343|Sobaham
950316|Soba
530907|Soa
331713|Sluke
331219|Slogohimo
121501|Sitelu Tali Urang Jehe (Sitellu)
120113|Sitahuis
122502|Sirombu
940106|Siriwo
940307|Siriwo
810514|Siritaun Wida Timur
817102|Sirimau
930417|Sirets
720311|Sirenja
120521|Sirapit (Serapit)
120111|Sirandorung
332905|Sirampog
160208|Sirah Pulau Padang
810706|Sir-Sir
130908|Sipora Utara
130902|Sipora Selatan
120204|Sipoholon
121808|Sipispis
321212|Sliyeg
340413|Sleman
332810|Slawi
350201|Slahung
911105|Skanto
332617|Siwalan
810507|Siwalalat
150118|Siulak Mukai
150116|Siulak
321106|Situraja
130710|Situjuah Limo Nagari (Situjuah Lima Nagari)
351207|Situbondo
122404|Sitolu Ori
131004|Sitiung
121709|Sitio-tio
121115|Sitinjo
150104|Sitinjau Laut
121504|Sitelu Tali Urang Julu (Sitellu)
120304|Sipirok
757107|Sipatana
120212|Sipahutar
740427|Siotapina (Siontapia / Siontapina)
741505|Siompu Barat
741506|Siompu
121322|Sinunukan
130511|Sintuak Toboh Gadang
610501|Sintang
710508|Sinonsayang
730308|Sinoa
730705|Sinjai Utara
730703|Sinjai Timur
730704|Sinjai Tengah
730702|Sinjai Selatan
730707|Sinjai Borong
730701|Sinjai Barat
720817|Siniu
350724|Singosari
332405|Singorojo
351012|Singojuruh
150309|Singkut
610422|Singkup
111013|Singkohor
111010|Singkil Utara
717103|Singkil
111004|Singkil
210409|Singkep Selatan
210406|Singkep Pesisir
210404|Singkep Barat
210401|Singkep
617204|Singkawang Utara
617203|Singkawang Timur
617201|Singkawang Tengah
617205|Singkawang Selatan
617202|Singkawang Barat
140908|Singingi Hilir
140903|Singingi
352307|Singgahan
177109|Singaran Pati
320624|Singaparna
320524|Singajaya
352101|Sine
720324|Sindue Tombusabora
720325|Sindue Tobata
720310|Sindue
321021|Sindangwangi
360131|Sindangresmi
321714|Sindangkerta
320731|Sindangkasih
320321|Sindangbarang
320831|Sindangagung (Sindang Agung)
170208|Sindang Kelingi
360329|Sindang Jaya
170222|Sindang Dataran (Sindang Daratan)
160916|Sindang Danau
170221|Sindang Beliti Ulu
170223|Sindang Beliti Ilir
321216|Sindang
321025|Sindang
160129|Sinar Peninjauan
940515|Sinak Barat
940506|Sinak
140707|Sinaboi (Senaboi)
121428|Simuk
630606|Simpur
320202|Simpenan
110309|Simpang Ulim
110618|Simpang Tiga
110718|Simpang Tiga
190502|Simpang Teritip
190304|Simpang Rimba
190606|Simpang Renggiang
720117|Simpang Raya
190607|Simpang Pesak
181105|Simpang Pematang
111111|Simpang Mamplam
110822|Simpang Kramat (Keramat)
117501|Simpang Kiri
190404|Simpang Katis
140711|Simpang Kanan
111002|Simpang Kanan
110320|Simpang Jernih
610408|Simpang Hulu
611102|Simpang Hilir
120912|Simpang Empat
631006|Simpang Empat
630308|Simpang Empat
120612|Simpang Empat
350210|Siman
640717|Siluq Ngurai
137303|Silungkang
120827|Silou Kahean
950130|Silo Karno Doga
350930|Silo
351022|Siliragung
121811|Silinda
950304|Silimo
120825|Silimakuta
121105|Silima Pungga Pungga
110402|Silih Nara
710708|Silian Raya
130115|Silaut
120928|Silau Laut
610616|Silat Hulu
610615|Silat Hilir
610420|Simpang Dua
130816|Simpang Alahan Mati
160905|Simpang
357811|Simokerto
330913|Simo
110904|Simeulue Timur (Simeuleu Timur)
110901|Simeulue Tengah (Simeuleu Tengah)
110910|Simeulue Cut
110906|Simeulue Barat (Simeuleu Barat)
731809|Simbuang
760212|Simboro (Simboro dan Kepulauan)
730909|Simbang
121701|Simanindo
120207|Simangumban
122008|Simangambat
122205|Silangkitang
121114|Silahisabungan (Silahi Sabungan)
121203|Silaen
520304|Sikur
161108|Sikap Dalam
130909|Sikakap
130304|Sijunjung
190204|Sijuk
121607|Sijamapolang (Sijama Polang)
122112|Sihapas Barumun
121219|Sigumpar
721001|Sigi Biromaru
330407|Sigaluh
950120|Siepkosi
121508|Siempat Rube
121107|Siempat Nempu Hulu
121108|Siempat Nempu Hilir
121104|Siempat Nempu
121425|Sidua'ori
337301|Sidorejo
352018|Sidorejo
180107|Sidomulyo
337304|Sidomukti
331411|Sidoharjo
331214|Sidoharjo
351508|Sidoarjo
720823|Sidoan
610712|Siding
121101|Sidikalang
920221|Sidey
510702|Sidemen
352509|Sidayu
330111|Sidareja
321810|Sidamulih
120809|Sidamanik
730808|Sibulue
120209|Siborong-Borong
127301|Sibolga Utara
127303|Sibolga Selatan
127304|Sibolga Sambas
127302|Sibolga Kota
120703|Sibolangit
130904|Siberut Utara
130907|Siberut Tengah
130903|Siberut Selatan
130906|Siberut Barat Daya
130905|Siberut Barat
140206|Siberida (Seberida)
120108|Sibabangun
710904|Siau Timur Selatan
710901|Siau Timur
710909|Siau Tengah
710908|Siau Barat Utara
710905|Siau Barat Selatan
710902|Siau Barat
120202|Siatas Barita
127203|Siantar Utara
127201|Siantar Timur
127207|Siantar Sitalasari
127204|Siantar Selatan
121220|Siantar Narumonda
127206|Siantar Martoba
127208|Siantar Marimbun
127205|Siantar Marihat
127202|Siantar Barat
120801|Siantar
210508|Siantan Utara
210503|Siantan Timur
210507|Siantan Tengah
210504|Siantan Selatan
210501|Siantan
121706|Sianjar Mula Mula (Sianjur)
140312|Siak Kecil
140106|Siak Hulu
140801|Siak
121306|Siabu
340405|Seyegan
920411|Seremuk
110305|Serbajadi
121812|Serba Jadi
610514|Serawai
210319|Serasan Timur
210306|Serasan
321323|Serangpanjang
321621|Serang Baru
367301|Serang
620212|Seranau
950215|Serambakon
810124|Seram Utara Timur Seti
810125|Seram Utara Timur Kobi
810120|Seram Utara Barat
810106|Seram Utara
810502|Seram Timur
810602|Seram Barat
910302|Sentani Timur
910304|Sentani Barat
910301|Sentani
140914|Sentajo Raya
352305|Senori
920911|Senopi
911103|Senggi
610807|Sengah Temila
317104|Senen
350812|Senduro
180222|Sendang Agung
350407|Sendang
760503|Sendana
737307|Sendana
210403|Senayang
147105|Senapelan
351020|Sempu
330518|Sempor
351119|Sempol
610113|Semparuk
610610|Semitau
340312|Semin
150910|Serai Serumpun
950342|Seradala
180212|Seputih Surabaya
180208|Seputih Raman
180211|Seputih Mataram
180210|Seputih Banyak
180216|Seputih Agung
352608|Sepulu
611105|Seponti
610503|Sepauk
360330|Sepatan Timur
360316|Sepatan
621001|Sepang (Sepang Simin)
640904|Sepaku
150613|Senyerang
340106|Sentolo
111207|Setia
520703|Seteluk (Sateluk)
930218|Sesnuk
760308|Sesenapadang
732619|Sesean Suloara
732602|Sesean
650402|Sesayap Hilir
650401|Sesayap
620702|Seruyan Tengah
620707|Seruyan Raya
620705|Seruyan Hulu
620706|Seruyan Hilir Timur
620701|Seruyan Hilir
111604|Seruway
367402|Serpong Utara
367401|Serpong
510802|Seririt
621209|Seribu Riam
210115|Seri Kuala Lobam (Sri)
337202|Serengan
170911|Semidang Lagan
170408|Semidang Gumay / Gumai
170505|Semidang Alas Maras
170504|Semidang Alas
160121|Semidang Aji
160310|Semende Darat Ulu
160309|Semende Darat Tengah
160308|Semende Darat Laut
160815|Semendawai Timur
160808|Semendawai Suku III
160814|Semendawai Barat
350601|Semen
350907|Semboro
131005|Sembilan Koto
160717|Sembawa
520315|Sembalun
650316|Sembakung Atulai
650303|Sembakung
530123|Semau Selatan
530104|Semau
620906|Sematu Jaya
167116|Sematangborang (Sematang Borang)
337402|Semarang Utara
337403|Semarang Timur
337401|Semarang Tengah
337407|Semarang Selatan
337413|Semarang Barat
340308|Semanu
930105|Semangga
352315|Semanding
357816|Semampir
180612|Semaka
110210|Semadam
170211|Selupu Rejang
170510|Seluma Utara
170509|Seluma Timur
170511|Seluma Selatan
170508|Seluma Barat
170502|Seluma
610705|Seluas
350521|Selorejo
350522|Selopuro
332315|Selopampang
520307|Selong
330706|Selomerto
331211|Selogiri
330901|Selo
610609|Selimbau
120506|Selesai
920929|Selemkai
510202|Selemadeg Timur (Salamadeg Timur, Salemadeg Timur)
510203|Selemadeg Barat (Salemadeg Barat)
510201|Selemadeg
177101|Selebar
210408|Selayar
160721|Selat Penuguan
190203|Selat Nasik
210213|Selat Gelam
510707|Selat
620301|Selat
810302|Selaru
527105|Selaprang (Selaparang)
160511|Selangit
610119|Selakau Timur
610107|Selakau
320815|Selajambe
170609|Selagan Raya
180220|Selagai Lingga
320539|Selaawi
950337|Sela
217103|Sekupang
520107|Sekotong
520704|Sekongkang
640720|Sekolaq Darat
732207|Seko
180408|Sekincau
150502|Sekernan
111612|Sekerak
160601|Sekayu
610307|Sekayam
650109|Sekatak
527104|Sekarbela
352409|Sekaran
352227|Sekar
180712|Sekampung Udik
180705|Sekampung
610902|Sekadau Hulu
610901|Sekadau Hilir
610106|Sejangkung
340215|Sewon
110809|Seunuddon (Seunudon)
111503|Seunagan Timur
111502|Seunagan
110604|Seulimeum
367407|Setu
321618|Setu
317402|Setiabudi (Setia Budi)
120927|Setia Janji
111403|Setia Bhakti (Setia Bakti)
127403|Sei Tualang Raso
121902|Sei Suka
121804|Sei Rampah
650313|Sei Menggaris
120517|Sei Lepan
120925|Sei Kepayang Timur
120924|Sei Kepayang Barat
120911|Sei Kepayang
120923|Sei Dadap
120504|Sei Bingai (Sei Binge / Bingei)
217107|Sei Beduk (Sungai Beduk)
121815|Sei Bamban
121907|Sei Balai
920112|Segun
170102|Seginim
920106|Seget
731009|Segeri
610215|Segedong
640304|Segah
320909|Sedong
340217|Sedayu
351517|Sedati
331706|Sedan
120509|Secanggang
330820|Secang
640207|Sebulu
650306|Sebuku
610611|Seberuang
167102|Seberang Ulu Satu (Seberang Ulu I)
167103|Seberang Ulu Dua (Seberang Ulu II)
170807|Seberang Musi
150610|Seberang Kota
610115|Sebawi
650311|Sebatik Utara
650310|Sebatik Timur
650312|Sebatik Tengah
650308|Sebatik Barat
650301|Sebatik
610810|Sebangki
621108|Sebangau Kuala
120321|Sayur Matinggi
332104|Sayung
920155|Sayosa Timur
920110|Sayosa
611005|Sayan
350205|Sawoo
122402|Sawo
120520|Sawit Seberang
330908|Sawit
920406|Sawiat
741301|Sawerigadi
330807|Sawangan
327603|Sawangan
110815|Sawang
110107|Sawang
510807|Sawan
150303|Sarolangun
911013|Sarmi Timur
911012|Sarmi Selatan
911001|Sarmi
760111|Sarjo
320630|Sariwangi
352427|Sarirejo
717106|Sario
331705|Sarang
351912|Saradan
330703|Sapuran
340315|Saptosari (Sapto Sari)
352925|Sapeken
520606|Sape
810126|Saparua Timur
810112|Saparua
530225|Santian
730508|Sanrobone
531504|Sano Nggoang
640805|Sangkulirang
710801|Sangkub
352517|Sangkapura
131104|Sangir Jujuan
131105|Sangir Batang Hari
131107|Sangir Balai Janggo
131101|Sangir
741407|Sangia Wambulu
610706|Sanggau Ledo
520609|Sanggar
732607|Sanggalangi
640804|Sangatta Utara
640812|Sangatta Selatan
731834|Sangalla Utara
731833|Sangalla Selatan
731813|Sangalla (Sanggala)
640215|Sanga Sanga
160605|Sanga Desa
710105|Sang Tombolang
527106|Sandubaya (Sandujaya)
340202|Sanden
640811|Sandaran
610405|Sandai
357203|Sananwetan (Sanan Wetan)
350507|Sanankulon (Sanan Kulon)
820518|Sanana Utara
820502|Sanana
620606|Sanaman Mantikei (Senamang Mantikei)
110808|Samudera
350214|Sampung
741502|Sampolawa
111404|Sampoi Niet (Sampoiniet)
740205|Sampara
352703|Sampang
330117|Sampang
630212|Sampanahan
760208|Sampaga
910612|Samofa
340111|Samigaluh
912008|Sawai
351914|Sawahan
357806|Sawahan
351801|Sawahan
317102|Sawah Besar
930403|Sawa Erma
740907|Sawa
720806|Sausu
920905|Sausapor
631004|Satui
531018|Satar Mese Utara
531013|Satar Mese Barat
531005|Satar Mese
532107|Sasitamean
131211|Sasak Ranah Pasisie (Pesisir, Pasisir, Pesisie)
760104|Sarudu
120120|Sarudik
352906|Saronggi
110717|Sakti
520318|Sakra Timur
520319|Sakra Barat
520302|Sakra
167108|Sako
360114|Saketi
731304|Sajoanging
360212|Sajira
610109|Sajingan Besar
610114|Sajad
120305|Saipar Dolok Hole
147103|Sail
920422|Saifi
820109|Sahu Timur
820104|Sahu
161109|Saling
130410|Salimpaung (Salimpauang)
710411|Salibabu
332901|Salem
331704|Sale
320614|Salawu
920504|Salawati Utara
920153|Salawati Tengah
920522|Salawati Tengah
920114|Salawati Selatan
920521|Salawati Barat
920105|Salawati
610118|Salatiga
120502|Salapian
110902|Salang
330801|Salaman
630511|Salam Babaris
330804|Salam
121503|Salak
810114|Salahutu
950305|Samenage
647207|Sambutan
331407|Sambungmacan (Sambung Macan)
630316|Sambung Makmur
331606|Sambong
640220|Samboja Barat
640213|Samboja (Semboja)
350204|Sambit
331405|Sambirejo
357831|Sambikerep
531904|Sambi Rampas
330910|Sambi
352411|Sambeng
520310|Sambelia (Sambalia)
610101|Sambas
640303|Sambaliung
740120|Samaturu
110505|Samatiga
647205|Samarinda Utara
647203|Samarinda Ulu
647202|Samarinda Seberang
647209|Samarinda Kota
647204|Samarinda Ilir
320507|Samarang
610702|Samalantan
111101|Samalanga
110106|Samadua (Sama Dua)
731801|Saluputi (Saluputti)
320618|Salopa
730804|Salomekko
140113|Salo
920425|Salkma
217111|Sagulung
321716|Saguling
320241|Sagaranten
321301|Sagalaherang
930416|Safan
920148|Saengkeduk
150705|Sadu
610217|Sadaniang
330522|Sadang
320704|Sadananya
740524|Sabulakoa
532003|Sabu Timur
532002|Sabu Tengah
532004|Sabu Liae
532001|Sabu Barat
732215|Sabbang Selatan
732204|Sabbang
731301|Sabangparu
627104|Sabangau (Sebangau)
140812|Sabak Auh
732606|Sa'dan
531003|Ruteng
110421|Rusip Antara
161301|Rupit
140311|Rupat Utara
140310|Rupat
160914|Runjung Agung
357803|Rungkut
621010|Rungan Hulu
621012|Rungan Barat
621005|Rungan
117503|Rundeng
320118|Rumpin
140114|Rumbio Jaya
740618|Rumbia Tengah
180209|Rumbia
730410|Rumbia
740604|Rumbia
920706|Rumberpon
147115|Rumbai Timur
147106|Rumbai Barat
147112|Rumbai (Rumbai Pesisir)
912003|Rufaer
352915|Rubaru
332416|Rowosari
330517|Rowokele
350808|Rowokangkung
740223|Routa
531406|Rote Timur
531404|Rote Tengah
531408|Rote Selatan
531402|Rote Barat Laut
531401|Rote Barat Daya
531407|Rote Barat
920711|Roswar
520411|Ropang
920710|Roon
340311|Rongkop
732205|Rongkong (Limbong)
121707|Ronggur Nihuta
321713|Rongga
140602|Rokan IV Koto
351013|Rogojampi
352710|Robatal
530914|Riung Barat
530909|Riung
911507|Risei Sayati
720304|Rio Pakava
532105|Rinhat
350623|Ringinrejo
332418|Ringinarum
732604|Rindingallo
531109|Rindi
150907|Rimbo Ulu
150813|Rimbo Tengah
170705|Rimbo Pengadang
150908|Rimbo Ilir
150904|Rimbo Bujang
140704|Rimba Melintang
730210|Rilauale (Rilau Ale)
111303|Rikit Gaib
190107|Riau Silip
520421|Rhee
140401|Reteh
531016|Reok Barat
531011|Reok
352314|Rengel
140202|Rengat Barat
140201|Rengat
321506|Rengasdengklok
510701|Rendang
150216|Renah Pembarap
150219|Renah Pamenang (Renah Pemenang)
150608|Renah Mendaluh
731820|Rembon
710208|Remboken
161302|Rawas Ulu
161304|Rawas Ilir
120929|Rawang Panca Arga
321518|Rawamerta
327505|Rawalumbu
330204|Rawalo
180522|Rawa Pitu
181103|Rawa Jitu Utara
180518|Rawa Jitu Timur (Rawajitu Timur)
180512|Rawa Jitu Selatan (Rawajitu Selatan)
910317|Raveni Rara (Ravenirara)
177107|Ratu Samban
177106|Ratu Agung
720910|Ratolindo
710704|Ratatotok
710712|Ratahan Timur
710701|Ratahan
920708|Rasiei
611207|Rasau Jaya
527202|Rasanae Timur
527201|Rasanae Barat
740609|Rarowatu Utara
740603|Rarowatu
140713|Rantau Kopar
160711|Rantau Bayur
630407|Rantau Badauh
161006|Rantau Alai
111608|Rantau
921101|Ransiki
710503|Ranoyapo
717203|Ranowulu (Bitung Utara)
740522|Ranomeeto Barat
740508|Ranomeeto
731837|Rano
141009|Rangsang Pesisir
141002|Rangsang Barat
141003|Rangsang
197104|Rangkui
360214|Rangkasbitung
332707|Randudongkal
331602|Randublatung
350818|Randuagung
750403|Randangan
327323|Rancasari
321116|Rancakalong
320715|Rancah
320428|Rancaekek
320440|Rancabali (Ranca Bali)
320134|Ranca Bungur
130102|Ranah Pesisir
131207|Ranah Batahan
130114|Ranah Ampek Hulu Tapan
531907|Rana Mese
732209|Rampi
160706|Rambutan
127602|Rambutan
350913|Rambipuji
130403|Rambatan
160303|Rambang Niru (Rambang Dangku)
330313|Rembang
331710|Rembang
351415|Rembang
350413|Rejotangan
351423|Rejoso
351816|Rejoso
327311|Regol
180809|Rebang Tangkas
332504|Reban
120807|Raya Kahean
120829|Raya
621308|Raren Batuah
737113|Rappocini
130818|Rao Utara
130819|Rao Selatan
130814|Rao
350820|Ranuyoso
121318|Ranto Baek
731811|Rantetayo
732601|Rantepao
760315|Rantebulahan Timur
732618|Rantebua
740804|Rante Angin
121001|Rantau Utara
121002|Rantau Selatan
110308|Rantau Selamat
150704|Rantau Rasau
640814|Rantau Pulung
110310|Rantau Peureulak (Ranto Peureulak)
161011|Rantau Panjang
150802|Rantau Pandan
161014|Rambang Kuang
167404|Rambang Kapak Tengah
160315|Rambang
140607|Rambah Samo
140608|Rambah Hilir
140603|Rambah
180709|Raman Utara
627105|Rakumpit
140213|Rakit Kulim
330411|Rakit
360311|Rajeg
320634|Rajapolah
321009|Rajagaluh
320713|Rajadesa
187110|Rajabasa
180116|Raja Basa (Rajabasa)
350615|Purwoasri
321529|Purwasari
331217|Purwantoro
330404|Purwanegara (Purwonegoro)
321401|Purwakarta
367207|Purwakarta
327903|Purwaharja
320735|Purwadadi
321306|Purwadadi
610623|Puring Kencana
330503|Puring
740217|Puriala
351611|Puri
530513|Pureman
180708|Purbolinggo
327810|Purbaratu
330305|Purbalingga
120208|Purba Tua (Purbatua)
120814|Purba
320238|Purabaya
510210|Pupuan
350103|Punung
180206|Punggur
351606|Pungging
330412|Punggelan
180906|Punduh Pidada
340204|Pundong
350608|Puncu
121320|Puncak Sorik Marapi
710415|Pulutan
350207|Pulung
750116|Pulubala
360132|Pulosari
332702|Pulosari
367203|Pulomerak
331506|Pulokulon
351408|Purwosari
352218|Purwosari
340318|Purwosari
330606|Purworejo
357502|Purworejo
330402|Purworeja Klampok (Purworejo Klampok)
330227|Purwokerto Utara
330226|Purwokerto Timur
330224|Purwokerto Selatan
330225|Purwokerto Barat
330213|Purwojati
351003|Purwoharjo
160513|Purwodadi
330603|Purwodadi
331513|Purwodadi
351401|Purwodadi
710403|Rainis
910508|Raimbawi
530413|Raimanuk
532006|Raijua
530403|Raihat
120922|Rahuning (Rahunig)
531014|Rahong Utara
527204|Raba
352922|Ra'as (Raas)
747109|Puuwatu
610601|Putussibau Utara
610617|Putussibau Selatan
170314|Putri Hijau
180228|Putra Rumbia
111307|Puteri Betung (Putri Betung)
351403|Puspo
320615|Puspahiang
710702|Pusomaen
140814|Pusako
321310|Pusakanagara
321330|Pusakajaya
317502|Pulogadung (Pulo Gadung)
120930|Pulo Bandring
360408|Pulo Ampel
110613|Pulo Aceh
350303|Pule
950330|Puldama
160408|Pulaupinang (Pulau Pinang)
141006|Pulaumerbau
630222|Pulaulaut Sigam
817204|Pulau-Pulau Kur
121430|Pulau-Pulau Batu Utara
121416|Pulau-Pulau Batu Timur
121429|Pulau-Pulau Batu Barat
121405|Pulau-Pulau Batu
810805|Pulau-pulau Babar Timur
810701|Pulau-Pulau Aru
910514|Pulau Yerui
810811|Pulau Wetang
210321|Pulau Tiga Barat
930412|Pulau Tiga
210311|Pulau Tiga
827101|Pulau Ternate
630201|Pulau Sembilan (Pulausembilan)
730709|Pulau Sembilan
210324|Pulau Seluan
630205|Pulau Sebuku (Pulausebuku)
160704|Pulau Rimau
820706|Pulau Rao
120914|Pulau Rakyat
530511|Pulau Pura
131002|Pulau Punjung
181306|Pulau Pisang (Pulaupisang)
620306|Pulau Petak
810509|Pulau Panjang
210323|Pulau Panjang
180604|Pulau Panggung
611104|Pulau Maya (Pulau Maya Karimata)
810809|Pulau Masela
620604|Pulau Malan
820401|Pulau Makian
810808|Pulau Leti (Letti Moa Lakor)
630206|Pulau Laut Utara (Pulaulaut Utara)
630204|Pulau Laut Timur (Pulaulaut Timur)
630216|Pulau Laut Tengah (Pulaulaut Tengah)
630221|Pulau Laut Tanjung Selayar
630203|Pulau Laut Selatan (Pulaulaut Selatan)
630220|Pulau Laut Kepulauan (Pulaulaut Kepulauan)
630202|Pulau Laut Barat (Pulaulaut Barat)
210310|Pulau Laut
810812|Pulau Lakor
910513|Pulau Kurudu
827107|Pulau Hiri
810113|Pulau Haruku
620209|Pulau Hanaut
810504|Pulau Gorom
820203|Pulau Gebe
530802|Pulau Ende
817201|Pulau Dullah Utara
817202|Pulau Dullah Selatan
640307|Pulau Derawan
140417|Pulau Burung
190307|Pulau Besar (Pulaubesar)
160902|Pulau Beringin
827105|Pulau Batang Dua
111016|Pulau Banyak Barat
111001|Pulau Banyak
520204|Pujut
650203|Pujungan
140708|Pujud
350726|Pujon
351105|Pujer
731106|Pujananting
331225|Puhpelem
180611|Pugung
940313|Pugo Dagi
350908|Puger
630909|Pugaan
190108|Puding Besar
350221|Pudak
140915|Pucuk Rantau
352413|Pucuk
350412|Pucanglaban
331805|Pucakwangi
180219|Pubian
520210|Praya Tengah
520211|Praya Barat Daya
520205|Praya Barat
520201|Praya
351806|Prambon
351502|Prambon
340409|Prambanan
331001|Prambanan
357601|Prajuritkulon (Prajurit Kulon)
351116|Prajekan
352911|Pragaan
920204|Prafi
331201|Pracimantoro
167405|Prabumulih Utara
167402|Prabumulih Timur
167406|Prabumulih Selatan
167401|Prabumulih Barat
520706|Poto Tano
160420|Pseksu
352805|Proppo
350802|Pronojiwo
950324|Pronggoli
332304|Pringsurat
181001|Pringsewu
350102|Pringkuku
520312|Pringgasela
520208|Pringgarata
520308|Pringgabaya
332215|Pringapus
351410|Prigen
330509|Prembun
520206|Praya Timur
720218|Poso Pesisir Utara
720219|Poso Pesisir Selatan
720202|Poso Pesisir
720222|Poso Kota Utara
720221|Poso Kota Selatan
720201|Poso Kota
711102|Posigadan
122006|Portibi
121207|Porsea
351504|Porong
740812|Porehu
950138|Popugoba
750412|Popayato Timur
750413|Popayato Barat
750401|Popayato
910505|Poom
617104|Pontianak Utara
617102|Pontianak Timur
617106|Pontianak Tenggara
617101|Pontianak Selatan
617105|Pontianak Kota
617103|Pontianak Barat
360412|Pontang
730811|Ponre
731721|Ponrang Selatan
731711|Ponrang
350217|Ponorogo
340310|Ponjong
350506|Ponggok
750508|Ponelo Kepulauan
321416|Pondoksalam
327512|Pondokmelati (Pondok Melati)
327508|Pondokgede (Pondok Gede)
157206|Pondok Tinggi
170604|Pondok Suguh
170909|Pondok Kubang
170903|Pondok Kelapa
367403|Pondok Aren
740204|Pondidaha
330525|Poncowarno
352001|Poncol
350707|Poncokusumo
740107|Pomalaa
730504|Polongbangkeng Utara (Polombangkeng)
730511|Polongbangkeng Timur
730503|Polongbangkeng Selatan (Polombangkeng)
331107|Polokarto
121602|Pollung
740125|Polinggona
741104|Poli Polia
760404|Polewali
530213|Polen
740610|Poleang Utara
740602|Poleang Timur
740612|Poleang Tenggara
740619|Poleang Tengah
740611|Poleang Selatan
740607|Poleang Barat
740601|Poleang
331017|Polanharjo
910618|Poiru
710120|Poigar
351417|Pohjentrek
940505|Pogoma
950426|Poganeri
350312|Pogalan
950710|Poga
747104|Poasia
331402|Plupuh
352317|Plumpang
320918|Plumbon
350609|Plosoklaten
351714|Ploso
340213|Pleret
321404|Plered
320936|Plered
731410|Pitu Riawa
731411|Pitu Riase
352116|Pitu
950125|Pisugi
950702|Pirime
950131|Piramid
110824|Pirak Timur
721007|Pipikoro
531106|Pinu Pahar (Pinupahar / Pirapahar)
111701|Pintu Rime Gayo
121205|Pintu Pohan Meranti
711105|Pinolosian Timur
711104|Pinolosian Tengah
711103|Pinolosian
611008|Pinoh Utara
611009|Pinoh Selatan
750318|Pinogu
350616|Plemahan
340303|Playen
352007|Plaosan
332401|Plantungan
351715|Plandaan
520413|Plampang
160610|Plakat Tinggi (Pelakat Tinggi)
167114|Plaju
340214|Piyungan
940603|Piyaiye
330611|Pituruh
731310|Pitumpanua
710806|Pinogaluman
170106|Pino Raya (Pinoraya)
170103|Pino
111305|Pining (Pinding)
140313|Pinggir
720321|Pinembani (Panembani)
710213|Pineleng
120104|Pinangsori
170324|Pinang Raya
170712|Pinang Belapis
367111|Pinang (Penang)
351913|Pilangkenceng
950827|Pija
110716|Pidie
360111|Picung
630508|Piani
111115|Peusangan Siblah Krueng
111116|Peusangan Selatan
111105|Peusangan
110317|Peureulak Timur
110318|Peureulak Barat
110307|Peureulak
111103|Peudada
332604|Petungkriyono (Petungkriono)
360419|Petir
351710|Peterongan
721202|Petasia Timur
721210|Petasia Barat
721201|Petasia
332710|Petarukan
510304|Petang
330504|Petanahan
620612|Petak Malai
650108|Peso Hilir (Ilir)
650107|Peso
181304|Pesisir Utara
181301|Pesisir Tengah
181302|Pesisir Selatan
157202|Pesisir Bukit
357103|Pesantren
320526|Peundeuy
110324|Peunaron
111112|Peulimbang (Plimbang)
110715|Peukan Baro
110608|Peukan Bada
110316|Peudawa
317410|Pesanggrahan
351001|Pesanggaran
620805|Permata Kecubung
621204|Permata Intan
111702|Permata
367108|Periuk
140116|Perhentian Raja
121505|Pergetteng Getteng Sengkut
120726|Percut Sei Tuan
121802|Perbaungan
140205|Peranap
351701|Perak
950209|Pepera
640713|Penyinggahan
161202|Penukal Utara
161203|Penukal
731312|Penrang
317201|Penjaringan
160109|Peninjauan
610621|Pengkadan (Batu Datu)
340107|Pengasih
630309|Pengaron (Pengarom)
160108|Pengandonan
330316|Pengadegan
150603|Pengabuan
180109|Penengahan
510208|Penebel
161110|Pendopo Barat
161102|Pendopo
140616|Pendalian IV Koto
180513|Penawar Tama
180523|Penawar Aji
331503|Penawangan
170610|Penarik
117502|Penanggalan
640901|Penajam
161009|Pemulutan Selatan
161010|Pemulutan Barat
161005|Pemulutan
520805|Pemenang
150405|Pemayung
170904|Pematang Tiga
180616|Pematang Sawa
621306|Pematang Karau
120523|Pematang Jaya
120821|Pematang Bandar
610105|Pemangkat
190105|Pemali
332708|Pemalang
610424|Pemahan
720716|Peling Tengah
150809|Pelepat Ilir
150806|Pelepat
950110|Pelebaga
157105|Pelayangan
150305|Pelawan
140415|Pelangiran
140506|Pelalawan
630103|Pelaihari
510103|Pekutatan
330216|Pekuncen
520506|Pekat
147102|Pekanbaru Kota
337503|Pekalongan Utara
337502|Pekalongan Timur
337504|Pekalongan Selatan
337501|Pekalongan Barat
180704|Pekalongan
327404|Pekalipan
140714|Pekaitan
330415|Pejawaran
351316|Pejarakan (Pajarakan)
330513|Pejagoan
110407|Pegasing
352807|Pegantenan
332410|Pegandon
121814|Pegajahan
121109|Pegagan Hilir
337406|Pedurungan
760109|Pedongga
321510|Pedes
331012|Pedan
160224|Pedamaran Timur
160203|Pedamaran
332002|Pecangaan
332514|Pecalungan
321613|Pebayuran
130205|Payung Sekaki
147111|Payung Sekaki
120611|Payung
190305|Payung
161016|Payaraman
510407|Payangan
137602|Payakumbuh Utara
137603|Payakumbuh Timur
137605|Payakumbuh Selatan
137601|Payakumbuh Barat
130703|Payakumbuh
110820|Paya Bakong
332404|Patean
327902|Pataruman
820206|Patani Utara
820210|Patani Timur
820208|Patani Barat
820202|Patani
621303|Patangkep Tutui
130516|Patamuan
731505|Patampanua
930314|Passue Bawah
930308|Passue
710122|Passi Timur
710119|Passi Barat
350811|Pasrujambe (Pasujambe)
351405|Pasrepan
352913|Pasongsongan
320508|Pasirwangi
320332|Pasirkuda
320438|Pasirjambu
350804|Pasirian
180719|Pasir Sakti
950832|Pasir Putih
740328|Pasir Putih
131106|Pauh Duo
150304|Pauh
137108|Pauh
120721|Patumbak
340304|Patuk
730507|Pattallassang (Patallassang)
730613|Pattalasang (Pattallassang)
321231|Patrol
350920|Patrang
321316|Patokbeusi
330119|Patimuan
730827|Patimpeng
750406|Patilanggio
330212|Patikraja
351809|Patianrowo
360124|Patia
331810|Pati
332414|Patebon
140204|Pasir Penyu
140706|Pasir Limau Kapas
730110|Pasimasunggu Timur
730106|Pasimasunggu (Pasimassunggu)
730107|Pasimarannu
730109|Pasilambena
111409|Pasie Raya
110110|Pasi Raja (Pasie Raja)
740333|Pasi Kolaga
640103|Paser Belengkong (Pasir Belengkong)
161107|Pasemah Air Keruh
950313|Pasema
321229|Pasekan
321108|Paseh
320435|Paseh
352813|Pasean
320819|Pasawahan
321410|Pasawahan
740411|Pasarwajo (Pasar Wajo)
120116|Pasaribu Tobing
317505|Pasar Rebo
150803|Pasar Muaro Bungo (Pasar Muara Bungo)
317404|Pasar Minggu
170111|Pasar Manna
337203|Pasar Kliwon
360312|Pasar Kemis
157104|Pasar Jambi
760102|Pasangkayu
710711|Pasan
131203|Pasaman
320932|Pasaleman
620314|Pasak Talawang
320607|Parungponteng
320213|Parungkuda (Parung Kuda)
320120|Parung Panjang
320110|Parung
321702|Parongpong
352110|Paron
950811|Paro
120211|Parmonangan
121224|Parmaksian
121601|Parlilitan
920310|Pariwari
190506|Parittiga
631107|Paringin Selatan
631106|Paringin
610309|Parindu
720819|Parigi Utara
720820|Parigi Tengah
720811|Parigi Selatan
720816|Parigi Barat
720801|Parigi
730617|Parigi
321801|Parigi
740325|Parigi
130409|Pariangan
137702|Pariaman Utara
137704|Pariaman Timur
137701|Pariaman Tengah
137703|Pariaman Selatan
620204|Parenggean
352309|Parengan
350617|Pare
181004|Pardasuka
121110|Parbuluan
730605|Parangloe
121604|Paranginan
331224|Paranggupito
352002|Parang
630317|Paramasan (Peramasan)
320215|Parakansalak (Parakan Salak)
332308|Parakan
520616|Parado
350614|Papar
760207|Papalang
630106|Panyipatan
321018|Panyingkiran
327328|Panyileukan
121302|Panyabungan Utara
121303|Panyabungan Timur
121304|Panyabungan Selatan
121305|Panyabungan Barat
121301|Panyabungan
320707|Panumbangan
110512|Panton Reu
350914|Panti
130807|Panti
111807|Panteraja
110508|Pante Ceureumen (Pantai Ceuremen)
110311|Pante Bidari
530514|Pantar Timur
530516|Pantar Tengah
530517|Pantar Baru Laut
530509|Pantar Barat
530506|Pantar
111311|Pantan Cuaca
911014|Pantai Timur Bagian Barat
911004|Pantai Timur
620804|Pantai Lunci
120732|Pantai Labu
930406|Pantai Kasuari
121801|Pantai Cermin
130203|Pantai Cermin
531405|Pantai Baru
911003|Pantai Barat
360319|Panongan
120805|Panombeian Panei / Pane
351208|Panji
340103|Panjatan
187104|Panjang
320708|Panjalu
332602|Paninggaran
360106|Panimbang
940301|Paniai Timur
940302|Paniai Barat
121708|Pangururan
320925|Panguragan
352114|Pangkur
121014|Pangkatan
120515|Pangkalan Susu
140504|Pangkalan Lesung
160219|Pangkalan Lampam
620105|Pangkalan Lada
140503|Pangkalan Kuras
130706|Pangkalan Koto Baru
140502|Pangkalan Kerinci
150217|Pangkalan Jambu
190402|Pangkalan Baru
620106|Pangkalan Banteng
321502|Pangkalan
197103|Pangkal Balam
731004|Pangkajene
332809|Pangkah
350513|Panggungrejo
357504|Panggungrejo
350301|Panggul
950320|Panggema
360202|Panggarangan
340306|Panggang
320911|Pangenan
140909|Pangean
320541|Pangatikan
120213|Pangaribuan
352713|Pangarengan
321809|Pangandaran
320415|Pangalengan
760602|Pangale
111406|Panga (Keude Panga)
352008|Panekan
120804|Panei
111108|Pandrah
621101|Pandih Batu
360121|Pandeglang
630705|Pandawan
531107|Pandawai
330419|Pandanarum
120103|Pandan
340206|Pandak
351411|Pandaan
120705|Pancur Batu
331711|Pancur
130101|Pancung Soal
327601|Pancoran Mas
317408|Pancoran
352503|Panceng
320604|Pancatengah
320822|Pancalang
731405|Panca Rijang
731401|Panca Lautang
181106|Panca Jaya
320710|Panawangan
351206|Panarukan
160327|Panang Enim
737109|Panakkukang
121018|Panai Tengah
121020|Panai Hulu
121019|Panai Hilir
950409|Panaga
760304|Pana
321113|Pamulihan
320534|Pamulihan
367406|Pamulang
630213|Pamukan Utara
630211|Pamukan Selatan
630219|Pamukan Barat
160212|Pampangan
331707|Pamotan
720227|Pamona Utara
720205|Pamona Timur
720226|Pamona Tenggara
720206|Pamona Selatan
720204|Pamona Puselemba
720220|Pamona Barat
731302|Pammana
630809|Paminggir
320117|Pamijahan
320527|Pameungpeuk
320414|Pameungpeuk
150220|Pamenang Selatan
150213|Pamenang Barat
150206|Pamenang
352804|Pamekasan
950233|Pamek
760502|Pamboang
120831|Pamatang Silima Huta (Pematang)
120810|Pamatang Sidamanik (Pematang Sidamanik)
320719|Pamarican
360424|Pamarayan
321311|Pamanukan
130610|Palupuh
530706|Palue
727104|Palu Utara
727101|Palu Timur
727103|Palu Selatan
727102|Palu Barat
721002|Palolo
610108|Paloh
210502|Palmatak
340305|Paliyan
121704|Palipi
320917|Palimanan
520618|Palibelo
731511|Paleteang
352806|Palengaan (Palenggaan, Palenga'an)
130611|Palembayan (Pelembayan)
720511|Paleleh Barat
720505|Paleleh
321019|Palasah
720818|Palasa
180110|Palas
647201|Palaran
740514|Palangga Selatan
730607|Palangga (Pallangga)
740504|Palangga
352318|Palang
730815|Palakka
320201|Palabuhanratu (Pelabuhanratu)
317307|Pal Merah (Palmerah)
350924|Pakusari
351310|Pakuniran
360315|Pakuhaji
740811|Pakue Utara
740810|Pakue Tengah
740802|Pakue
180806|Pakuan Ratu
347111|Pakualaman
621309|Paku
352809|Pakong
121609|Pakkat
321512|Pakisjaya
350719|Pakisaji
332015|Pakis Aji
350718|Pakis
330816|Pakis
320533|Pakenjeng
351117|Pakem
340416|Pakem
350418|Pakel
121321|Pakantan
357830|Pakal
730305|Pajukukang
621307|Paju Epat
520508|Pajo
160412|Pajar Bulan
340207|Pajangan
351312|Paiton
531110|Pahunga Lodu
627101|Pahandut
120205|Pahae Julu
120206|Pahae Jae
332904|Paguyangan
750207|Paguyaman Pantai
750201|Paguyaman
750405|Paguat
350611|Pagu
121506|Pagindar
720107|Pagimana
350406|Pagerwojo
332402|Pageruyung (Pagerruyung)
332805|Pagerbarang
127703|Padangsidimpuan Batunadua
127706|Padangsidimpuan Angkola Julu
740238|Padangguni
352219|Padangan
137104|Padang Utara
170207|Padang Ulak Tanding
120512|Padang Tualang
137102|Padang Timur
110714|Padang Tiji
137101|Padang Selatan
130512|Padang Sago
180203|Padang Ratu
137401|Padang Panjang Timur
137402|Padang Panjang Barat
181208|Pagar Dewa
180420|Pagar Dewa
167201|Pagar Alam Utara
167202|Pagar Alam Selatan
940209|Pagaleme
350702|Pagak
130901|Pagai Utara
130910|Pagai Selatan
321328|Pagaden Barat
321307|Pagaden
530701|Paga
330524|Padureso
930121|Padua
352802|Pademawu
317205|Pademangan
352108|Padas
360429|Padarincang
127701|Padangsidimpuan Utara
127705|Padangsidimpuan Tenggara
127702|Padangsidimpuan Selatan
127704|Padangsidimpuan Hutaimbaru
131009|Padang Laweh
170309|Padang Jaya
127601|Padang Hulu
127603|Padang Hilir
170415|Padang Guci Hulu
170414|Padang Guci Hilir
130817|Padang Gelugur
130411|Padang Ganting
180905|Padang Cermin
122010|Padang Bolak Tenggara
122005|Padang Bolak Julu
122004|Padang Bolak
630602|Padang Batung
137103|Padang Barat
320638|Pagerageung
330414|Pagentan
181009|Pagelaran Utara
350733|Pagelaran
360109|Pagelaran
181005|Pagelaran
320318|Pagelaran
330420|Pagedongan
360322|Pagedangan
140614|Pagaran Tapah Darussalam
120210|Pagaran
120731|Pagar Merbau
170905|Pagar Jati
160422|Pagar Gunung
350814|Padang
330315|Padamara
321708|Padalarang
320629|Padakembang
910610|Padaido
321807|Padaherang
350104|Pacitan
352414|Paciran
351603|Pacet
320430|Pacet
320310|Pacet
351805|Pace
531511|Pacar
321305|Pabuaran
320237|Pabuaran
320933|Pabuaran
360428|Pabuaran
531112|Paberiwai
332205|Pabelan
320904|Pabedilan
357812|Pabean Cantian (Pabean Cantikan)
157111|Paal Merah
717111|Paal Dua
911511|Oudate
520428|Orong Telu
910617|Orkeri
910620|Oridek
921102|Oransbari
121433|Onolalu
121422|Onohazumba
720822|Ongka Malino
940522|Oneri
740237|Onembute
121702|Onan Runggu
121608|Onan Ganjang
940520|Omukia
820430|Obi Utara
820429|Obi Timur
820405|Obi Selatan
820428|Obi Barat
820406|Obi
930301|Obaa
827202|Oba Utara
827206|Oba Tengah
827207|Oba Selatan
827203|Oba
121421|O'o'u (Oou)
640716|Nyuatan
320239|Nyalindung
330105|Nusawungu
910517|Nusawani
817101|Nusaniwe (Nusanive)
320820|Nusaherang
710309|Nusa Tabukan
510501|Nusa Penida (Nusapenida)
810116|Nusa Laut
110306|Nurussalam
650309|Nunukan Selatan
650302|Nunukan
530217|Nunkolo
950419|Nunggawi
530232|Nunbena
910605|Numfor Timur
910604|Numfor Barat
940206|Nume
950421|Numba
720113|Nuhon
732402|Nuha
531305|Nubatukan
711003|Nuangan
610303|Noyan
760313|Nosu
217104|Nongsa
950234|Nongme
531306|Omesuri
352705|Omben
950214|Oksop
950201|Oksibil
950224|Oksebang
950221|Oksamol
950222|Oklip
950220|Okhika
950203|Okbibab
950223|Okbemtau
950212|Okbape
950225|Okbab
930103|Okaba
950216|Ok Aom
740908|Oheo
720405|Ogodeide
940512|Ogamanim
530218|Oenino
537104|Oebobo
950308|Obio
910308|Nimbokrang
950736|Nikogwe
920712|Nikiwar
121912|Nibung Hangus
161303|Nibung
110821|Nibong
331105|Nguter
351721|Ngusikan
350411|Ngunut
331206|Nguntoronadi
352017|Nguntoronadi
351421|Nguling
351807|Ngronggot
350202|Ngrayun
331408|Ngrampal
352102|Ngrambe
352201|Ngraho
352921|Nonggunong
721003|Nokilalaki
330912|Nogosari
950712|Nogi
530310|Noemuti Timur
530304|Noemuti
530226|Noebeba
530224|Noebana
530704|Nita
110827|Nisam Antara
110816|Nisam
810309|Nirunmas
950819|Nirkuri
950322|Nipsan
150702|Nipah Panjang
940222|Nioga
950303|Ninia
930217|Ninati
950711|Niname
910307|Nimboran
352109|Ngawi
331612|Ngawen
340313|Ngawen
331022|Ngawen
352204|Ngasem
350625|Ngasem
331509|Ngaringan
352016|Ngariboyo
331307|Ngargoyoso
181310|Ngaras (Bengkunat Belimbing)
740806|Ngapa
350404|Ngantru
350727|Ngantang
351813|Nganjuk
350607|Ngancar
321706|Ngamprah
351703|Ngoro
351605|Ngoro
330602|Ngombol
351818|Ngluyu
330803|Ngluwar
340302|Nglipar
350509|Nglegok
352404|Ngimbang
930116|Ngguti
531104|Nggaha Ori Angu (Nggaha Oriangu)
351802|Ngetos
340411|Ngemplak
330911|Ngemplak
350219|Ngebel
347106|Ngampilan
332419|Ngampel
181309|Ngambur
352203|Ngambon
337415|Ngaliyan
350720|Ngajum (Ngajung)
340412|Ngaglik
531121|Ngadu Ngala
350111|Ngadirojo
331213|Ngadirojo
332309|Ngadirejo
350604|Ngadiluwih
330817|Ngablak
610801|Ngabang
950830|Nenggeagin
921103|Neney
530707|Nelle (Maumerei)
950413|Nelawi
530116|Nekamese
367110|Neglasari
180902|Negeri Katon
180812|Negeri Besar
180807|Negeri Agung
180811|Negara Batin
510101|Negara
531508|Ndoso
530817|Ndori
530816|Ndona Timur
530805|Ndona
531409|Ndao Nuse
350107|Nawangan
930112|Naukenjerai
180104|Natar
121316|Natal
121221|Nassau
170407|Nasal
520103|Narmada
320324|Naringgul
950113|Napua
741311|Napano Kusambi
940102|Napan
170313|Napal Putih
740306|Napabalano
710405|Nanusa
320121|Nanggung
340110|Nanggulan
137110|Nanggalo
732603|Nanggala
531602|Nangaroro
530801|Nangapanda
610411|Nanga Tayap
630907|Muara Uya
110712|Muara Tiga
150402|Muara Tembesi
160708|Muara Telang
917104|Muara Tami
150912|Muara Tabir
180315|Muara Sungkai
160713|Muara Sugihan
121312|Muara Sipongi
150203|Muara Siau
117304|Muara Satu
640110|Muara Samu
170411|Muara Sahung
150701|Muara Sabak Timur
150707|Muara Sabak Barat
161101|Muara Pinang
150211|Nalo Tantan (Nalo Tatan)
950306|Nalca
940315|Nakama
121703|Nainggolan
920707|Naikere
530318|Naibenu
320426|Nagreg
320212|Nagrak
531301|Naga Wutung
121323|Naga Juang
950417|Nabunage
940112|Nabire Barat
940101|Nabire
122306|Na IX - X (Na IX-X)
940314|Muye
530313|Mutis
930102|Muting
110724|Mutiara Timur
610903|Nanga Taman
611002|Nanga Pinoh
610904|Nanga Mahap
530423|Nanaet Duabesi
130503|Nan Sabaris
810901|Namrole
122405|Namohalu Esiwa
120706|Namo Rambe (Namorambe)
810401|Namlea
747111|Nambo
720123|Nambo
910314|Nambluong
190405|Namang
120616|Naman Teran (Nama Teran)
332012|Nalumsari
320912|Mundu
351005|Muncar
360205|Muncang
350923|Mumbulsari
357826|Mulyorejo
950132|Muliama
940201|Mulia
160415|Mulak Ulu
160430|Mulak Sebingkai
610302|Mukok
150808|Muko-muko Bathin VII
950806|Mugi
950315|Mugi
920912|Mubrani
160428|Muarapayang
321617|Muaragembong (Muara Gembong)
640218|Muara Wis
640802|Muara Wahau
610417|Muara Pawan
150609|Muara Papalik
640710|Muara Pahu
160707|Muara Padang
640201|Muara Muntai
640709|Muara Lawa
160502|Muara Lakitan
161001|Muara Kuang
640107|Muara Komam
170808|Muara Kemumu
160503|Muara Kelingi
640211|Muara Kaman
160131|Muara Jaya
640214|Muara Jawa
630908|Muara Harus
160302|Muara Enim
110713|Mutiara
330904|Musuk
327511|Mustikajaya (Mustika Jaya)
530312|Musi
950107|Musatfak
950312|Musaik
630906|Murung Pudak
621201|Murung
650405|Muruk Rian
950228|Murkim
747206|Murhum
330808|Muntilan
120606|Munte
350302|Munjungan
360108|Munjul
330809|Mungkid
737308|Mungkajang
130711|Mungka
920410|Moswaren
920606|Moskona Utara
920624|Moskona Timur
920605|Moskona Selatan
920622|Moskona Barat
820704|Morotai Utara
820705|Morotai Timur
820702|Morotai Selatan Barat
820701|Morotai Selatan
820703|Morotai Jaya
740239|Morosi
710417|Moronge
122504|Moro'o
210201|Moro
721206|Mori Utara
721205|Mori Atas
740516|Moramo Utara
740510|Moramo
920908|Moraid
750114|Mootilango
160904|Muara Dua Kisam (Muaradua Kisam)
160901|Muara Dua (Muaradua)
117301|Muara Dua
150403|Muara Bulian
640803|Muara Bengkal
160509|Muara Beliti
160322|Muara Belida
110806|Muara Batu
120329|Muara Batang Toru
121317|Muara Batang Gadis
177104|Muara Bangka Hulu
640205|Muara Badak
640801|Muara Ancalong
950737|Muara
120215|Muara
940212|Muara
330308|Mrebet
332101|Mranggen
920926|Mpur
527205|Mpunda
340403|Moyudan
520423|Moyo Utara
520410|Moyo Hulu
520409|Moyo Hilir
740515|Mowila
741107|Mowewe
720804|Moutong
740910|Motui
711006|Motongkad
710522|Motoling Timur
710521|Motoling Barat
710507|Motoling
827104|Moti
350602|Mojo
920142|Moisegen
720114|Moilong
332701|Moga
950229|Mofinop
352616|Modung
710501|Modoinding
352403|Modo
711005|Modayag Barat
711004|Modayag
950828|Moba
810801|Moa (Moa Lakor)
332007|Mlonggo
340406|Mlati
350208|Mlarak
351204|Mlandingan
920916|Miyah Selatan
920902|Miyah
920506|Misool Timur
920513|Misool Selatan
920516|Misool Barat
530203|Mollo Utara
530230|Mollo Tengah
530202|Mollo Selatan
530222|Mollo Barat
740904|Molawe
940216|Molanikime
950128|Molagalome
950716|Mokoni
351707|Mojowarno
330711|Mojotengah
330906|Mojosongo
351608|Mojosari
357101|Mojoroto
331108|Mojolaban
331315|Mojogedang
351618|Mojoanyar
351706|Mojoagung
940113|Moora
640718|Mook Manaar Bulatn
711007|Mooat
520311|Montong Gading
352310|Montong
610708|Monterado
110605|Montasik (Mantasiek)
620501|Montallat (Montalat)
520601|Monta
331416|Mondokan
730913|Moncongloe (Moncong Loe)
750509|Monano
720501|Momunu
921105|Momi Waren
810318|Molu Maru
920501|Misool (Misool Utara)
330508|Mirit
621009|Miri Manasa
331414|Miri
530301|Miomaffo Timur (Miomafo Timur)
530311|Miomaffo Tengah (Miomafo Tengah)
530302|Miomaffo Barat (Miomafo Barat)
930309|Minyamur
921209|Minyambaouw
340404|Minggir
930202|Mindiptana
731010|Minasa Tene
140803|Minas
940407|Mimika Timur Jauh
940403|Mimika Timur
940408|Mimika Tengah
940401|Mimika Baru
940412|Mimika Barat Tengah
940411|Mimika Barat Jauh
940404|Mimika Barat
950718|Milimbo
110711|Mila
332110|Mijen
337414|Mijen
621007|Mihing Raya
210304|Midai
710413|Miangas
920623|Meyado (Mayado)
940204|Mewoluk
111801|Meureudu
110509|Meureubo
117103|Meuraxa
110807|Meurah Mulia
111805|Meurah Dua
110105|Meukek
187202|Metro Utara
187204|Metro Timur
187205|Metro Selatan
187201|Metro Pusat
180710|Metro Kibang
187203|Metro Barat
181102|Mesuji Timur
160221|Mesuji Raya
160220|Mesuji Makmur
160204|Mesuji
181101|Mesuji
150505|Mestong
760307|Messawa
110609|Mesjid Raya
111709|Mesidah
330810|Mertoyudan
150401|Mersam
150605|Merlung
170908|Merigi Sakti
170907|Merigi Kelindang
170805|Merigi
347112|Mergangsan
120605|Merek
920602|Merdey
120615|Merdeka
180118|Merbau Mataram
141005|Merbau
190103|Merawang
930101|Merauke
160423|Merapi Timur
160426|Merapi Selatan
160409|Merapi Barat
120908|Meranti
610808|Meranti
210210|Meral Barat
210204|Meral
352313|Merakurak
180526|Meraksa Aji
720812|Mepanga
920511|Meos Mansar
610806|Menyuke
611004|Menukung
720607|Menui Kepulauan
190501|Mentok (Muntok)
620905|Menthobi Raya
317106|Menteng
610620|Mentebah
620203|Mentaya Hulu
620207|Mentaya Hilir Utara
620208|Mentaya Hilir Selatan
620206|Mentawa Baru Ketapang
650212|Mentarang Hulu
650201|Mentarang
940115|Menou
610803|Menjalin
510302|Mengwi
731812|Mengkendek
180530|Menggala Timur
180502|Menggala
352513|Menganti
360113|Menes
510102|Mendoyo
190104|Mendo Barat
620609|Mendawai
150709|Mendahara Ulu
150703|Mendahara
331905|Mejobo
351911|Mejayan
760317|Mehalaan
530702|Mego
160512|Megang Sakti
320126|Megamendung
950504|Megambilis
351720|Megaluh
327506|Medansatria (Medan Satria)
147205|Medang Kampai
121901|Medang Deras
127107|Medan Tuntungan
127120|Medan Timur
127114|Medan Tembung
127102|Medan Sunggal
127121|Medan Selayang
127116|Medan Polonia
127119|Medan Petisah
127118|Medan Perjuangan
127112|Medan Marelan
127115|Medan Maimun
127113|Medan Labuhan
127101|Medan Kota
127111|Medan Johor
127103|Medan Helvetia
127104|Medan Denai
127106|Medan Deli
127108|Medan Belawan (Medan Belawan Kota)
127117|Medan Baru
127105|Medan Barat
127110|Medan Area
127109|Medan Amplas
950812|Mebarok
810803|Mdona Hyera (Mndona Hiera)
950807|Mbuwa
950822|Mbulmu Yalma
950823|Mbua Tengah
531510|Mbeliling
920314|Mbahamdandara
121417|Mazo
121413|Mazino
332004|Mayong
357403|Mayangan
350926|Mayang
920113|Mayamuk
741402|Mawasangka Timur
741403|Mawasangka Tengah
741404|Mawasangka
920922|Mawabuan
530810|Maurole
531604|Mauponggo
537102|Maulafa
530811|Maukaro
360308|Mauk
920120|Maudus
130604|Matur
717205|Matuari (Bitung Barat)
731501|Mattiro Sompe (Matirro Sompe)
731503|Mattiro Bulu
317501|Matraman
331305|Matesih
920420|Matemani
531115|Matawai La Pawu (Lappau)
530512|Mataru
630312|Mataraman
180716|Mataram Baru
527102|Mataram
760409|Matangnga
110805|Matangkuli
610401|Matan Hilir Utara
610412|Matan Hilir Selatan
760414|Matakali
740622|Mata Usu
740608|Mata Oleo
920617|Masyeta
920205|Masni
911503|Masirei
520305|Masbagik
331403|Masaran
731831|Masanda
732203|Masamba
140813|Mempura
610218|Mempawah Timur
610802|Mempawah Hulu
610201|Mempawah Hilir
921203|Membey
190202|Membalong
740225|Meluhu
710416|Melonguane Timur
710407|Melonguane
180717|Melinting
610320|Meliau
510104|Melaya
640706|Melak
950706|Melagineri
950739|Melagi
630413|Mekarsari (Mekar Sari)
320532|Mekarmukti
360130|Mekarjaya
360333|Mekar Baru
160908|Mekakau Ilir
731407|Maritengngae
737101|Mariso
750404|Marisa
731201|Marioriwawo (Mario Riwawo)
731205|Marioriawa (Mario Riawa)
620607|Marikit
920139|Mariat
331816|Margoyoso
331812|Margorejo
352222|Margomulyo
150221|Margo Tabir
332801|Margasari
320409|Margahayu
337604|Margadana
320410|Margaasih
180711|Marga Tiga (Margatiga)
180724|Marga Sekampung
170325|Marga Sakti Sebelat (Marga Sakti)
180908|Marga Punduh
510207|Marga
921024|Mare Selatan
921011|Mare
730807|Mare
120610|Mardingding (Mardinding)
122305|Marbau
721015|Marawola Barat
721014|Marawola
610402|Marau
640311|Maratua
640217|Marang Kayu
731008|Marang (Ma Rang)
120320|Marancar
630415|Marabahan
732210|Mappedeceng
730501|Mappakasunggu
731828|Mappak
530721|Mapitara
760408|Mapilli
720110|Masama
731611|Masalle
352923|Masalembu
730908|Marusu
630315|Martapura Timur
630314|Martapura Barat
630305|Martapura (Martapura Kota)
160801|Martapura
147109|Marpoyan Damai
730904|Maros Baru
520424|Maronge
351317|Maron
740331|Marobo
150406|Maro Sebo Ulu
150408|Maro Sebo Ilir
150504|Maro Sebo
940609|Mapia Tengah
940606|Mapia Barat
940602|Mapia
950802|Mapenduma
130815|Mapat Tunggul Selatan
130808|Mapat Tunggul
717108|Mapanget
352011|Maospati
330107|Maos
810215|Manyeuw
331210|Manyaran
352510|Manyar
111601|Manyak Payed
730614|Manuju
621011|Manuhing Raya (Mahuning Raya)
621006|Manuhing
352416|Mantup
347108|Mantrijeron
720122|Mantoh
352113|Mantingan
727108|Mantikulore
631008|Mantewe
620309|Mantangai
210113|Mantang
320622|Manonjaya
920214|Manokwari Utara
920213|Manokwari Timur
920215|Manokwari Selatan
920212|Manokwari Barat
911109|Mannem
170104|Manna
331009|Manisrenggo
610403|Manis Mata
920611|Manimeri
321407|Maniis
731309|Maniangpajo
121410|Maniamolo
320625|Mangunreja
321806|Mangunjaya
357702|Manguharjo
820510|Mangoli Utara Timur
820513|Mangoli Utara
820501|Mangoli Timur
820511|Mangoli Tengah
820512|Mangoli Selatan
820506|Mangoli Barat
732401|Mangkutana
327808|Mangkubumi
510703|Manggis
111203|Manggeng
930212|Manggelum
190601|Manggar
520507|Manggalewa
737112|Manggala
351209|Mangaran
730502|Mangarabombang (Mangara Bombang)
710310|Manganitu Selatan
710313|Manganitu
920925|Manekar
110727|Mane
120105|Manduamas
122506|Mandrehe Utara
122503|Mandrehe Barat
122505|Mandrehe
610804|Mandor
747101|Mandonga
710223|Mandolang
930201|Mandobo
320814|Mandirancan
330403|Mandiraja
820420|Mandioli Utara
820419|Mandioli Selatan
352903|Manding
150311|Mandiangin Timur
170406|Maje
731305|Majauleng
360134|Majasari
321007|Majalengka
321521|Majalaya
320433|Majalaya
321006|Maja
360213|Maja
731601|Maiwa
950137|Maima
531122|Mahu
741306|Maginti
352006|Magetan
357602|Magersari
530712|Magepanda
337102|Magelang Utara
337103|Magelang Tengah
337101|Magelang Selatan
940516|Mage'abume
351101|Maesan
650213|Malinau Selatan Hilir
650206|Malinau Selatan
650202|Malinau Kota
650208|Malinau Barat
170606|Malin Deman
731835|Malimbong Balepe
732404|Malili
621106|Maliku
740307|Maligano
820308|Malifut
320830|Maleber
321026|Malausma
732208|Malangke Barat
732201|Malangke
320514|Malangbong
717109|Malalayang
130616|Malalak (Malakak)
532109|Malaka Timur
532101|Malaka Tengah
532102|Malaka Barat
927109|Malaimsimsa
927110|Maladum Mes
920149|Malabotom
111106|Makmur
950703|Makki
940107|Makimi
820410|Makian Barat
920101|Makbon
737103|Makassar
317508|Makasar
160709|Makarti Jaya
731827|Makale Utara
731829|Makale Selatan
731805|Makale
330114|Majenang
137502|Mandiangin Koto Selayan
150306|Mandiangin
320308|Mande
620315|Mandau Talawang
140309|Mandau
630406|Mandastana
731011|Mandalle
360117|Mandalawangi
327330|Mandalajati
730901|Mandai
140407|Mandah
360432|Mancak
750205|Mananggu
760201|Mamuju
317403|Mampang Prapatan
721209|Mamosalato
531703|Mamboro
930302|Mambioman Bapai
760301|Mambi
912004|Mamberamo Tengah Timur
912001|Mamberamo Tengah
912002|Mamberamo Hulu
912005|Mamberamo Hilir
760303|Mamasa
737102|Mamajang
950817|Mam
760504|Malunda
520708|Maluk
731609|Malua
352217|Malo
731105|Mallusetasi
730906|Malllawa (Mallawa)
360201|Malingping
930114|Malind
650207|Malinau Utara
650214|Malinau Selatan Hulu
650321|Lumbis Hulu
650304|Lumbis
330201|Lumbir
351404|Lumbang
351324|Lumbang
121209|Lumban Julu
610713|Lumar
350810|Lumajang
131210|Luhak Nan Duo
117105|Lueng Bata
137201|Lubuk Sikarah
130805|Lubuk Sikaping
170507|Lubuk Sandi
160130|Lubuk Raja
170601|Lubuk Pinang
120728|Lubuk Pakam
167304|Lubuk Linggau Utara Satu (I)
167308|Lubuk Linggau Utara Dua (II)
167301|Lubuk Linggau Timur Satu (I)
710516|Maesaan
717207|Maesa
352410|Maduran
330408|Madukara
351908|Madiun
717202|Madidir (Bitung Tengah)
110312|Madat
520613|Madapangga
160813|Madang Suku III
160806|Madang Suku II
160807|Madang Suku I
531501|Macang Pacar
940519|Mabugi
820609|Maba Utara
820608|Maba Tengah
820603|Maba Selatan
820602|Maba
120428|Ma'u
760410|Luyo
720121|Luwuk Utara
720111|Luwuk Timur
720120|Luwuk Selatan
720104|Luwuk
320806|Luragung
520402|Lunyuk
170413|Lungkang Kule
130110|Lunang
120119|Lumut
940215|Lumo
320734|Lumbung
180422|Lumbok Seminung
650320|Lumbis Pansiangan
650315|Lumbis Ogong
640705|Long Iram
640106|Long Ikis
641102|Long Hubung
641101|Long Bagun
641104|Long Apari
121408|Lolowau
810411|Lolong Guba
121401|Lolomatua
122507|Lolofitu Moi
820309|Loloda Utara
820110|Loloda Tengah
820319|Loloda Kepulauan
820102|Loloda
531210|Loli
710114|Lolayan
950335|Lolat
167305|Lubuk Linggau Timur Dua (II)
167303|Lubuk Linggau Selatan Satu (I)
167307|Lubuk Linggau Selatan Dua (II)
167302|Lubuk Linggau Barat Satu (I)
167306|Lubuk Linggau Barat Dua (II)
137107|Lubuk Kilangan
161015|Lubuk Keliat
140811|Lubuk Dalam
190406|Lubuk Besar
137106|Lubuk Begalung
140212|Lubuk Batu Jaya
160122|Lubuk Batang
130602|Lubuk Basung
122104|Lubuk Barumun
217106|Lubuk Baja
130501|Lubuk Alung
130307|Lubuak Tarok
160325|Lubai Ulu
160314|Lubai
170410|Luas
710112|Lolak
630610|Loksado
630510|Lokpaikat
740318|Lohia
321218|Lohbener
140910|Logas Tanah Darat
741102|Loea
351804|Loceret
720116|Lobu
531403|Lobalain
330615|Loano
531411|Loaholu
640202|Loa Kulu
647210|Loa Janan Ilir
640203|Loa Janan
210402|Lingga
110401|Linge
721004|Lindu
150302|Limun
332508|Limpung
630711|Limpasu
327604|Limo
150807|Limbur Lubuk Mengkuang
750117|Limboto Barat
750101|Limboto
760411|Limboro
332406|Limbangan
180624|Limau
121909|Lima Puluh Pesisir
121904|Lima Puluh (Limapuluh)
147104|Lima Puluh
130404|Lima Kaum
731203|Lilirilau (Lili Rilau)
731013|Liukang Tupabbiring Utara
731003|Liukang Tupabbiring
731001|Liukang Tangaya
731002|Liukang Kalmas (Kalukuang Masalima)
710401|Lirung
140209|Lirik
530812|Lio Timur
121605|Lintong Nihuta
130413|Lintau Buo Utara
130406|Lintau Buo
161105|Lintang Kanan
520112|Lingsar
130109|Linggo Sari Baganti
640715|Linggang Bigung
210405|Lingga Utara
210407|Lingga Timur
121314|Lingga Bayu
731202|Liliraja (Lili Riaja)
810415|Lilialy
710607|Likupang Timur
710610|Likupang Selatan
710606|Likupang Barat
321016|Ligung
351024|Licin
730806|Libureng
950123|Libarek
637206|Liang Anggang
720705|Liang
950444|Li Anogomma
110601|Lhoong
110804|Lhoksukon
110602|Lhoknga (Lho'nga)
530615|Lewolema
531118|Lewa Tidahu
531103|Lewa
320628|Leuwisari
320139|Leuwisadeng
321010|Leuwimunding
320114|Leuwiliang
320511|Leuwigoong
360206|Leuwidamar
110216|Leuser
110622|Leupung
530821|Lepembusu Kelisoke
130704|Luak (Luhak)
121432|Luahagundre Maniamolo
357305|Lowokwaru
531801|Loura
122401|Lotu
320903|Losari
332912|Losari
321220|Losarang
720207|Lore Utara
720224|Lore Timur
720208|Lore Tengah
720209|Lore Selatan
720225|Lore Piore
720223|Lore Barat
520426|Lopok
117505|Longkib
641105|Long Pahangai
640818|Long Mesangat
640108|Long Kali
190302|Lepar (Lepar Pongok)
352907|Lenteng
351819|Lengkong
327313|Lengkong
320207|Lengkong
160128|Lengkiti
130103|Lengayang
520321|Lenek
340105|Lendah
520427|Lenangguar
160222|Lempuing Jaya
160213|Lempuing
181303|Lemong
750402|Lemito
327206|Lembursitu
530515|Lembur
531509|Lembor Selatan
531503|Lembor
150209|Lembah Masurai
130204|Lembah Gumanti
610716|Lembah Bawang
327402|Lemahwungkuk (Lemah Wungkuk)
321001|Lemahsugih
320907|Lemahabang
321519|Lemahabang
320509|Leles
320330|Leles
321205|Lelea
531015|Lelak
530703|Lela
810905|Leksula
330705|Leksono
351422|Lekok
817105|Leitimur Selatan
810122|Leihitu Barat
810115|Leihitu
321321|Legonkulon
360320|Legok
350928|Ledokombo
610703|Ledo
820803|Lede
351305|Leces
170701|Lebong Utara
170703|Lebong Tengah
170704|Lebong Selatan
170708|Lebong Sakti
170702|Lebong Atas
531304|Lebatukan
320807|Lebakwangi
332806|Lebaksiu
360225|Lebakgedong
332603|Lebakbarang
360435|Lebak Wangi
747207|Lea-Lea
337201|Laweyan
110214|Lawe Sumur
110202|Lawe Sigala Gala
530603|Larantuka
352808|Larangan
367113|Larangan
332915|Larangan
730812|Lappariaja
520412|Lape (Lape Lopok)
110823|Lapang
741503|Lapandewa
740511|Laonti
520429|Lantung
740621|Lantari Jaya
731510|Lansirang (Lanrisang)
950731|Lannyna
117401|Langsa Timur
117404|Langsa Lama
117403|Langsa Kota
117405|Langsa Baro
117402|Langsa Barat
710219|Langowan Utara
710209|Langowan Timur
721203|Lembo Raya
740906|Lembo
721204|Lembo
352003|Lembeyan
717208|Lembeh Utara
717201|Lembeh Selatan (Bitung Selatan)
710205|Lembean Timur
520113|Lembar
130206|Lembang Jaya
731507|Lembang
321701|Lembang
160317|Lembak
121309|Lembah Sorik Marapi
110614|Lembah Seulawah
137301|Lembah Segar
111209|Lembah Sabil
131202|Lembah Melintang
710217|Langowan Selatan
710210|Langowan Barat
531012|Langke Rembong
187116|Langkapura
321805|Langkaplancar
110818|Langkahan
520611|Langgudu
740903|Langgikima
140505|Langgam
327904|Langensari
950339|Langda
531410|Landu Leko
740505|Landono
740913|Landawe
637202|Landasan Ulin
730813|Lamuru
137604|Lamposi Tigo Nagori / Nagari
631105|Lampihong
110208|Lawe Bulan
110201|Lawe Alas
160613|Lawang Wetan
160307|Lawang Kidul
350725|Lawang
741303|Lawa
110417|Laut Tawar (Lut Tawar)
121908|Laut Tador
621203|Laung Tuhup
120609|Laubaleng
730912|Lau
720406|Lampasio
352422|Lamongan
740201|Lambuya
181207|Lambu Kibang
520612|Lambu
531212|Lamboya
520617|Lambitu
940521|Lambewi
741105|Lambandia
740808|Lambai
531911|Lamba Leda Utara
531908|Lamba Leda Timur (Poco Ranaka Timur)
531902|Lamba Leda Selatan (Poco Ranaka)
531903|Lamba Leda
731718|Lamasi Timur
740506|Lainea
730512|Laikang
121403|Lahusa
122501|Lahomi (Gahori)
122411|Lahewa Timur
122410|Lahewa
620509|Lahei Barat
620506|Lahei
160431|Lahat Selatan
160410|Lahat
641103|Laham
121202|Laguboti
720203|Lage
740519|Laeya
731709|Lamasi
620901|Lamandau
720105|Lamala
530418|Lamaknen Selatan
530401|Lamaknen
740236|Lalonggasumeeto
741106|Lalolae
740512|Lalembuu
160611|Lalan
731204|Lalabata
741401|Lakudo
720502|Lakea (Lipunoto)
320717|Lakbok
357818|Lakarsantri
170310|Lais
160602|Lais
520419|Labangka
352612|Labang
731007|Labakkang
920904|Kwoor
950346|Kwikma
920921|Kwesefo
950345|Kwelamdua
352611|Kwanyar
750502|Kwandang
940413|Kwamki Narama
352106|Kwadungan
950709|Kuyawage
531512|Kuwus Barat
531502|Kuwus
330516|Kuwarasan
330510|Kutowinangun
351607|Kutorejo
330609|Kutoarjo
210510|Kute Siantan
110412|Kute Panang
320446|Kutawaringin
321507|Kutawaluya
330307|Kutasari
111302|Kutapanjang (Kuta Panjang)
120522|Kutambaru
120704|Kutalimbaru
120613|Kutabuluh (Kuta Buluh)
510306|Kuta Utara
510305|Kuta Selatan
117106|Kuta Raja
110617|Kuta Malaka (Kota Malaka)
110803|Kuta Makmur
110616|Kuta Cot Glie (Kota Cot Glie)
111117|Kuta Blang
110611|Kuta Baro
117102|Kuta Alam
510301|Kuta
631011|Kusan Tengah
631005|Kusan Hulu
631002|Kusan Hilir
740216|Latoma
731712|Latimojong
740114|Latambaga
740801|Lasusua
740912|Lasolo Kepulauan
740905|Lasolo
530417|Lasiolat
331714|Lasem
740424|Lasalimu Selatan
740423|Lasalimu
740314|Lasalepa
731710|Larompong Selatan
731702|Larompong
760112|Lariang
352408|Laren
130709|Lareh Sago Halaban
741310|Kusambi
621002|Kurun
950102|Kurulu
731838|Kurra
630411|Kuripan
520115|Kuripan
351303|Kuripan
950301|Kurima
930111|Kurik
920709|Kuri Wamesa
920610|Kuri
630104|Kurau
137109|Kuranji
631010|Kuranji
817205|Kur Selatan
130310|Kupitan
530106|Kupang Timur
530108|Kupang Tengah
530105|Kupang Barat
140105|Kuok
140606|Kunto Darussalam
741001|Kulisusu (Kalingsusu/Kalisusu)
147114|Kulim
721006|Kulawi Selatan
721005|Kulawi
351717|Kudu
510808|Kubutambahan
130210|Kubung
140715|Kubu Babussalam
611206|Kubu
950411|Kubu
510708|Kubu
140701|Kubu
530227|Kuatnana
640105|Kuaro
950414|Kuari
140902|Kuantan Tengah
532108|Laenmanen
121111|Lae Parira
741103|Ladongi
187114|Labuhan Ratu
180721|Labuhan Ratu
180702|Labuhan Maringgai
110111|Labuhan Haji Timur
110112|Labuhan Haji Barat
110104|Labuhan Haji
520317|Labuhan Haji
120725|Labuhan Deli
520418|Labuhan Badas
520108|Labuapi
630704|Labuan Amas Utara
630703|Labuan Amas Selatan
360112|Labuan
720309|Labuan
531218|Laboya Barat (Lamboya Barat)
721105|Labobo
140901|Kuantan Mudik
140913|Kuantan Hilir Seberang
140904|Kuantan Hilir
530211|Kuanfatu
122308|Kualuh Selatan
122302|Kualuh Leidong
122301|Kualuh Hulu
122303|Kualuh Hilir
530221|Kualin
111507|Kuala Pesisir
611202|Kuala Mandor B
940409|Kuala Kencana
140510|Kuala Kampar
150708|Kuala Jambi
140403|Kuala Indragiri
140210|Kuala Cenaku
150612|Kuala Betara
610809|Kuala Behe
111205|Kuala Batee
111014|Kuala Baru
111501|Kuala
120503|Kuala
111114|Kuala
181308|Krui Selatan
111402|Krueng Sabee
110621|Krueng Barona Jaya
351308|Krucil
330106|Kroya
321202|Kroya
360307|Kronjo
350731|Kromengan
351511|Krian
340203|Kretek
360306|Kresek
950831|Krepkuri
351503|Krembung
357815|Krembangan
351315|Krejengan
650318|Krayan Timur
650317|Krayan Tengah
650307|Krayan Selatan
650319|Krayan Barat
650305|Krayan
351416|Kraton
347109|Kraton
350603|Kras
321209|Krangkeng
332313|Kranggan
357603|Kranggan
920308|Kramongmongga
360405|Kramatwatu
320816|Kramatmulya (Kramat Mulya)
317504|Kramatjati (Kramat Jati)
332815|Kramat
351314|Kraksaan
360411|Kragilan
331712|Kragan
331507|Kradenan
331603|Kradenan
930204|Kouh
130107|Koto XI Tarusan
350621|Kunjang
350806|Kunir
320809|Kuningan
331613|Kunduran
210207|Kundur Utara
210208|Kundur Barat
210202|Kundur
157205|Kumun Debai
150506|Kumpeh Ulu
150503|Kumpeh
710515|Kumelembuai
620101|Kumai
950730|Kuly Lanny
731406|Kulo
741005|Kulisusu Utara
741004|Kulisusu Barat
130308|Koto VII
137111|Koto Tangah
131007|Koto Salak
131103|Koto Parik Gadang Diateh
140121|Koto Kampar Hulu
140809|Koto Gasib
131011|Koto Besar
131001|Koto Baru
157207|Koto Baru
131208|Koto Balingka
530716|Koting
620103|Kotawaringin Lama
121810|Kotarih
122201|Kotapinang (Kota Pinang)
121308|Kotanopan
717401|Kotamobagu Utara
717402|Kotamobagu Timur
717403|Kotamobagu Selatan
717404|Kotamobagu Barat
347114|Kotagede
711002|Kotabunan
910506|Kosiwo
950321|Kosarek
360314|Kosambi
950338|Korupun
930423|Koroway Buluanop
950809|Koroptak
360133|Koroncong
810308|Kormomolin
950126|Koragi
950825|Kora
360425|Kopo
930415|Kopay
520209|Kopang
740320|Kontunaga
930122|Kontuar
740330|Kontu Kowuna
920150|Konhir
950412|Konda/ Kondaga
740507|Konda
920415|Konda
740232|Konawe
352617|Konang
950332|Kona
531505|Komodo
930207|Kombut
710204|Kombi
640808|Kombeng (Kongbeng)
930216|Kombay
740523|Kolono Timur
740509|Kolono
930409|Kolf Braza
530219|Kolbano
950728|Kolawa
120106|Kolang
740104|Kolaka
352610|Kokop
920421|Kokoda Utara
920409|Kokoda
920304|Kokas
340108|Kokap
747205|Kokalukuna
530223|Kok Baun
180309|Kotabumi Utara
180310|Kotabumi Selatan
180302|Kotabumi
351311|Kotaanyar (Kota Anyar)
920518|Kota Waisai
531101|Kota Waingapu
531215|Kota Waikabubak
757103|Kota Utara
757105|Kota Timur
827103|Kota Ternate Utara
827106|Kota Ternate Tengah
827102|Kota Ternate Selatan
757106|Kota Tengah
531809|Kota Tambolaka
352901|Kota Sumenep
530201|Kota Soe
110709|Kota Sigli
757102|Kota Selatan
537105|Kota Raja
170206|Kota Padang
170602|Kota Mukomuko (Mukomuko Utara)
810117|Kota Masohi
170105|Kota Manna
820610|Kota Maba
537106|Kota Lama
331902|Kota Kudus (Kudus Kota)
111605|Kota Kualasinpang (Kota Kuala Simpang)
531910|Kota Komba Utara
531906|Kota Komba
120920|Kota Kisaran Timur
120919|Kota Kisaran Barat
530305|Kota Kefamenanu
111113|Kota Juang
110615|Kota Jantho
180223|Kota Gajah
620201|Kota Besi
321525|Kota Baru (Kotabaru)
530813|Kota Baru
157107|Kota Baru
757101|Kota Barat
640219|Kota Bangun Darat
640208|Kota Bangun
111009|Kota Baharu
110117|Kota Bahagia
530412|Kota Atambua (Atambua Kota)
170307|Kota Arga Makmur
180619|Kota Agung Timur
180618|Kota Agung Barat
180601|Kota Agung (Kota Agung Pusat)
160407|Kota Agung
357102|Kota (Kediri Kota)
530220|Kot Olin
317203|Koja
920510|Kofiau
531808|Kodi Utara
531806|Kodi Bangedo
531811|Kodi Balaghar
531807|Kodi
740805|Kodeoha
532110|Kobalima Timur
532111|Kobalima
950501|Kobakma
190401|Koba
510503|Klungkung
110102|Kluet Utara
110114|Kluet Timur
110113|Kluet Tengah
110103|Kluet Selatan
331515|Klambu
350819|Klakah
920117|Klabot
351114|Klabang
940226|Kiyage
950207|Kiwirok Timur
950202|Kiwirok
331216|Kismantoro
810817|Kisar Utara
810807|Kisar Selatan (Pulau Pulau Terselatan)
160910|Kisam Tinggi
160911|Kisam Ilir
911510|Kirihi
720103|Kintom
630107|Kintap
510604|Kintamani
810513|Kian Darat
530210|KI'E (Kie, Ki'e)
930219|Ki
530710|Kewapante
110722|Keumala
610505|Ketungau Tengah
610506|Ketungau Hulu
610504|Ketungau Hilir
110410|Ketol
180114|Ketapang
352712|Ketapang
332916|Ketanggungan
357302|Klojen
330505|Klirong
330915|Klego
332317|Kledung
920140|Klayili
920118|Klawak
927108|Klaurung
331024|Klaten Utara
331025|Klaten Tengah
331026|Klaten Selatan
920141|Klaso
920151|Klasafet
321505|Klari
320132|Klapanunggal
320923|Klangenan
352607|Klampis
920108|Klamono
740617|Kepulauan Masaloka Raya
710325|Kepulauan Marore
810609|Kepulauan Manipa
611106|Kepulauan Karimata
820425|Kepulauan Joronga
820418|Kepulauan Botanglomang
920505|Kepulauan Ayau
911904|Kepulauan Aruri
910510|Kepulauan Ambai
352209|Kepohbaru
330702|Kepil
140615|Kepenuhan Hulu
140605|Kepenuhan
357201|Kepanjenkidul (Kepanjen Kidul)
350713|Kepanjen
810904|Kepala Madan
170804|Kepahiang
760216|Kep. Bala Balakang
531606|Keo Tengah
721013|Kinovaro
730208|Kindang
131205|Kinali
170401|Kinal
930104|Kimaam
520504|Kilo
810508|Kilmury
950814|Kilmid
160417|Kikim Timur
160418|Kikim Tengah
160416|Kikim Selatan
160419|Kikim Barat
360416|Kibin
321417|Kiarapedes
327316|Kiaracondong
320431|Kertasari
167113|Kertapati
330318|Kertanegara
630302|Kertak Hanyar
321014|Kertajati
332911|Kersana
320513|Kersamanah
170306|Kerkap
331316|Kerjo
140409|Keritang
140807|Kerinci Kanan
352308|Kerek
510204|Kerambitan
121502|Kerajaan
350618|Kepung
730510|Kepulauan Tanakeke
310101|Kepulauan Seribu Utara
310102|Kepulauan Seribu Selatan
920517|Kepulauan Sembilan
737115|Kepulauan Sangkarrang
810816|Kepulauan Roma (Romang)
210410|Kepulauan Posek
190308|Kepulauan Pongok
110212|Ketambe
170312|Ketahun
330102|Kesugihan
732615|Kesu
332609|Kesesi
327405|Kesambi
351712|Kesamben
350519|Kesamben
140507|Kerumutan
520301|Keruak
351808|Kertosono
330708|Kertek
321208|Kertasemaya
140419|Kempas
351615|Kemlagi
330612|Kemiri
360309|Kemiri
187113|Kemiling
950404|Kembu
940513|Kembru
610308|Kembayan
330220|Kembaran
352419|Kembangbahu
317308|Kembangan
110708|Kembang Tanjong
640210|Kembang Janggut
351406|Kejayan
327401|Kejaksan
330713|Kejajar
810219|Kei Kecil Timur Selatan
810213|Kei Kecil Timur
810214|Kei Kecil Barat
810201|Kei Kecil
810205|Kei Besar Utara Timur
810217|Kei Besar Utara Barat
810218|Kei Besar Selatan Barat
810204|Kei Besar Selatan
810203|Kei Besar
950801|Kenyam
640209|Kenohan
357817|Kenjeran
352301|Kenduruan
351205|Kendit
610404|Kendawangan
747105|Kendari Barat
747102|Kendari
332415|Kendal
352104|Kendal
710316|Kendahe
350902|Kencong
330917|Kemusu
167109|Kemuning
140414|Kemuning
910306|Kemtuk Gresi
910305|Kemtuk
330206|Kemranjen
520502|Kempo
950810|Kegayem
731314|Keera
170107|Kedurang Ilir
170101|Kedurang
332613|Kedungwuni
350403|Kedungwaru
331604|Kedungtuban
330101|Kedungreja
352406|Kedungpring
357303|Kedungkandang
331501|Kedungjati
350816|Kedungjajang
352111|Kedunggalar
332009|Keling
530814|Kelimutu
150108|Keliling Danau
950502|Kelila
160321|Kelekar
140203|Kelayang
640301|Kelay
730405|Kelara
537103|Kelapa Lima
190604|Kelapa Kampit
317206|Kelapa Gading
360328|Kelapa Dua
190504|Kelapa
170409|Kelam Tengah
610519|Kelam Permai
111606|Kejuruan Muda
330303|Kejobong
352706|Kedungdung
330223|Kedungbanteng (Kedung Banteng)
332808|Kedungbanteng (Kedung Banteng)
352208|Kedungadem
321612|Kedung Waringin
332001|Kedung
332307|Kedu
357405|Kedopok (Kedopak)
180907|Kedondong
321228|Kedokan Bunder
510206|Kediri
520102|Kediri
352225|Kedewan
331404|Kedawung
320920|Kedawung
160132|Kedaton Peninjauan Raya
187101|Kedaton
352508|Kedamean
332014|Kembang
317103|Kemayoran
330301|Kemangkon
320112|Kemang
331021|Kemalang
710601|Kema
630210|Kelumpang Utara
630209|Kelumpang Tengah
630207|Kelumpang Selatan
630208|Kelumpang Hulu
630217|Kelumpang Hilir
630218|Kelumpang Barat
180628|Kelumbayan Barat (Klumbayan Barat)
180617|Kelumbayan (Klumbayan)
950735|Kelulome
530611|Kelubagolit
160608|Keluang
630902|Kelua (Klua)
187118|Kedamaian
180418|Kebun Tebu
330512|Kebumen
351901|Kebonsari (Kebon Sari)
320234|Kebonpedes
331007|Kebonarum
350105|Kebonagung (Kebon Agung)
332114|Kebonagung
317305|Kebon Jeruk
352514|Kebomas
940308|Kebo
317405|Kebayoran Lama
317407|Kebayoran Baru
110411|Kebayakan
170806|Kebawetan
330205|Kebasen
920923|Kebar Timur
920924|Kebar Selatan
920909|Kebar
331314|Kebakkramat
150119|Kayu Aro Barat
150109|Kayu Aro
160205|Kayu Agung
820413|Kayoa Utara
820412|Kayoa Selatan
820411|Kayoa Barat
820402|Kayoa
950350|Kayo
350624|Kayen Kidul
331802|Kayen
920315|Kayauni
520803|Kayangan
650210|Kayan Selatan
610509|Kayan Hulu
650205|Kayan Hulu
610508|Kayan Hilir
650204|Kayan Hilir
330109|Kawunganten
950217|Kawor
352005|Kawedanan
110502|Kaway XVI
710221|Kawangkoan Utara
710222|Kawangkoan Barat
710212|Kawangkoan
327805|Kawalu
320709|Kawali
930220|Kawagit
910311|Kaureh
170403|Kaur Utara
170404|Kaur Tengah
170405|Kaur Selatan
350405|Kauman
350212|Kauman
710602|Kauditan
640815|Kaubun
740813|Katoi
740316|Katobu
620605|Katingan Tengah
620610|Katingan Kuala
620608|Katingan Hulu
620602|Katingan Hilir
950401|Karubaga
950732|Karu
352015|Kartoharjo (Kertoharjo)
357701|Kartoharjo
331112|Kartasura
760605|Karossa
332010|Karimunjawa (Karimun Jawa)
210203|Karimun
531113|Karera
351905|Kare
321526|Karawang Timur
321501|Karawang Barat
367107|Karawaci
620403|Karau Kuala
920306|Karas
352014|Karas
320934|Karangwareng
332105|Karangtengah (Karang Tengah)
320307|Karangtengah
320516|Karangtengah
331223|Karangtengah
331409|Karangmalang
330218|Karanglewas
330413|Karangkobar
320621|Karangjaya (Karang Jaya)
352107|Karangjati
330317|Karangjambu
352418|Karanggeneng (Karang Geneng)
330914|Karanggede
330521|Karanggayam
331013|Karangdowo
332618|Karangdadap
352424|Karangbinangun
332102|Karangawen
510704|Karangasem (Karang Asem)
332109|Karanganyar
352117|Karanganyar
332607|Karanganyar
330311|Karanganyar
331309|Karanganyar
330520|Karanganyar
531705|Katiku Tana Selatan (Katikutana Selatan)
531701|Katiku Tana
180108|Katibung
140408|Kateman
320411|Katapang
210411|Katang Bidare
531119|Katala Hamu Lingu
180802|Kasui
352119|Kasreman
321326|Kasomalang
321024|Kasokandel
820416|Kasiruta Timur
820415|Kasiruta Barat
720808|Kasimbar
352220|Kasiman
340216|Kasihan
920928|Kasi
367302|Kasemen
350728|Kasembon
181305|Karya Penggawa
621310|Karusen Janang
331018|Karanganom
640816|Karangan
350306|Karangan
321210|Karangampel
170901|Karang Tinggi
367112|Karang Tengah
360125|Karang Tanjung
357801|Karang Pilang (Karangpilang)
320829|Karang Kancana (Karangkancana)
161306|Karang Jaya
630306|Karang Intan
161305|Karang Dapo
631007|Karang Bintang
111603|Karang Baru
321610|Karang Bahagia (Karangbahagia)
160720|Karang Agung Ilir
720510|Karamat
130707|Kapur IX/Sembilan
620303|Kapuas Timur
620311|Kapuas Tengah
620307|Kapuas Murung
620304|Kapuas Kuala
620312|Kapuas Hulu
620302|Kapuas Hilir
620305|Kapuas Barat
610301|Kapuas (Sanggau Kapuas)
930117|Kaptel
740422|Kapontori
351210|Kapongan
740233|Kapoiala
940805|Kapiraya
320922|Kapetakan
352214|Kapas
732620|Kapala Pitu (Kapalla Pitu)
820320|Kao Utara
820322|Kao Teluk
820321|Kao Barat
820307|Kao
352211|Kanor
350510|Kanigoro
357404|Kanigaran
332417|Kangkung
950403|Kanggime
352927|Kangayan
530719|Kangae
140810|Kandis
161013|Kandis
332513|Kandeman
350605|Kandat
332601|Kandangserang
321221|Kandanghaur
630605|Kandangan
332306|Kandangan
350619|Kandangan
531120|Kanatang
920620|Kamundan
940604|Kamu Utara
940608|Kamu Timur
940607|Kamu Selatan
940601|Kamu
122202|Kampung Rakyat
177105|Kampung Melayu
330124|Kampung Laut
140118|Kampar Utara
140119|Kampar Kiri Tengah
140109|Kampar Kiri Hulu
140108|Kampar Kiri Hilir
140107|Kampar Kiri
140102|Kampar
350307|Kampak
140117|Kampa (Kampar Timur)
620601|Kamipang
747110|Kambu
920805|Kambrau (Kambraw / Kamberau)
741002|Kambowa
950427|Kamboneri
531116|Kambera
531117|Kambata Mapambuhang
731713|Kamanre
130615|Kamang Magek
130306|Kamang Baru
352604|Kamal
630609|Kalumpang (Kelumpang)
320906|Karangsembung
330526|Karangsambung
350408|Karangrejo (Karang Rejo)
352013|Karangrejo
330310|Karangreja
331502|Karangrayung
330112|Karangpucung
350723|Karangploso (Karang Ploso)
352714|Karangpenang (Karang Penang)
320502|Karangpawitan
331308|Karangpandan
320602|Karangnunggal
331010|Karangnongko
330312|Karangmoncol
340309|Karangmojo
760204|Kalumpang
760203|Kalukku
332305|Kaloran
710412|Kalongan
940218|Kalome
950213|Kalomdol
332420|Kaliwungu Selatan
331901|Kaliwungu
332217|Kaliwungu
332408|Kaliwungu
330704|Kaliwiro
320929|Kaliwedi
350919|Kaliwates
352216|Kalitidu
352420|Kalitengah
350927|Kalisat
610618|Kalis
180201|Kalirejo
351021|Kalipuro
321808|Kalipucang
350711|Kalipare
331709|Kaliori
640810|Kaliorang
332013|Kalinyamatan
320827|Kalimanggis
330306|Kalimanah
331023|Kalikotes
330707|Kalikajar
321304|Kalijati
331401|Kalijambe
330304|Kaligondang
330605|Kaligesing
167110|Kalidoni
317306|Kalideres
350414|Kalidawir
320223|Kalibunder
330418|Kalibening
340112|Kalibawang
330715|Kalibawang
351011|Kalibaru
330210|Kalibagor
330813|Kaliangkrik
352902|Kalianget
180106|Kalianda
740706|Kaledupa Selatan
740702|Kaledupa
710608|Kalawat
340410|Kalasan
320218|Kalapanunggal (Kalapa Nunggal)
360224|Kalanganyar
732410|Kalaena
530405|Kakuluk Mesak
710220|Kakas Barat
710206|Kakas
730803|Kajuara
330812|Kajoran
332608|Kajen
730206|Kajang
920615|Kaitaro
911111|Kaisenar
920426|Kais Darat
920414|Kais
810607|Kairatu Barat
810601|Kairatu
920801|Kaimana
710805|Kaidipang
930307|Kaibar
950441|Kai
730802|Kahu
621103|Kahayan Tengah
621102|Kahayan Kuala
621004|Kahayan Hulu Utara
621105|Kahayan Hilir
531114|Kahaungu Eti (Kahaunguweti)
352812|Kadur
320317|Kadupandak
320510|Kadungora
360119|Kaduhejo
320801|Kadugede
320230|Kadudampit
321013|Kadipaten
320637|Kadipaten
747108|Kadia
350504|Kademangan
357401|Kademangan
741507|Kadatua
140612|Kabun
351716|Kabuh
530510|Kabola
750308|Kabila Bone
750302|Kabila
950344|Kabianggama
740324|Kabawo
351014|Kabat
710406|Kabaruan
120601|Kabanjahe
740323|Kabangka
320219|Kabandungan
740615|Kabaena Utara
740606|Kabaena Timur
740616|Kabaena Tengah
740613|Kabaena Selatan
740614|Kabaena Barat
740605|Kabaena
331014|Juwiring
330919|Juwangi
331808|Juwana
321211|Juntinyuat
357903|Junrejo
130213|Junjung Sirih
332310|Jumo
331303|Jumapolo
331304|Jumantono
110302|Julok
111109|Juli
150816|Jujuhan Ilir
150804|Jujuhan
120607|Juhar
631101|Juai
352707|Jrengik
930420|Joutu
630102|Jorong
120806|Jorlang Hataran
610607|Jongkong (Jengkong)
610208|Jongkat (Siantan)
320106|Jonggol
520202|Jonggat
351709|Jombang
367205|Jombang
350901|Jombang
317108|Johar Baru
110501|Johan Pahwalan (Johan Pahlawan)
351719|Jogoroto
352103|Jogorogo
331008|Jogonalan
930411|Joerat
351909|Jiwan
940405|Jita
160615|Jirak Jaya
360116|Jiput
940406|Jila
331607|Jiken
111102|Jeunieb
111104|Jeumpa
111208|Jeumpa
930413|Jetsy
351616|Jetis
347102|Jetis
340209|Jetis
350209|Jetis
950230|Jetfa
330108|Jeruklegi
520320|Jerowaru
520701|Jereweh
530912|Jerebuu
331608|Jepon
332006|Jepara
352312|Jenu
350916|Jenggawah
331317|Jenawi
331420|Jenar
350218|Jenangan
620401|Jenamas
640711|Jempang
510105|Jembrana
210505|Jemaja Timur
210509|Jemaja Barat
210506|Jemaja
157108|Jelutung
610811|Jelimpo
350925|Jelbuk
610414|Jelai Hulu
620802|Jelai
331906|Jekulo
627103|Jekan Raya
160217|Jejawi
630417|Jejangkit
190503|Jebus
337204|Jebres
917101|Jayapura Utara
917102|Jayapura Selatan
160816|Jayapura
360302|Jayanti
160508|Jayaloka (Jaya Loka)
321522|Jayakerta
117108|Jaya Baru
111405|Jaya
360426|Jawilan
610116|Jawai Selatan
610103|Jawai
120819|Jawa Maraja Bah Jambi
331302|Jatiyoso
320619|Jatiwaras
321011|Jatiwangi
367102|Jatiuwung
321015|Jatitujuh
331220|Jatisrono
321514|Jatisari
327510|Jatisampurna (Jati Sampurna)
350817|Jatiroto
331215|Jatiroto
352302|Jatirogo
351601|Jatirejo
331301|Jatipuro
331221|Jatipurno
321102|Jatinunggal
331020|Jatinom
332807|Jatinegara
317503|Jatinegara
321115|Jatinangor
320712|Jatinagara
321403|Jatiluhur
330203|Jatilawang
351820|Jatikalen
321126|Jatigede
332907|Jatibarang
321213|Jatibarang
351201|Jatibanteng
327509|Jatiasih
180113|Jati Agung
331601|Jati
331903|Jati
331311|Jaten
320119|Jasinga
630911|Jaro
160406|Jarai
320823|Japara
331616|Japah
150218|Jangkat Timur (Sungai Tenang)
150201|Jangkat
351212|Jangkar
610304|Jangkang
111803|Jangka Buya (Jangka Buaya)
320812|Jalaksana
331809|Jakenan
331806|Jaken
167117|Jakabaring
930205|Jair
820105|Jailolo Selatan
820101|Jailolo
110419|Jagong Jeget
610707|Jagoi Babang
930107|Jagebob
317409|Jagakarsa
180703|Jabung
350717|Jabung
351505|Jabon
621107|Jabiren Raya
111110|Jangka
520207|Janapria
320208|Jampangtengah (Jampang Tengah)
320221|Jampangkulon (Jampang Kulon)
332208|Jambu
350220|Jambon
320940|Jamblang
157103|Jambi Timur
157102|Jambi Selatan
150501|Jambi Luar Kota
351123|Jambesari Darus Sholah
360304|Jambe
357823|Jambangan
320635|Jamanis
321312|Jalancagak
130209|IX Koto Sungai Lasi
950204|Iwur
740127|Iwoimendaa
940415|Iwaka
130112|IV Nagari Bayang Utara
130305|IV Nagari
130509|IV Koto Aur Malintang
130605|IV Koto (Ampek Koto)
130105|IV Jurai
950119|Itlay Hisage
940211|Irimuli
920917|Ireres
170605|Ipuh (Muko Muko Selatan)
532106|Io Kufeu
140911|Inuman
530309|Insana Utara
530321|Insana Tengah
530319|Insana Fafinesu
530320|Insana Barat
530308|Insana
950821|Iniye
930208|Iniyandit
950820|Inikgal
110610|Ingin Jaya
911509|Inggerus
530920|Inerie
110603|Indrapuri
321215|Indramayu
161007|Indralaya Utara
161008|Indralaya Selatan
161004|Indralaya
530616|Ile Bura
530613|Ile Boleng
531309|Ile Ape Timur
531303|Ile Ape
940213|Ilamburawi
940518|Ilaga Utara
940501|Ilaga
110314|Idi Tunong
110323|Idi Timur
110303|Idi Rayeuk
121435|Idanotae
120410|Idanogawo (Idano Gawo)
320436|Ibun
820107|Ibu Utara
820108|Ibu Selatan
820103|Ibu
950117|Ibele
122105|Hutaraja Tinggi (Huta Raja Tinggi)
120818|Huta Bayu Raja
121319|Huta Bargot
121420|Huruna
122103|Huristak
180317|Hulu Sungkai
610419|Hulu Sungai
122009|Hulu Sihapas
170319|Hulu Palik
110707|Indrajaya (Indra Jaya)
110313|Indra Makmu (Indra Makmur)
111407|Indra Jaya
327804|Indihiang
920404|Inanwatan
810606|Inamosol
340210|Imogiri
930120|Ilwayab (Ilyawab)
950505|Ilugwa
940202|Ilu
167118|Ilir Timur Tiga
167105|Ilir Timur Satu (Ilir Timur I)
167106|Ilir Timur Dua (Ilir Timur II)
170514|Ilir Talo
167104|Ilir Barat Satu (Ilir Barat I)
167101|Ilir Barat Dua (Ilir Barat II)
530604|Ile Mandiri
140912|Hulu Kuantan
610608|Hulu Gurung
757109|Hulonthalangi
950104|Hubikosi
950116|Hubikiak
810604|Huamual Belakang
810608|Huamual
520503|Hu'u
940414|Hoya
940702|Homeyo
950334|Holuwon
950314|Hogio
920152|Hobard
810216|Hoat Sorbay
940706|Hitadipa
921210|Hingk
120510|Hinai
120420|Hiliserangkai (Hili Serangkai / Hilisaranggu)
121423|Hilisalawa'ahe (Hilisalawaahe)
130217|Hiliran Gumanti
950347|Hilipuk
121411|Hilimegai
120405|Hiliduho
121404|Hibala
530718|Hewokloang
730205|Herlang (Hero Lange Lange)
950327|Hereapini
917105|Heram
711106|Helumo
532005|Hawu Mehara
320331|Haurwangi
321201|Haurgeulis
630808|Haur Gading
630512|Hatungun
120812|Hatonduhan
630701|Haruyan
630905|Haruai
127801|Gunungsitoli
360433|Gunungsari (Gunung Sari)
520109|Gunungsari
337412|Gunungpati
360208|Gunungkencana (Gunung Kencana)
321715|Gununghalu
320227|Gunungguruh
131206|Gunung Tuleh (Gunungtuleh)
150115|Gunung Tujuh
620502|Gunung Timang
181204|Gunung Terang
130207|Gunung Talang
640306|Gunung Tabur
180204|Gunung Sugih
121112|Gunung Sitember
320111|Gunung Sindur
140120|Gunung Sahilan
150101|Gunung Raya
327201|Gunung Puyuh (Gunungpuyuh)
320102|Gunung Putri
327403|Harjamukti
121705|Harian
130705|Harau
120815|Haranggaol Horisan (Haranggaol Horison)
320826|Hantara
630709|Hantakan
620704|Hanau
157203|Hamparan Rawang
120724|Hamparan Perak
630214|Hampang
122011|Halongonan Timur
122003|Halongonan
631102|Halong
930305|Haju
531102|Haharu
332103|Guntur
331703|Gunem
950420|Gundagi
950734|Guna
350904|Gumukmas (Gumuk Mas)
330215|Gumelar
721008|Gumbasa
160425|Gumay Ulu
160421|Gumay Talang
352909|Guluk-Guluk (Guluk Guluk)
137501|Guguak Panjang (Guguk Panjang)
130702|Guguak (Gugu)
351702|Gudo
350813|Gucialit
940223|Gubume
331517|Gubug
357808|Gubeng
741406|Gu
121204|Habinsaran
350610|Gurah
940210|Gurage
950727|Gupura
331817|Gunungwungkal
140907|Gunungtoar (Gunung Toar)
320623|Gunungtanjung (Gunung Tanjung)
127803|Gunungsitoli Utara
127802|Gunungsitoli Selatan
127804|Gunungsitoli Idanoi
127806|Gunungsitoli Barat
127805|Gunungsitoli Alo'oa
351106|Grujugan
110725|Grong Grong
317302|Grogol Petamburan
350613|Grogol
331109|Grogol
331512|Grobogan
332507|Gringsing
352516|Gresik
910318|Gresi Selatan
320938|Greged (Greget)
351420|Grati
352320|Grabagan
330601|Grabag
330818|Grabag
620503|Gunung Purei
180718|Gunung Pelindung
111006|Gunung Meriah (Mariah)
120701|Gunung Meriah
160304|Gunung Megang
120803|Gunung Maligas
120802|Gunung Malela
180810|Gunung Labuhan
210104|Gunung Kijang
150106|Gunung Kerinci
360332|Gunung Kaler
320921|Gunung Jati (Cirebon Utara)
357825|Gunung Anyar (Gununganyar)
180621|Gunung Alip
181205|Gunung Agung
130708|Gunuang Omeh (Gunung Mas)
940508|Gome
330519|Gombong
950720|Gollo
530918|Golewa Selatan
530919|Golewa Barat
530902|Golewa
331516|Godong
340402|Godean
950724|Goa Balim
620405|Gn. Bintang Awai (Gunung Bintang Awai)
110706|Glumpang Tiga (Geulumpang Tiga)
110729|Glumpang Baro
120406|Gido
510403|Gianyar
331505|Geyer
950424|Geya
110825|Geuredong Pase
110705|Geumpang
332201|Getasan
331418|Gesi
950805|Geselma
197105|Gerunggang
520101|Gerung
510801|Gerokgak
367206|Gerogol
352118|Gerih
150710|Geragai
337405|Genuk
750506|Gentuma Raya
357807|Genteng
351009|Genteng
352105|Geneng
351318|Gending
332411|Gemuh
950405|Goyage
810511|Gorom Timur
347110|Gondomanan
347103|Gondokusuman
351418|Gondangwetan (Gondang Wetan)
331313|Gondangrejo
350710|Gondanglegi
351602|Gondang
351817|Gondang
350409|Gondang
331406|Gondang
352226|Gondang
121402|Gomo
940524|Gome Utara
351010|Glenmore
351015|Glagah
352426|Glagah
330920|Gladagsari
180620|Gisting
120816|Girsang Sipangan Bolon
331203|Giriwoyo
331202|Giritontro
340316|Girisubo
340109|Girimulyo
197107|Girimaya
331222|Girimarto
717206|Girian
170308|Giri Mulia (Giri Mulya)
351017|Giri
950418|Gilubandu
731313|Gilireng
352908|Giliginting (Gili Ginting)
950434|Gika
180511|Gedung Meneng
180527|Gedung Aji Baru
180506|Gedung Aji
347105|Gedongtengen (Gedong Tengen)
180901|Gedong Tataan
351614|Gedeg
327327|Gedebage
340314|Gedangsari (Gedang Sari)
351516|Gedangan
350729|Gedangan
331908|Gebog
120513|Gebang
330614|Gebang
320930|Gebang
950808|Gearek
357822|Gayungan
337404|Gayamsari
352228|Gayam
352920|Gayam
140406|Gaung Anak Serka
820426|Gane Timur Selatan
820403|Gane Timur
820424|Gane Barat Utara
820423|Gane Barat Selatan
820404|Gane Barat
350515|Gandusari
350310|Gandusari
167112|Gandus
330110|Gandrungmangu
352910|Ganding
111107|Gandapura (Ganda Pura)
731819|Gandangbatu Sillanan (Gandang Batu Sillanan)
340401|Gamping
350612|Gampengrejo
950704|Gamelia
630303|Gambut
351007|Gambiran
351412|Gempol
320937|Gempol
331413|Gemolong
710408|Gemeh
331813|Gembong
332320|Gemawang
351906|Gemarang
160306|Gelumbang
950729|Gelok Beam
320327|Gekbrong
320928|Gegesik
320240|Gegerbitung (Geger Bitung)
351903|Geger
352606|Geger
180415|Gedung Surian
140412|Gaung
331111|Gatak
320501|Garut Kota
330712|Garung
350511|Garum
120214|Garoga
320808|Garawangi
352919|Gapura
190602|Gantung
331002|Gantiwarno
730307|Gantarang Keke (Gantareng Keke)
730201|Gantarang (Gantorang, Gangking)
321225|Gantar
731207|Ganra
520802|Gangga
321119|Ganeas
820427|Gane Timur Tengah
317101|Gambir
340104|Galur
352803|Galis
352618|Galis
610111|Galing
730506|Galesong Utara
730505|Galesong Selatan
730509|Galesong
820315|Galela Utara
820316|Galela Selatan
820314|Galela Barat
820304|Galela
217108|Galang
720408|Galang
120719|Galang
337409|Gajahmungkur (Gajah Mungkur)
111710|Gajah Putih
920901|Fef
930405|Fayit
940203|Fawi
530228|Fautmolo
530212|Fatumnasi
530128|Fatuleu Tengah
530127|Fatuleu Barat
530110|Fatuleu
530229|Fatukopa
121418|Fanayama
920312|Fakfak Timur Tengah
920303|Fak-Fak Timur (Fakfak Timur)
920305|Fak-Fak Tengah (Fakfak Tengah)
920302|Fak-Fak Barat (Fakfak Barat)
920301|Fak-Fak (Fakfak)
940324|Fajar Timur
920608|Fafurwar (Irorutu)
710419|Essang Selatan
710404|Essang
331208|Eromoko
710203|Eris
730303|Eremerasa
940525|Erelmakawia
950503|Eragayam
332108|Gajah
720509|Gadung
357501|Gadingrejo
181002|Gading Rejo
177102|Gading Cempaka
351309|Gading
321203|Gabuswetan
331811|Gabus
331508|Gabus
197106|Gabek
920316|Furwagi
810306|Fordata (Yaru)
920424|Fokour
930210|Fofi
930213|Firiwage
810413|Fena Leisela
810906|Fena Fafan
611003|Ella Hilir
930110|Elikobal
950601|Elelim
531909|Elar Selatan
531905|Elar
940310|Ekadide
950232|Eipumek
950425|Egiam
930304|Edera
910312|Ebungfao (Ebungfau / Ebungfa)
620404|Dusun Utara
621301|Dusun Timur
621305|Dusun Tengah
620406|Dusun Selatan
610321|Entikong
731602|Enrekang
140402|Enok
170301|Enggano
187117|Enggal
950331|Endomen
530818|Ende Utara
530820|Ende Timur
530819|Ende Tengah
530804|Ende Selatan
530803|Ende
130517|Enam Lingkung
160326|Empat Petulai Dangku
520414|Empang
610613|Empanang
950824|Embetpen
610604|Embaloh Hulu
610603|Embaloh Hilir
810611|Elpaputih
147206|Dumai Kota
147201|Dumai Barat
940306|Dumadama
750203|Dulupi
320916|Dukupuntang
352501|Dukun
330806|Dukun
332818|Dukuhwaru
332813|Dukuhturi
331820|Dukuhseti
357821|Dukuh Pakis
750410|Duhiadaa
352505|Duduksampeyan (Duduk Sampeyan)
731506|Duampanua
731409|Dua Pitue
730819|Dua Boccoe
352515|Driyorejo
620402|Dusun Hilir
740317|Duruka
760106|Duripoku
350313|Durenan
317507|Duren Sawit
950348|Duram
210209|Durai
130812|Duo Koto
352918|Dungkek
757104|Dungingi
750124|Dungaliyo
950423|Dundu
710111|Dumoga Utara
710110|Dumoga Timur
710134|Dumoga Tenggara
710135|Dumoga Tengah
710109|Dumoga Barat
710133|Dumoga
757108|Dumbo Raya
147202|Dumai Timur
147207|Dumai Selatan
122001|Dolok Sigompulon
121606|Dolok Sanggul
120820|Dolok Pardamean
120813|Dolok Panribuan
121807|Dolok Merawan
121809|Dolok Masihul
120817|Dolok Batu Nanggar
122002|Dolok
120832|Dolog Masagal
721009|Dolo Selatan
721011|Dolo Barat
721012|Dolo
120614|Dolat Rayat
940217|Dokome
350518|Doko
940321|Dogomo
940610|Dogiyai
340211|Dlingo
351609|Dlanggu
351708|Diwek
950333|Dirwemna
940114|Dipa
710605|Dimembe
950705|Dimba
921205|Didohu
110802|Dewantara
530806|Detusoko
530815|Detukeli
940509|Dervos
930414|Der Koumur
340407|Depok
320931|Depok
150117|Depati Tujuh
910303|Depapre
180525|Dente Teladas
517104|Denpasar Utara
517102|Denpasar Timur
517101|Denpasar Selatan
517103|Denpasar Barat
750408|Dengilo
732612|Dende' Piongan Napo
190603|Dendang
150706|Dendang
910310|Demta
167203|Dempo Utara
351319|Dringu
320130|Dramaga
950430|Dow
940504|Doufo
332606|Doro
530720|Doreng
731206|Donri Donri
332016|Donorojo
350101|Donorojo
350701|Donomulyo
350304|Dongko
520608|Donggo
720403|Dondo
520501|Dompu
351902|Dolopo
120826|Dolok Silou (Dolok Silau)
167205|Dempo Tengah
167204|Dempo Selatan
332107|Dempet
530614|Demon Pagong
911513|Demba
332111|Demak
610416|Delta Pawan
110704|Delima
120722|Deli Tua
110213|Deleng Pokhkisen (Deleng Pokhisen)
331016|Delanggu
620902|Delang
352425|Deket
950307|Dekai
940320|Deiyai Miyo
610507|Dedai
140806|Dayun
330116|Dayeuhluhur
320412|Dayeuhkolot
321012|Dawuan
321327|Dawuan
810810|Dawelor Dawera
331909|Dawe
351617|Dawarblandong (Dawar Blandong)
510504|Dawan
350722|Dau
121911|Datuk Tanah Datar
121910|Datuk Lima Puluh
127406|Datuk Bandar Timur
127405|Datuk Bandar
921104|Dataran Isim
150123|Danau Kerinci Barat
150102|Danau Kerinci
130219|Danau Kembar
350705|Dampit
720306|Dampelas
720402|Dampal Utara
720401|Dampal Selatan
810802|Damer
710409|Damau (Damao)
190605|Damar
621008|Damang Batu
640708|Damai
950818|Dal
720410|Dako Pemean (Dako Pamean)
630608|Daha Utara
630607|Daha Selatan
630611|Daha Barat
351904|Dagangan
940225|Dagai
620316|Dadahup
920613|Dataran Beimes
352914|Dasuk
110612|Darussalam
111505|Darul Makmur
110619|Darul Kamal
110607|Darul Imarah
110321|Darul Ihsan (Iksan)
111408|Darul Hikmah
110207|Darul Hasanah
110322|Darul Falah
110301|Darul Aman
321103|Darmaraja
320817|Darma
321406|Darangdan
760105|Dapurang
347104|Danurejan
950439|Danime
741112|Dangia
352206|Dander
157106|Danau Teluk
157110|Danau Sipin
620703|Danau Sembuluh
620708|Danau Seluluk
111011|Danau Paris
630801|Danau Panggang
111308|Dabun Gelang (Debun Gelang)
170216|Curup Utara
170217|Curup Timur
170219|Curup Tengah
170218|Curup Selatan
170209|Curup
320242|Curugkembar
360223|Curug bitung (Curugbitung)
360317|Curug
367304|Curug
731608|Curio
351107|Curahdami
320610|Culamega
180609|Cukuh Balak
320311|Cugenang
110817|Cot Girek
531912|Congkar
321107|Conggeang
140418|Concong
321315|Compreng
332712|Comal
331312|Colomadu
327302|Coblong
331818|Cluwak
351006|Cluring
320439|Ciwidey
320804|Ciwaru
320926|Ciwaringin
367204|Ciwandan
731208|Citta
320103|Citeureup
367208|Citangkil
327203|Citamiang
930303|Citak-Mitak (Citakmitak)
320520|Cisurupan
320528|Cisompet
320205|Cisolok
360305|Cisoka
321105|Cisitu
320535|Cisewu
320133|Ciseeng
320632|Cisayong
360323|Cisauk
360123|Cisata
321123|Cisarua
320125|Cisarua
321703|Cisarua
321302|Cisalak
320730|Cisaga
320229|Cisaat
360409|Ciruas
360227|Cirinten
320235|Cireunghas
320305|Ciranjang
317509|Ciracas
320226|Ciracap
367405|Ciputat Timur
367404|Ciputat
321318|Cipunagara
321712|Cipongkor
367105|Cipondoh
367305|Cipocok Jaya
320821|Cipicung
321705|Cipeundeuy
321320|Cipeundeuy
360115|Cipeucang
327802|Cipedes
317510|Cipayung
327607|Cipayung
320601|Cipatujah
321707|Cipatat
330118|Cipari
320429|Ciparay
320328|Cipanas
360204|Cipanas
320711|Cipaku
360427|Ciomas
320129|Ciomas
630320|Cintapuri Darussalam
320802|Ciniru
321023|Cingambul
327609|Cinere
320620|Cineam
360431|Cinangka
327329|Cinambo
730810|Cina
321803|Cimerak
320406|Cimenyan (Cimeunyan)
320417|Cimaung
360211|Cimarga
320729|Cimaragas
360118|Cimanuk
321114|Cimanggung
330113|Cimanggu
360102|Cimanggu
320246|Cimanggu
327602|Cimanggis
321122|Cimalaka
327703|Cimahi Utara
327702|Cimahi Tengah
327701|Cimahi Selatan
320824|Cimahi
330217|Cilongok
360220|Cilograng
327608|Cilodong
317204|Cilincing
320813|Cilimus
321711|Cililin
320405|Cileunyi
320107|Cileungsi
320407|Cilengkrang
360210|Cileles
367202|Cilegon
320902|Ciledug
367106|Ciledug
321530|Cilebar
320825|Cilebak
320519|Cilawu
317406|Cilandak
321515|Cilamaya Wetan
321523|Cilamaya Kulon
321609|Cikarang Utara
321611|Cikarang Timur
321619|Cikarang Selatan
321620|Cikarang Pusat
321608|Cikarang Barat
360415|Cikande
320427|Cikancung
321513|Cikampek
321704|Cikalongwetan (Cikalong Wetan)
320312|Cikalongkulon
320603|Cikalong
320203|Cikakak
320522|Cikajang
320326|Cikadu
321802|Cijulang
320703|Cijeungjing
320128|Cijeruk
320329|Cijati
321319|Cijambe
360216|Cijaku
320525|Cihurip
320303|Cibeber
360219|Cibeber
367201|Cibeber
320512|Cibatu
321414|Cibatu
321622|Cibarusah
320606|Cibalong
320529|Cibalong
360103|Cibaliung
531017|Cibal Barat
531006|Cibal
360218|Cibadak
320211|Cibadak
320810|Ciawigebang
320124|Ciawi
320636|Ciawi
321329|Ciater
321309|Ciasem
320304|Cilaku
330123|Cilacap Utara
330122|Cilacap Tengah
330121|Cilacap Selatan
360318|Cikupa
360217|Cikulur
320702|Cikoneng
327202|Cikole
321003|Cikijing
320206|Cikidang
360104|Cikeusik
360423|Cikeusal
320210|Cikembar
320530|Cikelet
321204|Cikedung
360126|Cikedal (Cikeudal)
321322|Cikaum
320605|Cikatomas
327801|Cihideung
320706|Cihaurbeuti
360226|Cihara
321710|Cihampelas
320818|Cigugur
321804|Cigugur
320122|Cigudeg
320138|Cigombong
360105|Cigeulis
360228|Cigemlong (Cigemblong)
320518|Cigedug
321020|Cigasong
320832|Cigandamekar
320627|Cigalontang
320222|Ciemas
320243|Cidolog
320705|Cidolog
320323|Cidaun
320217|Cidahu
320811|Cidahu
320244|Cidadap
327308|Cidadap
730910|Cenrana
730820|Cenrana
317301|Cengkareng
160218|Cengal
731607|Cendana
317105|Cempaka Putih
637203|Cempaka
160804|Cempaka
620213|Cempaga Hulu
620202|Cempaga
731508|Cempa
110413|Celala
331005|Cawas
921207|Catubouw
320108|Cariu
360128|Carita
320127|Caringin
320536|Caringin
320231|Caringin
360417|Carenang (Cerenang)
320216|Cicurug
327306|Cicendo
320228|Cicantayan
320425|Cicalengka
320116|Cibungbulang
321104|Cibugel
321511|Cibuaya
321317|Cibogo
367109|Cibodas
320540|Cibiuk
320225|Cibitung
321607|Cibitung
360127|Cibitung
327325|Cibiru
320320|Cibinong
320101|Cibinong
320805|Cibingbin
327806|Cibeureum
327207|Cibeureum
320828|Cibeureum
327314|Cibeunying Kidul
327318|Cibeunying Kaler
320301|Cianjur
321504|Ciampel
320115|Ciampea
320701|Ciamis
320247|Ciambar
150310|Cermin Nan Gedang / Gadang
351115|Cermee
352511|Cerme
140905|Cerenti
630409|Cerbon
331605|Cepu
330903|Cepogo
332413|Cepiring
331011|Ceper
610711|Capkala
321217|Cantigi
320444|Cangkuang
340417|Cangkringan
130614|Candung
337408|Candisari
332312|Candiroto
180117|Candipuro
350803|Candipuro
330815|Candimulyo
630506|Candi Laras Utara
630505|Candi Laras Selatan
351507|Candi
350416|Campurdarat (Campur Darat)
352704|Camplong
760402|Campalagian
320325|Campakamulya (Campaka Mulya)
321402|Campaka
320315|Campaka
167403|Cambai
730902|Camba
317506|Cakung
527103|Cakranegara
360122|Cadasari
321616|Cabangbungin
531307|Buyasuri
330610|Butuh
510803|Busungbiu (Busung biu)
640806|Busang
920802|Buruway
210206|Buru
352603|Burneh
732407|Burau
650110|Bunyu (Pulau Bunyu)
610606|Bunut Hulu
610605|Bunut Hilir
140508|Bunut
760316|Buntumalangka
750409|Buntulia
732613|Buntu Pepasan
120916|Buntu Pane
731610|Buntu Batu
732605|Buntao
720102|Bunta
720504|Bunobogu
137105|Bungus Teluk Kabung
327809|Bungursari
321413|Bungursari
210308|Bunguran Utara
210315|Bunguran Timur Laut
210307|Bunguran Timur
210316|Bunguran Tengah
210318|Bunguran Selatan
210320|Bunguran Batubi
210305|Bunguran Barat
630509|Bungur
731006|Bungoro
150812|Bungo Dani
721208|Bungku Utara
170110|Bunga Mas
717110|Bunaken Kepulauan
717101|Bunaken
332802|Bumijawa
332903|Bumiayu
357902|Bumiaji
187120|Bumi Waras
720609|Bumi Raya
180214|Bumi Ratu Nuban
180224|Bumi Nabung
630111|Bumi Makmur
180814|Bumi Agung
180714|Bumi Agung
330506|Buluspesantren
730706|Bulupoddo
350714|Bululawang
730207|Bulukumpa (Bulukumba)
331218|Bulukerto
760107|Bulu Taba
720618|Bungku Timur
720605|Bungku Tengah
720606|Bungku Selatan
720615|Bungku Pesisir
720608|Bungku Barat
350203|Bungkal
731606|Bungin
747204|Bungi
320531|Bungbulang
730609|Bungaya
351217|Bungatan
352512|Bungah
140808|Bunga Raya
160811|Bunga Mayang
180316|Bunga Mayang
720709|Bulagi Selatan
720706|Bulagi
810512|Bula Barat
810501|Bula
720718|Buko Selatan
720707|Buko
150120|Bukitkerman
167111|Bukitkecil (Bukit Kecil)
110209|Bukit Tusam
130208|Bukit Sundi
620215|Bukit Santuai (Bukit Santuei)
147107|Bukit Raya
620613|Bukit Raya
121307|Bukit Malintang
180301|Bukit Kemuning
147203|Bukit Kapur
197101|Bukit Intan (Bukitintan)
217204|Bukit Bestari
627102|Bukit Batu
140303|Bukit Batu
111705|Bukit
130712|Bukik Barisan
730111|Buki
740517|Buke
330302|Bukateja
720508|Bukal
920147|Buk
357503|Bugul Kidul
950738|Buguk Gona
950133|Bugi
520420|Buer
351515|Buduran
760603|Budong-Budong
357813|Bubutan
352205|Bubulan
110506|Bubon
330502|Buayan
160906|Buay Sandang Aji
160907|Buay Runjung
160919|Buay Rawan
160805|Buay Pemuka Peliung
160820|Buay Pemuka Bangsa Raja
160912|Buay Pematang Ribu Ranau Tengah
160909|Buay Pemaca
160812|Buay Madang Timur
160802|Buay Madang
180813|Buay Bahuga
332614|Buaran
160917|Buana Pemaca
720108|Bualemo (Boalemo)
321110|Buahdua
327322|Buahbatu
731705|Bua Ponrang (Bupon)
731708|Bua
160514|BTS Ulu
910616|Bruyadori
950725|Bruwa
330613|Bruno
352407|Brondong
332212|Bringin
352115|Bringin
332909|Brebes
331514|Brati
332409|Brangsong
520705|Brang Rea
520707|Brang Ene
150611|Bram Itam
180722|Braja Selebah (Braja Slebah)
950134|Bpiri
350402|Boyolangu
330905|Boyolali
610619|Boyan Tanjung
940803|Bowobado
750307|Botupingge (Botu Pingge)
750206|Botumoito (Botumoita)
120421|Botomuzoi
351122|Botolinggo
532112|Botin Leobele
920154|Botain
120808|Bosar Maligas
531901|Borong
121427|Boronadu
330802|Borobudur
331102|Bulu
332301|Bulu
331702|Bulu
180627|Bulok
760416|Bulo
620904|Bulik Timur
620903|Bulik
510806|Buleleng
750317|Bulawa
750305|Bulango Utara
750314|Bulango Ulu
750316|Bulango Timur
750315|Bulango Selatan
217105|Bulang
332914|Bulakamba
357829|Bulak
720717|Bulagi Utara
332112|Bonang
140613|Bonai Darussalam
950340|Bomela
920307|Bomberay
930206|Bomakia
520602|Bolo
750109|Boliyohuto (Boliohuto)
531506|Boleng
720807|Bolano Lambunu
720821|Bolano
710803|Bolangitang Timur (Bolang Itang Timur)
710804|Bolangitang Barat (Bolang Itang Barat)
950105|Bolakme
711101|Bolaang Uki
710131|Bolaang Timur
710113|Bolaang
731311|Bola
647402|Bontang Selatan
647403|Bontang Barat
330523|Bonorowo
130804|Bonjol
750111|Bongomeme
911015|Bonggo Timur
911005|Bonggo
731803|Bonggakaradeng
321222|Bongas
640712|Bongan
750304|Bonepantai
760215|Bonehau
741003|Bonegunu
750310|Bone Raya
732202|Bone Bone
740326|Bone (Bone Tondo)
750309|Bone
351111|Bondowoso
740221|Bondoala
910621|Bondifuar
121223|Bonatua Lunasi
950206|Borme
121206|Borbor
730105|Bontosikuyu
730407|Bontoramba
730616|Bontonompo Selatan
730601|Bontonompo
730103|Bontomatene
730606|Bontomarannu
730104|Bontomanai
730615|Bontolempangang
730102|Bontoharu
730801|Bontocani
737106|Bontoala
730905|Bontoa (Maros Utara)
730204|Bonto Tiro (Bontotiro)
730203|Bonto Bahari
610305|Bonti
647401|Bontang Utara
360110|Bojong
332803|Bojong
332611|Bojong
321411|Bojong
352215|Bojonegoro
360407|Bojonegara
332407|Boja
331615|Bogorejo
327105|Bogor Utara
327102|Bogor Timur
327103|Bogor Tengah
327101|Bogor Selatan
327104|Bogor Barat
950443|Bogonuk
940304|Bogabaida
332705|Bodeh
330309|Bobotsari
530711|Bola
950415|Bokoneri
950402|Bokondini
530215|Boking
720503|Bokat
721103|Bokan Kepulauan
320408|Bojongsoang
330314|Bojongsari
327611|Bojongsari
320306|Bojongpicung
360207|Bojongmanik
321623|Bojongmangu
327317|Bojongloa Kidul
327304|Bojongloa Kaler
320214|Bojonggenteng (Bojong Genteng)
320611|Bojonggambir
320609|Bojongasih
320113|Bojong Gede (Bojonggede)
117303|Blang Mangat
110623|Blang Bintang (Blank Bintang)
321313|Blanakan
180801|Blambangan Umpu
180323|Blambangan Pagar
510402|Blahbatuh (Belah Batuh)
332503|Blado
320538|Bl. Limbangan (Blubur Limbangan)
950445|Biuk
731802|Bittuang
730301|Bissappu
920618|Biscoop
120707|Biru-Biru (Sibiru-biru)
737111|Biringkanaya (Biring Kanaya)
730611|Biringbulu
110304|Birem Bayeun
127503|Binjai Barat
120505|Binjai
170707|Bingin Kuning
170220|Binduriang
147108|Binawidya
330104|Binangun
350516|Binangun
730403|Binamu
351120|Binakal
940514|Bina
950210|Bime
750120|Biluhu
750123|Bilato
710132|Bilalang
121009|Bilah Hulu
121008|Bilah Hilir
121007|Bilah Barat
530317|Bikomi Utara
530315|Bikomi Tengah
530314|Bikomi Selatan
531603|Boawae
352905|Bluto
352402|Bluluk
331609|Blora (Blora kota)
351025|Blimbingsari
357301|Blimbing
352615|Blega
111201|Blangpidie (Blang Pidie)
111306|Blangpegayon (Blang Pegayon)
111301|Blangkejeren (Blang Kejeren)
111309|Blangjerango (Blang Jerango)
910601|Biak Kota
910608|Biak Barat
950416|Bewani
111510|Beutong Ateuh Banggalang
111504|Beutong
160705|Betung
747201|Betoambari
930419|Betcbamu
650404|Betayau
150604|Betara
740220|Besulutu
350415|Besuki
351202|Besuki
351313|Besuk
120516|Besitang
630313|Beruntung Baru
170224|Bermani Ulu Raya
170210|Bermani Ulu
170801|Bermani Ilir
120733|Beringin
332213|Bergas
351803|Berbek
150711|Berbak
340408|Berbah
920104|Beraur
120602|Berastagi (Brastagi)
120518|Berandan Barat (Brandan Barat)
121113|Berampu (Brampu)
940511|Beoga Timur
940510|Beoga Barat
940503|Beoga
710414|Beo Utara
710418|Beo Selatan
710402|Beo
912007|Benuki
610418|Benua Kayong
740513|Benua
640714|Bentian Besar
730101|Benteng
357819|Benowo
530316|Bikomi Nilulat
920913|Bikar
610602|Bika
110420|Bies
640308|Biduk-Biduk
530306|Biboki Utara
530322|Biboki Tan Pah
530303|Biboki Selatan
530323|Biboki Moenleu
530324|Biboki Feotleu
530307|Biboki Anleu
940305|Bibida
750510|Biau
720506|Biau
640313|Biatan
710907|Biaro
940704|Biandoga
910602|Biak Utara
910603|Biak Timur
352504|Benjeng
730826|Bengo
217109|Bengkong
610704|Bengkayang
140301|Bengkalis
640809|Bengalon
111708|Bener Kelipah
330616|Bener
350309|Bendungan
331106|Bendosari
352010|Bendo
111602|Bendahara
367104|Benda
630501|Binuang
760406|Binuang
360418|Binuang
920601|Bintuni
710802|Bintauna
121817|Bintang Bayu
630912|Bintang Ara
110408|Bintang
210107|Bintan Utara
210106|Bintan Timur
210114|Bintan Pesisir
740704|Binongko
321308|Binong
127501|Binjai Utara
127504|Binjai Timur
127505|Binjai Selatan
127502|Binjai Kota
610521|Binjai Hulu
950604|Benawa
160319|Benakat
140906|Benai
731714|Belopa Utara
731707|Belopa
520604|Belo
160819|Belitang Mulya
160818|Belitang Madang Raya
160817|Belitang Jaya
160810|Belitang III
160809|Belitang II
610906|Belitang Hulu
610905|Belitang Hilir
160803|Belitang
610907|Belitang
190102|Belinyu
611010|Belimbing Hulu
611001|Belimbing
160323|Belimbing
332703|Belik
160324|Belida Darat
630408|Belawang
731307|Belawa
210212|Belat
620907|Belantikan Raya
710703|Belang
180406|Belalau
217101|Belakang Padang
180215|Bekri
327503|Bekasi Utara
327501|Bekasi Timur
327504|Bekasi Selatan
327502|Bekasi Barat
351413|Beji
327606|Beji
332318|Bejen
610306|Beduai (Beduwai)
110403|Bebesen
320913|Beber
510706|Bebandem
160609|Bayung Lencir
320517|Bayongbong
331004|Bayat
130106|Bayang
520804|Bayan
330608|Bayan
360203|Bayah
940319|Baya Biru
120411|Bawolato
332211|Bawen
330405|Bawang
332505|Bawang
352210|Baureno
740112|Baula
331204|Batuwarno
330222|Baturraden (Baturaden)
510209|Baturiti
331207|Baturetno
160114|Baturaja Timur
160113|Baturaja Barat
330416|Batur
352917|Batuputih
747208|Batupoaro
327312|Batununggal
352811|Batumarmar
731512|Batulappa (Batu Lappa)
520212|Batukliang Utara
520203|Batukliang
740334|Batukara
321508|Batujaya
321709|Batujajar
720115|Batui Selatan
720101|Batui
720911|Batudaka
750105|Batudaa Pantai
750103|Batudaa
367103|Batuceper
352926|Batuan
640101|Batu Sopang
640312|Batu Putih
740803|Batu Putih
530214|Batu Putih
181209|Batu Putih
631104|Batu Mandi
631001|Batu Licin (Batulicin)
520114|Batu Layar
520407|Batu Lanteh (Batulanteh)
180421|Batu Ketulis
140712|Batu Hampar
640109|Batu Engau
180410|Batu Brak
630702|Batu Benawa
741504|Batu Atas
611205|Batu Ampar
630109|Batu Ampar
620709|Batu Ampar
217102|Batu Ampar
640817|Batu Ampar
217112|Batu Aji
357901|Batu
950205|Batom
130402|Batipuh
130414|Batipuah Selatan (Batipuh Selatan)
150404|Batin XXIV
150810|Batin II Babeko (Bathin)
140411|Batang Tuaka
120302|Batang Toru
120519|Batang Serangan
140214|Batang Peranap
122007|Batang Onang
121313|Batang Natal
150107|Batang Merangin
150212|Batang Masumai
610612|Batang Lupar
122109|Batang Lubu Sutam
120727|Batang Kuis
620908|Batang Kawa
130104|Batang Kapas
160604|Batang Hari Leko
121315|Batahan
620317|Bataguh
810410|Batabual
731722|Basse Sangtempe Utara
731701|Basse Sangtempe (Bassesang Tempe / Bastem)
130608|Baso
720404|Basidondo
620308|Basarang
740521|Basala
130111|Basa Ampek Balai Tapan
120603|Barusjahe (Barus Jahe)
120117|Barus Utara
120101|Barus
732614|Baruppu
122102|Barumun Tengah
122110|Barumun Selatan
122113|Barumun Baru
170311|Batik Nau
630105|Bati Bati
150308|Bathin VIII (Batin VIII)
140316|Bathin Solapan
150814|Bathin III Ulu
150811|Bathin III
150815|Bathin II Pelayang
110703|Batee
332005|Batealit
741501|Batauga
920520|Batanta Utara
920525|Batanta Selatan
950226|Batani
180713|Batanghari Nuban
180706|Batanghari
331807|Batangan
130513|Batang Gasan
140208|Batang Gangsal (Batang Gansal)
140207|Batang Cenaku
352916|Batang Batang
150607|Batang Asam
150301|Batang Asai
120307|Batang Angkola
130502|Batang Anai
630708|Batang Alai Utara
630710|Batang Alai Timur
630707|Batang Alai Selatan
730404|Batang
332511|Batang
217110|Batam Kota
740315|Batalaiworu (Batalaiwaru)
137302|Barangin
630414|Barambai
731603|Baraka
180804|Baradatu
630706|Barabai
737309|Bara
720407|Baolan
351016|Banyuwangi
330607|Banyuurip
321524|Banyusari
320506|Banyuresmi
332515|Banyuputih
351214|Banyuputih
181006|Banyumas
330211|Banyumas
337411|Banyumanik
122116|Barumun Barat
122107|Barumun
747103|Baruga
731103|Barru
360422|Baros
327205|Baros
640707|Barong Tongkok
351810|Baron
730612|Barombong
731612|Baroko
621206|Barito Tuhup Raya
351704|Bareng
320732|Baregbeg
730809|Barebbo
352012|Barat
760103|Baras
731404|Baranti
741302|Barangka
321002|Bantarujeg
330120|Bantarsari
332902|Bantarkawung
320608|Bantarkalong
327507|Bantargebang (Bantar Gebang)
320204|Bantargadung
332706|Bantarbolang
351304|Bantaran
140302|Bantan
730302|Bantaeng
332316|Bansari
180803|Banjit
320523|Banjarwangi
320718|Banjarsari
337205|Banjarsari
360209|Banjarsari
330406|Banjarnegara
637104|Banjarmasin Utara
637102|Banjarmasin Timur
637105|Banjarmasin Tengah
637101|Banjarmasin Selatan
637103|Banjarmasin Barat
330409|Banjarmangu
332917|Banjarharjo
331611|Banjarejo
637204|Banjarbaru Utara (Banjar Baru Utara)
637205|Banjarbaru Selatan (Banjar Baru Selatan)
320737|Banjaranyar
510502|Banjarangkan
321022|Banjaran
320413|Banjaran
180520|Banjar Margo
180529|Banjar Baru
610812|Banyuke Hulu
351216|Banyuglugur
330909|Banyudono
332207|Banyubiru
352709|Banyuates
160703|Banyuasin III
160702|Banyuasin II
160701|Banyuasin I
351306|Banyuanyar (Banyu Anyar)
350622|Banyakan
130606|Banuhampu
621302|Banua Lima
630901|Banua Lawas
350703|Bantur
340208|Bantul
730903|Bantimurung
180508|Banjar Agung
327901|Banjar
360120|Banjar
510804|Banjar
630807|Banjang
340212|Banguntapan
180202|Bangun Rejo
120709|Bangun Purba
140610|Bangun Purba
332008|Bangsri
350909|Bangsalsari
351610|Bangsal
351002|Bangorejo
321206|Bangodua
510602|Bangli
721104|Bangkurung
181311|Bangkunat (Bengkunat)
140710|Bangko Pusako / Pusaka
150210|Bangko Barat
140702|Bangko
150202|Bangko
140101|Bangkinang Kota
140115|Bangkinang
732617|Bangkelekila
352601|Bangkalan
730406|Bangkala Barat
730401|Bangkala
352303|Bangilan
351414|Bangil
721102|Banggai Utara
721107|Banggai Tengah
721106|Banggai Selatan
721101|Banggai
760508|Banggae Timur
760501|Banggae
170910|Bang Haji
332220|Bandungan
327309|Bandung Wetan
327315|Bandung Kulon
327321|Bandung Kidul
360434|Bandung
350417|Bandung
330814|Bandongan
160903|Banding Agung
351718|Bandarkedungmulyo (Bandar Kedung Mulyo)
180226|Bandar Surabaya
180715|Bandar Sribhawono (Bandar Sribawono)
140511|Bandar Sei Kijang
111610|Bandar Pusaka
120915|Bandar Pulau
140512|Bandar Petalangan
120917|Bandar Pasir Mandoge
180423|Bandar Negeri Suoh
180625|Bandar Negeri Semuong
180218|Bandar Mataram
120824|Bandar Masilam
140314|Bandar Laksamana
121806|Bandar Khalipah / Khalifah
120822|Bandar Huluan
111804|Bandar Dua
111806|Bandar Baru
120823|Bandar
111704|Bandar
350108|Bandar
332502|Bandar
117302|Banda Sakti
117107|Banda Raya
111609|Banda Mulia
110826|Banda Baro
110315|Banda Alam
810109|Banda
352304|Bancar
332216|Bancak
720327|Banawa Tengah
720318|Banawa Selatan
720308|Banawa
621104|Banama Tingang
920914|Bamusbama
930313|Bamgi
110203|Bambel
340205|Bambanglipuro (Bambang Lipuro)
760311|Bambang
760101|Bambalamotu
760110|Bambaira
732610|Balusu
731107|Balusu
350910|Balung
352502|Balongpanggang (Balong Panggang)
351512|Balongbendo
321214|Balongan
350211|Balong
731005|Balocci
760312|Balla
720815|Balinggi
950726|Balingga Barat
950707|Balingga
647103|Balikpapan Utara
647101|Balikpapan Timur
647104|Balikpapan Tengah
647105|Balikpapan Selatan
647106|Balikpapan Kota
610312|Balai
720331|Balaesang Tanjung
720312|Balaesang
210413|Bakung Serumpun
350505|Bakung
630410|Bakumpai
110819|Baktiya Barat
110801|Baktiya
121603|Baktiraja (Bakti Raja)
110115|Bakongan Timur
110101|Bakongan
331110|Baki
180121|Bakauheni
630507|Bakarangan
190106|Bakam
647102|Balikpapan Barat
180404|Balik Bukit
121201|Balige
351910|Balerejo
352213|Balen
320432|Baleendah
360301|Balaraja
332804|Balapulang
720119|Balantak Utara
720118|Balantak Selatan
720106|Balantak
760412|Balanipa
620803|Balai Riam
140718|Balai Jaya
630110|Bajuin
150407|Bajubang
731720|Bajo Barat
731704|Bajo
127604|Bajenis
730618|Bajeng Barat
730602|Bajeng
530915|Bajawa Utara
530906|Bajawa
110620|Baitussalam
117101|Baiturrahman
740520|Baito
180805|Bahuga
120501|Bahorok
720610|Bahodopi
650211|Bahau Hulu
150509|Bahar Utara
820421|Bacan Timur Selatan
820407|Bacan Timur
820417|Bacan Selatan
820414|Bacan Barat Utara
820409|Bacan Barat
820408|Bacan
110204|Babussalam
640903|Babulu
110211|Babul Rahmah
110206|Babul Makmur
920603|Babo
630802|Babirik
321602|Babelan
160606|Babat Toman
160614|Babat Supat
150510|Bahar Selatan
920144|Bagun
817103|Baguala
351814|Bagor
330604|Bagelen
140705|Bagansinembah (Bagan Sinembah)
140717|Bagan Sinembah Raya
732214|Baebunta Selatan
732211|Baebunta
331907|Bae
120115|Badiri
350213|Badegan
190205|Badau
610614|Badau
350626|Badas
110205|Badar
737204|Bacukiki Barat
737201|Bacukiki
820422|Bacan Timur Tengah
352405|Babat
810804|Babar Barat (Pulau Pulau Babar)
120514|Babalan
321412|Babakancikao
320105|Babakan Madang
327303|Babakan Ciparay
320905|Babakan
111206|Babah Rot
350216|Babadan
620205|Baamang
950722|Ayumnati
930418|Ayip
920524|Ayau
921019|Ayamaru Utara Timur
921009|Ayamaru Utara
921018|Ayamaru Timur Selatan
921010|Ayamaru Timur
921020|Ayamaru Tengah
921017|Ayamaru Selatan Jaya
921015|Ayamaru Selatan
921016|Ayamaru Jaya
921021|Ayamaru Barat
921008|Ayamaru
330501|Ayah
930422|Awyu
950218|Awinbon
950721|Awina
950442|Aweku
940322|Aweida
631103|Awayan
730816|Awangpone
621304|Awang
732621|Awan Rante Karua
137503|Aur Birugo Tigo Baleh
110418|Atu Lintang
930402|Atsj (Atsy)
750501|Atinggola
530422|Atambua Selatan
530421|Atambua Barat
531302|Atadei
930421|Aswi
320910|Astanajapura
327310|Astana Anyar
630307|Astambul
930306|Assue
750121|Asparaga
950136|Asotipo
950109|Asolokobal
950103|Asologaima
740231|Asinua
920915|Ases
740901|Asera
351213|Asembagus
357828|Asem Rowo (Asemrowo)
131010|Asam Jujuhan
527203|Asakota
620104|Arut Utara
620102|Arut Selatan
730409|Arungkeke
810705|Aru Utara Timur Batuley
810704|Aru Utara
810707|Aru Tengah Timur
810708|Aru Tengah Selatan
810703|Aru Tengah
810710|Aru Selatan Utara
810709|Aru Selatan Timur
810702|Aru Selatan
911106|Arso Timur
911108|Arso Barat
911102|Arso
120314|Arse
352605|Arosbaya
110507|Arongan Lambalek
920616|Aroba
170321|Arma Jaya
350106|Arjosari
320924|Arjawinangun
320416|Arjasari
352924|Arjasa
351211|Arjasa
350922|Arjasa
930209|Arimop
920313|Arguni
337303|Argomulyo
321005|Argapura
327324|Arcamanik
630311|Aranio
920604|Aranday
121415|Aramo
760302|Aralle
321219|Arahan
940303|Aradide
911009|Apawer Hulu
950602|Apalapsili
360430|Anyar
327320|Antapani (Cicadas)
620210|Antang Kalang
760413|Anreapi
910515|Anotaurei
610216|Anjongan
630403|Anjir Pasar
630404|Anjir Muara
321223|Anjatan
930113|Animha
360107|Angsana
631009|Angsana
732405|Angkona
120303|Angkola Timur
120306|Angkola Selatan
120331|Angkola Sangkunur
120332|Angkola Muara Tais
120301|Angkola Barat
630604|Angkinang
910504|Angkaisera
950302|Anggruk
750503|Anggrek
921202|Anggi Gida
921201|Anggi
731604|Anggeraja
640204|Anggana
740240|Anggalomoare
740224|Anggaberi
740502|Angata
740909|Andowia
740525|Andoolo Barat
740503|Andoolo
330916|Andong
327305|Andir
910614|Andey
120112|Andam Dewi
950436|Anawi
180221|Anak Tuha
180227|Anak Ratu Aji
710518|Amurang Timur
710517|Amurang Barat
710510|Amurang
630806|Amuntai Utara
630805|Amuntai Tengah
630804|Amuntai Selatan
940523|Amungkalpia
950311|Amuma
720802|Ampibabo
527101|Ampenan
332711|Ampelgading
350706|Ampelgading
330902|Ampel
130613|Ampek Nagari (IV Nagari )
130607|Ampek Angkek (IV Angkat Candung)
720904|Ampana Tete
720905|Ampana Kota
740228|Amonggedo
530113|Amfoang Utara
530126|Amfoang Timur
530130|Amfoang Tengah
530112|Amfoang Selatan
530122|Amfoang Barat Laut
530121|Amfoang Barat Daya
170710|Amen
352912|Ambunten
350912|Ambulu
920927|Amberbaken Barat
920910|Amberbaken
530209|Amanatun Utara
530208|Amanatun Selatan
730824|Amali
810605|Amalatu
810101|Amahai
530120|Amabi Oefeto Timur
530125|Amabi Oefeto
630301|Aluh Aluh
530508|Alor Timur Laut
530505|Alor Timur
530507|Alor Tengah Utara
530504|Alor Selatan
530502|Alor Barat Laut
530503|Alor Barat Daya
530715|Alok Timur
530714|Alok Barat
530705|Alok
760415|Allu (Alu)
731605|Alla
930211|Ambatkwi (Ambatkui)
181003|Ambarawa
332210|Ambarawa
520610|Ambalawi
610515|Ambalau
810903|Ambalau
330507|Ambal
530119|Amarasi Timur
530118|Amarasi Selatan
530117|Amarasi Barat
530109|Amarasi
940417|Amar
530204|Amanuban Timur
530205|Amanuban Tengah
530206|Amanuban Selatan
530207|Amanuban Barat
121407|Amandraya
330511|Alian (Aliyan)
950211|Alemsom
122406|Alasa Talumuzoi
122407|Alasa
520417|Alas Barat
520405|Alas
167115|Alang Alang Lebar
950815|Alama
940418|Alama
157109|Alam Barajo
630405|Alalak
537101|Alak
110908|Alafan (Alapan)
930404|Akat
130713|Akabiluru
350917|Ajung
121208|Ajibata
330214|Ajibarang
730818|Ajangale
921007|Aitinyo Utara
170108|Air Nipis
170316|Air Napal
180626|Air Naningan
170613|Air Majunto
160719|Air Kumbang
120909|Air Joman
150307|Air Hitam
180419|Air Hitam
150111|Air Hangat Timur
150121|Air Hangat Barat
150105|Air Hangat
170614|Air Dikit
810402|Air Buaya (Airbuaya)
170315|Air Besi
610805|Air Besar
120913|Air Batu
530901|Aimere
921022|Aitinyo Tengah
921023|Aitinyo Raya
921005|Aitinyo Barat
921006|Aitinyo
910316|Airu
130113|Airpura
710603|Airmadidi
190303|Airgegas (Air Gegas)
950428|Airgaram
610421|Air Upas
160214|Air Sugihan
160714|Air Salek
170607|Air Rami
121903|Air Putih
170506|Air Periukan
170320|Air Padang
920107|Aimas
910619|Aimando Padaido
520309|Aikmel
921002|Aifat Utara
921012|Aifat Timur Tengah
921014|Aifat Timur Selatan
921013|Aifat Timur Jauh
921003|Aifat Timur
921004|Aifat Selatan
921001|Aifat
320322|Agrabinta
940705|Agisiga
940402|Agimuga
930401|Agats
940507|Agandugume
122409|Afulu
531607|Aesesa Selatan
531601|Aesesa
330103|Adipala
330515|Adimulyo
181007|Adiluwih (Adi Luwih)
120203|Adian Koting
180312|Abung Tinggi
180305|Abung Timur
180311|Abung Tengah
180314|Abung Surakarta
180313|Abung Semuli
180307|Abung Selatan
180319|Abung Pekurun
180322|Abung Kunang
180306|Abung Barat
920906|Abun
740210|Abuki
950208|Aboy
510303|Abiansemal
917103|Abepura
950603|Abenaho
747106|Abeli
510705|Abang
530518|Abad Selatan
161204|Abab
130515|2 x 11 Kayu Tanam
130504|2 x 11 Enam Lingkuang
717204|Aertembaga (Bitung Timur)
741110|Aere
120921|Aek Songsongan
122307|Aek Natas
122111|Aek Nabara Barumun
120932|Aek Ledong
122304|Aek Kuo
120918|Aek Kuasan
120322|Aek Bilah
530610|Adonara Timur
530618|Adonara Tengah
530608|Adonara Barat
530617|Adonara
332811|Adiwerna`;

export interface SeedRegion { kode: string; nama: string; tipe?: string }

function parseProv(s: string): SeedRegion[] {
  return s.split("\n").filter(Boolean).map((l) => { const [kode, nama] = l.split("|"); return { kode, nama }; });
}
function parseKab(s: string): SeedRegion[] {
  return s.split("\n").filter(Boolean).map((l) => { const [kode, tipe, nama] = l.split("|"); return { kode, nama, tipe }; });
}
function parseKec(s: string): SeedRegion[] {
  return s.split("\n").filter(Boolean).map((l) => { const [kode, nama] = l.split("|"); return { kode, nama }; });
}

export const SEED_PROVINSI: SeedRegion[] = parseProv(RAW_PROVINSI);
export const SEED_KABUPATEN: SeedRegion[] = parseKab(RAW_KABUPATEN);
export const SEED_KECAMATAN: SeedRegion[] = parseKec(RAW_KECAMATAN);
