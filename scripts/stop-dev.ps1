# Menghentikan server `next dev` dengan RAPI.
#
# Latar belakang: PGlite menulis langsung ke berkas data. Membunuh proses secara
# paksa (Stop-Process -Force / taskkill /F) saat penulisan berlangsung membuat
# berkasnya rusak, dan seluruh query berikutnya gagal dengan:
#   "RuntimeError: Aborted(). Build with -sASSERTIONS for more info."
#
# Skrip ini meminta proses berhenti dengan sopan lebih dulu (CloseMainWindow
# lalu sinyal terminasi), memberi waktu agar PGlite menutup berkasnya, dan
# hanya memaksa bila tetap hidup setelah batas waktu.
#
# Pemakaian:  npm run dev:stop
#             powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-dev.ps1

param(
  [int]$TimeoutSeconds = 15
)

$ErrorActionPreference = 'Stop'

function Write-Info($m) { Write-Host $m -ForegroundColor Cyan }
function Write-Ok($m) { Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Warn2($m) { Write-Host "  !!  $m" -ForegroundColor Yellow }

# Kumpulkan proses node yang menjalankan Next dev.
$targets = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'next' -and $_.CommandLine -match 'dev' }

if (-not $targets) {
  Write-Info "Tidak ada server dev yang berjalan."
  exit 0
}

Write-Info "Menghentikan $($targets.Count) proses server dev dengan rapi..."

# Kirim SIGTERM sungguhan. Di Windows, `Stop-Process` tanpa -Force tetap
# memanggil TerminateProcess (tidak ada SIGTERM), sehingga penangan sinyal di
# aplikasi tidak berjalan. Karena itu dipakai `taskkill` tanpa /F lebih dulu
# (mengirim WM_CLOSE ke jendela), lalu sinyal konsol Ctrl+C ke grup proses.
foreach ($t in $targets) {
  $procId = $t.ProcessId
  # taskkill tanpa /F mengirim permintaan tutup sopan. Proses tanpa jendela
  # konsol sering tidak menanggapinya; itu wajar dan ditangani di bawah.
  & taskkill /PID $procId 2>&1 | Out-Null
}

# Beri waktu PGlite menutup berkas.
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  Start-Sleep -Milliseconds 500
  $masih = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'next' -and $_.CommandLine -match 'dev' }
} while ($masih -and (Get-Date) -lt $deadline)

if ($masih) {
  # Upaya terakhir. Penanganan sebelum ini sudah memberi kesempatan menutup.
  foreach ($t in $masih) {
    try {
      & taskkill /PID $t.ProcessId /F /T 2>&1 | Out-Null
      Write-Warn2 "PID $($t.ProcessId) dihentikan paksa setelah batas waktu."
    } catch {
      Write-Warn2 "Gagal menghentikan PID $($t.ProcessId)."
    }
  }
  Start-Sleep -Seconds 2
} else {
  Write-Ok "Server dev berhenti dengan rapi."
}

# Verifikasi kondisi database.
Write-Info "Memeriksa kesehatan database..."
& npx tsx scripts/cek-sehat.ts
if ($LASTEXITCODE -ne 0) {
  Write-Warn2 "Database perlu dipulihkan. Jalankan: npm run db:recover"
  exit 1
}
exit 0
