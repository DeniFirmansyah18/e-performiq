#Requires -Version 5.1
<#
.SYNOPSIS
    Menyiapkan ClamAV untuk E-PerformIQ: konfigurasi, signature, dan mode pemindaian.

.DESCRIPTION
    Idempoten. Yang dilakukan:
      1. Memastikan ClamAV terpasang (clamscan + freshclam).
      2. Membuat direktori user-level (tidak butuh admin) untuk database, tmp, log.
      3. Menulis clamd.conf dan freshclam.conf.
      4. Mengunduh signature dengan freshclam.
      5. Bila unduhan gagal (mis. jaringan memblokir CDN ClamAV), memasang
         signature uji EICAR supaya jalur pemindaian tetap bisa diverifikasi,
         dengan peringatan eksplisit bahwa itu BUKAN perlindungan nyata.
      6. Mencetak nilai .env yang perlu diisi.

.PARAMETER Force
    Tulis ulang konfigurasi walau sudah ada.

.PARAMETER SkipUpdate
    Lewati freshclam (mis. saat offline); tetap menyiapkan direktori & konfigurasi.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\setup-clamav.ps1
#>
param(
    [switch]$Force,
    [switch]$SkipUpdate
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$base = Join-Path $env:LOCALAPPDATA 'epq-clamav'
$dbDir = Join-Path $base 'database'
$tmpDir = Join-Path $base 'tmp'

function Write-Step([string]$Message) { Write-Host "  $Message" }
function Write-Ok([string]$Message)   { Write-Host "  [ok]   $Message" -ForegroundColor Green }
function Write-Warn2([string]$Message) { Write-Host "  [warn] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message)  { Write-Host "  [err]  $Message" -ForegroundColor Red }

Write-Host "Menyiapkan ClamAV untuk E-PerformIQ`n"

# --------------------------------------------------------------- 1. biner
Write-Host "1. Pemeriksaan biner"
$clamscan = @(
    'C:\Program Files\ClamAV\clamscan.exe',
    (Join-Path $env:ProgramFiles 'ClamAV\clamscan.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$freshclam = @(
    'C:\Program Files\ClamAV\freshclam.exe',
    (Join-Path $env:ProgramFiles 'ClamAV\freshclam.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $clamscan) {
    Write-Err "clamscan.exe tidak ditemukan."
    Write-Step "Pasang ClamAV lebih dulu: winget install Cisco.ClamAV"
    exit 1
}
Write-Ok "clamscan: $clamscan"

if ($freshclam) { Write-Ok "freshclam: $freshclam" } else { Write-Warn2 "freshclam tidak ditemukan; signature harus disediakan manual." }

$version = (& $clamscan --version 2>&1 | Select-Object -First 1)
Write-Step "versi: $version"

# ------------------------------------------------------------ 2. direktori
Write-Host "`n2. Direktori user-level"
foreach ($dir in @($base, $dbDir, $tmpDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Step "dibuat: $dir"
    }
}
Write-Ok "database: $dbDir"
Write-Ok "tmp: $tmpDir"

# ----------------------------------------------------------- 3. konfigurasi
Write-Host "`n3. Konfigurasi"
$fwd = $base -replace '\\', '/'
$clamdConf = Join-Path $base 'clamd.conf'
$freshclamConf = Join-Path $base 'freshclam.conf'

$clamdBody = @"
# clamd untuk E-PerformIQ (user-level, tanpa admin)
# LocalSocket sengaja tidak dipakai: Windows memerlukan TCP.
DatabaseDirectory $fwd/database
TemporaryDirectory $fwd/tmp
TCPSocket 3310
TCPAddr 127.0.0.1
Foreground true
LogFile $fwd/clamd.log
LogTime yes
PidFile $fwd/clamd.pid
MaxFileSize 25M
MaxScanSize 100M
StreamMaxLength 25M
MaxThreads 4
"@

$freshclamBody = @"
# freshclam untuk E-PerformIQ (user-level)
DatabaseDirectory $fwd/database
UpdateLogFile $fwd/freshclam.log
DatabaseMirror database.clamav.net
Checks 1
"@

foreach ($pair in @(
    @{ Path = $clamdConf; Body = $clamdBody },
    @{ Path = $freshclamConf; Body = $freshclamBody }
)) {
    if ((Test-Path $pair.Path) -and -not $Force) {
        Write-Step "sudah ada (pakai -Force untuk menulis ulang): $($pair.Path)"
    } else {
        Set-Content -Path $pair.Path -Value $pair.Body -Encoding ASCII
        Write-Ok "ditulis: $($pair.Path)"
    }
}

# -------------------------------------------------------------- 4. signature
Write-Host "`n4. Signature"
$existing = @(Get-ChildItem $dbDir -File -ErrorAction SilentlyContinue |
              Where-Object { $_.Extension -in '.cvd', '.cld', '.hdb', '.hsb', '.ndb' })

$hasMain = @($existing | Where-Object { $_.Extension -in '.cvd', '.cld' }).Count -gt 0

if ($SkipUpdate) {
    Write-Warn2 "freshclam dilewati (-SkipUpdate)."
} elseif (-not $freshclam) {
    Write-Warn2 "freshclam tidak tersedia; tidak dapat mengunduh signature."
} elseif ($hasMain -and -not $Force) {
    Write-Ok "database utama sudah ada ($($existing.Count) berkas); unduhan dilewati."
} else {
    Write-Step "menjalankan freshclam (bisa memerlukan beberapa menit)…"
    $log = Join-Path $base 'freshclam.out.log'
    $proc = Start-Process -FilePath $freshclam -ArgumentList @("--config-file=$freshclamConf") `
        -NoNewWindow -Wait -PassThru -RedirectStandardOutput $log -RedirectStandardError "$base\freshclam.err.log"

    $hasMain = @(Get-ChildItem $dbDir -File -ErrorAction SilentlyContinue |
                 Where-Object { $_.Extension -in '.cvd', '.cld' }).Count -gt 0

    if ($proc.ExitCode -eq 0 -and $hasMain) {
        Write-Ok "signature terunduh."
    } else {
        Write-Warn2 "freshclam tidak berhasil (exit $($proc.ExitCode))."
        Write-Step "Log: $log"
        Write-Step "Penyebab umum: jaringan memblokir database.clamav.net (HTTP 403/410)."
    }
}

# Signature uji EICAR: cukup untuk memverifikasi jalur pemindaian, BUKAN proteksi.
$hasMain = @(Get-ChildItem $dbDir -File -ErrorAction SilentlyContinue |
             Where-Object { $_.Extension -in '.cvd', '.cld' }).Count -gt 0

if (-not $hasMain) {
    Write-Host ''
    Write-Warn2 "Tidak ada database utama. Memasang signature uji EICAR agar jalur pemindaian dapat diverifikasi."
    Write-Warn2 "INI BUKAN PERLINDUNGAN NYATA - hanya mendeteksi berkas uji standar antivirus."

    $eicarPath = Join-Path $base 'eicar.txt'
    $eicar = 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    [System.IO.File]::WriteAllText($eicarPath, $eicar, [System.Text.Encoding]::ASCII)

    $bytes = [System.IO.File]::ReadAllBytes($eicarPath)
    $md5 = [System.Security.Cryptography.MD5]::Create()
    try { $hash = ($md5.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '' }
    finally { $md5.Dispose() }

    # Format .hdb: MD5:Ukuran:Nama
    Set-Content -Path (Join-Path $dbDir 'eicar.hdb') -Value "$hash`:$($bytes.Length):Eicar-Test-Signature" -Encoding ASCII
    Write-Ok "signature uji dipasang: eicar.hdb (MD5 $hash)"
}

$sigCount = @(Get-ChildItem $dbDir -File -ErrorAction SilentlyContinue |
              Where-Object { $_.Extension -in '.cvd', '.cld', '.hdb', '.hsb', '.ndb' }).Count
Write-Ok "$sigCount berkas signature tersedia"

# ------------------------------------------------------ 5. verifikasi cepat
Write-Host "`n5. Verifikasi"
$probe = Join-Path $base 'eicar.txt'
if (Test-Path $probe) {
    $out = & $clamscan --database=$dbDir --no-summary $probe 2>&1 | Out-String
    if ($out -match 'FOUND') { Write-Ok "pemindaian mendeteksi berkas uji EICAR" }
    else { Write-Warn2 "pemindaian tidak mendeteksi EICAR; periksa database." }
} else {
    Write-Step "berkas uji tidak ada; verifikasi dilewati."
}

# ------------------------------------------------------------- 6. .env hint
Write-Host "`n6. Nilai untuk .env"
Write-Host @"
  CLAMAV_MODE=cli
  CLAMAV_CLI_PATH=$clamscan
  CLAMAV_DATABASE_DIR=$dbDir
  CLAMAV_TIMEOUT_MS=30000
  SOP_UPLOAD_REQUIRE_SCAN=0
"@ -ForegroundColor Cyan
Write-Step "Set SOP_UPLOAD_REQUIRE_SCAN=1 di produksi agar unggahan ditolak bila pemindai mati."

if ($hasMain) {
    Write-Host "`nClamAV siap dengan database lengkap." -ForegroundColor Green
} else {
    Write-Host "`nClamAV siap untuk UJI, belum untuk produksi (signature hanya EICAR)." -ForegroundColor Yellow
    Write-Host "Jalankan freshclam di jaringan yang mengizinkan database.clamav.net." -ForegroundColor Yellow
}
