# Panduan Operasional DepotPro

## 1. Cadangan data otomatis (gratis, GitHub Actions)
Workflow `.github/workflows/backup.yml` mengekspor seluruh database tiap hari pukul 00:00 WIB, mengenkripsinya
(AES-256) lalu menyimpannya di GitHub selama 30 hari.

Pengaturan satu kali di GitHub: **Settings > Secrets and variables > Actions > New repository secret**
| Nama | Isi |
|---|---|
| `MONGO_URL` | alamat koneksi MongoDB Atlas (lengkap dengan password) |
| `DB_NAME` | `gasgalon_erp` |
| `BACKUP_PASSPHRASE` | kata sandi panjang buatan sendiri untuk mengunci cadangan (SIMPAN di password manager!) |

Uji coba: tab **Actions > Cadangan MongoDB harian > Run workflow**. Hasil ada di bagian *Artifacts* halaman proses itu.
Catatan: GitHub menonaktifkan workflow terjadwal bila repositori tidak ada aktivitas 60 hari. Jalankan manual sesekali.

### Memulihkan
1. Unduh artifact `.json.gz.enc` dari tab Actions, lalu dekripsi:
   `openssl enc -d -aes-256-cbc -pbkdf2 -in backup-YYYYMMDD.json.gz.enc -out backup.json.gz` (diminta kata sandi)
2. Simulasi (tidak mengubah apa pun):
   `MONGO_URL="..." DB_NAME=gasgalon_erp python3 scripts/restore_mongo.py backup.json.gz`
3. Terapkan: tambahkan `--apply` di akhir perintah.

## 2. Server tidak tidur (UptimeRobot, gratis)
1. Daftar di uptimerobot.com, **Add New Monitor**.
2. Monitor Type: **HTTP(s)**. Friendly Name: `DepotPro`.
3. URL: `https://depotpro-backend.onrender.com/health`. Monitoring Interval: **5 minutes**.
4. Isi email untuk notifikasi bila server mati. Simpan.

## 3. Kunci tanda tangan aplikasi
- Cadangkan: `bash scripts/backup_keystore.sh` (menyalin ke `~/Documents/DepotPro-keystore-backup`; simpan juga di tempat kedua).
- Opsional, lebih aman: buat kunci rilis sendiri dengan `bash scripts/create_release_keystore.sh`, lalu cadangkan lagi.
  Berpindah kunci berarti aplikasi lama di HP di-uninstall sekali, lalu pasang ulang.
- Berkas `*.jks`, `*.keystore`, dan `keystore.properties` jangan pernah di-commit.

## 4. Akun staf
Menu **Akun** (khusus Pemilik) untuk menambah staf, mengganti peran, reset password, menonaktifkan akun.
Akun **Driver** harus dihubungkan ke data driver supaya driver hanya melihat tugasnya sendiri.

## 5. Setoran uang driver & wadah kosong
- **Wadah kosong** bertambah saat driver menandai pengiriman selesai dan mengisi jumlah galon/tabung yang kembali.
  Wadah dikreditkan ke produk di pesanan itu (apa pun kategorinya). Penjualan langsung di toko menambahnya otomatis.
- **Setoran uang:** uang tunai dari pengiriman dianggap di tangan driver sampai disetor. Driver membuka menu **Setoran** >
  *Setor Uang ke Toko*; kasir/pemilik menghitung uangnya lalu menekan **Terima** (selisih tercatat). Pemilik/kasir juga
  bisa memakai *Terima Tunai* bila driver menyerahkan uang langsung.
- **Tutup Kasir:** uang tunai pengiriman baru dihitung masuk laci saat setorannya diterima.
- **Gaji driver:** menu **Driver** > kartu driver > *Atur Gaji & Komisi* (khusus pemilik).

## 6. Gaji driver, koreksi, dan reset data
- **Gaji dibayar maksimal sekali per hari per driver.** Salah bayar? Menu Driver > kartu driver > *Riwayat Gaji* > *Batalkan*
  (hanya pembayaran terakhir): pengeluaran gaji dihapus dan hitungan komisi dikembalikan, lalu bisa dibayar ulang.
- **Setoran:** pemilik bisa *Ubah* (koreksi uang diterima) atau *Hapus* setoran. Pesanan yang sudah masuk setoran
  tidak bisa dibatalkan sebelum setorannya dihapus.
- **Tutup Kasir tidak 0?** Angka laci = penjualan tunai di toko + setoran driver diterima + piutang tunai - pengeluaran.
  Penjualan yang dibatalkan tidak dihitung, tetapi pengeluaran (termasuk "Gaji Driver"), setoran, dan pembayaran piutang yang
  masih tercatat tetap dihitung: hapus yang keliru di menu masing-masing. Catatan tutup kasir bisa dihapus (pemilik).
- **Mulai dari nol setelah masa uji:** menu Akun > *Zona Berbahaya* > *Reset Semua Data Transaksi* (ketik HAPUS SEMUA).
  Jalankan cadangan manual dulu (GitHub > Actions > Run workflow). Produk, stok, pelanggan, dan akun tidak dihapus.
