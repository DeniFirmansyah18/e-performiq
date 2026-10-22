#Requires -Version 5.1
<#
.SYNOPSIS
    Menyalakan/menghentikan layanan lokal untuk E-PerformIQ: gateway S3 dan ClamAV.

.DESCRIPTION
    Idempoten: aman dijalankan berulang. Perintah `start` tidak menyalakan proses
    kedua bila port sudah melayani, dan `stop` tidak gagal bila layanan sudah mati.

    Layanan yang dikelola:
      S3       SeaweedFS (`weed server -s3`) â€” object storage untuk berkas SOP.
      ClamAV   Dua mode sesuai .env:
                 CLAMAV_MODE=cli    -> tidak ada daemon; cukup verifikasi clamscan + signature.
                 CLAMAV_MODE=daemon -> pastikan clamd mendengarkan di CLAMAV_HOST:CLAMAV_PORT.

.PARAMETER Action
    start | stop | status | restart

.PARAMETER WaitSeconds
    Batas tunggu kesiapan layanan (default 60 detik).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\dev-services.ps1 start

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\dev-services.ps1 status
#>
param(
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action = 'status',
    [int]$WaitSeconds = 60
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$libPath = Join-Path $PSScriptRoot 'services-lib.mjs'

function Write-Step([string]$Message) { Write-Host "  $Message" }
function Write-Ok([string]$Message)   { Write-Host "  [ok]   $Message" -ForegroundColor Green }
function Write-Warn2([string]$Message) { Write-Host "  [warn] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message)  { Write-Host "  [fail] $Message" -ForegroundColor Red }

function Invoke-Lib([string]$Expression) {
    # Memanggil helper di services-lib.mjs dan mengembalikan objek PowerShell.
    $json = & node --input-type=module -e "import * as lib from 'file:///$($libPath -replace '\\','/')'; const out = $Expression; console.log(JSON.stringify(out));"
    if ($LASTEXITCODE -ne 0) { throw "Gagal memanggil services-lib: $Expression" }
    return $json | ConvertFrom-Json
}

# ---------------------------------------------------------------- konfigurasi
function Get-Config {
    # Konfigurasi dibaca oleh Node (bukan PowerShell) agar nilai rahasia tidak
    # pernah melewati command line atau tercetak di pesan error.
    $json = & node $libPath --config
    if ($LASTEXITCODE -ne 0 -or -not $json) { throw "Gagal membaca konfigurasi layanan dari .env" }
    $cfg = $json | ConvertFrom-Json

    return [pscustomobject]@{
        Storage = $cfg.storage
        Clamav  = $cfg.clamav
        DataDir = [string]$cfg.dataDir
        S3Port  = [int]$cfg.storage.port
        S3Host  = [string]$cfg.storage.host
    }
}

function Test-Port([string]$Host_, [int]$Port, [int]$TimeoutMs = 1000) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync($Host_, $Port)
        if (-not $task.Wait($TimeoutMs)) { return $false }
        return $client.Connected
    } catch { return $false } finally { $client.Dispose() }
}

function Find-WeedBinary {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'epq-tools\seaweed\weed.exe'),
        (Join-Path $repoRoot '.tools\seaweed\weed.exe')
    )
    $cmd = Get-Command weed -ErrorAction SilentlyContinue
    if ($cmd) { $candidates = @($cmd.Source) + $candidates }
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

function Get-WeedProcess {
    Get-CimInstance Win32_Process -Filter "Name = 'weed.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match '\-s3' }
}

# ---------------------------------------------------------------------- S3
function Start-S3($cfg) {
    Write-Host "S3 (SeaweedFS)"
    $port = $cfg.S3Port
    $host_ = $cfg.S3Host

    if (Test-Port $host_ $port) {
        Write-Ok "sudah melayani di ${host_}:$port (tidak menyalakan proses baru)"
        Ensure-Bucket $cfg
        return $true
    }

    $weed = Find-WeedBinary
    if (-not $weed) {
        Write-Err "weed.exe tidak ditemukan."
        Write-Step "Pasang dengan salah satu cara:"
        Write-Step "  winget install MinIO.Server   (atau)"
        Write-Step "  gh release download 4.48 --repo seaweedfs/seaweedfs --pattern windows_amd64.zip --dir `"$env:LOCALAPPDATA\epq-tools`""
        Write-Step "lalu ekstrak agar weed.exe berada di $env:LOCALAPPDATA\epq-tools\seaweed\weed.exe"
        return $false
    }

    if (-not (Test-Path $cfg.DataDir)) {
        New-Item -ItemType Directory -Force -Path $cfg.DataDir | Out-Null
        Write-Step "membuat direktori data: $($cfg.DataDir)"
    }

    $logDir = Split-Path -Parent $cfg.DataDir

    # Argumen dibangun oleh helper yang diuji (services-lib.mjs), bukan
    # diduplikasi di sini; hanya path/port/host yang lewat, tanpa rahasia.
    $weedArgsJson = & node $libPath --weed-args
    if ($LASTEXITCODE -ne 0 -or -not $weedArgsJson) { throw "Gagal menyusun argumen weed dari services-lib.mjs" }
    # ConvertFrom-Json di PowerShell 5.1 mengembalikan array sebagai SATU objek,
    # jadi dienumerasi manual agar argumen tidak menjadi "System.Object[]".
    $weedArgs = @()
    foreach ($a in ($weedArgsJson | ConvertFrom-Json)) { $weedArgs += [string]$a }

    # WMI Create: proses benar-benar terlepas dari shell pemanggil. Tanpa ini,
    # `npm run services:start` menggantung karena proses anak menahan handle
    # stdout induknya.
    $outLog = Join-Path $logDir 's3.out.log'
    $errLog = Join-Path $logDir 's3.err.log'
    $commandLine = 'cmd.exe /c ""{0}" {1} > "{2}" 2> "{3}""' -f $weed, ($weedArgs -join ' '), $outLog, $errLog

    $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine      = $commandLine
        CurrentDirectory = $logDir
    }
    if ($created.ReturnValue -ne 0) {
        Write-Err "gagal menjalankan weed (Win32_Process.Create return $($created.ReturnValue))"
        return $false
    }
    Write-Step "menjalankan: weed $($weedArgs -join ' ') (PID $($created.ProcessId))"

    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $host_ $port 300) {
            Write-Ok "melayani di ${host_}:$port"
            Ensure-Bucket $cfg
            return $true
        }
        Start-Sleep -Milliseconds 400
    }

    Write-Err "tidak siap dalam $WaitSeconds detik. Periksa log: $errLog"
    return $false
}

function Ensure-Bucket($cfg) {
    if ($cfg.Storage.driver -ne 's3' -or -not $cfg.Storage.bucket) {
        Write-Warn2 "S3_BUCKET belum diisi; bucket tidak dibuat."
        return
    }
    $url = "$($cfg.Storage.endpoint)/$($cfg.Storage.bucket)"
    try {
        Invoke-WebRequest -Uri $url -Method PUT -UseBasicParsing -TimeoutSec 15 | Out-Null
        Write-Ok "bucket '$($cfg.Storage.bucket)' siap"
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        # 409 = bucket sudah ada. Idempoten: bukan kegagalan.
        if ($code -eq 409) {
            Write-Ok "bucket '$($cfg.Storage.bucket)' sudah ada"
        } else {
            Write-Warn2 "gagal memastikan bucket '$($cfg.Storage.bucket)': $($_.Exception.Message)"
        }
    }
}

function Stop-S3($cfg) {
    Write-Host "S3 (SeaweedFS)"
    $procs = Get-WeedProcess
    if (-not $procs) {
        Write-Ok "tidak ada proses weed yang berjalan"
        return $true
    }
    foreach ($p in $procs) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Write-Ok "proses weed PID $($p.ProcessId) dihentikan"
        } catch {
            Write-Warn2 "gagal menghentikan PID $($p.ProcessId): $($_.Exception.Message)"
        }
    }
    Start-Sleep -Milliseconds 800
    if (Test-Port $cfg.S3Host $cfg.S3Port 500) {
        Write-Warn2 "port $($cfg.S3Port) masih terbuka"
        return $false
    }
    return $true
}

# ------------------------------------------------------------------ ClamAV
function Start-Clamav($cfg) {
    Write-Host "ClamAV"
    $c = $cfg.Clamav

    if ($c.mode -eq 'cli') {
        if (-not $c.cliPath -or -not (Test-Path $c.cliPath)) {
            Write-Err "CLAMAV_MODE=cli tetapi clamscan tidak ditemukan ($($c.cliPath))."
            Write-Step "Pasang ClamAV: winget install Cisco.ClamAV"
            Write-Step "lalu jalankan: powershell -ExecutionPolicy Bypass -File scripts\setup-clamav.ps1"
            return $false
        }
        $version = (& $c.cliPath --version 2>&1 | Select-Object -First 1)
        Write-Ok "clamscan tersedia: $version"

        if (-not $c.databaseDir) {
            Write-Warn2 "CLAMAV_DATABASE_DIR kosong; clamscan akan memakai database bawaan."
        } elseif (-not (Test-Path $c.databaseDir)) {
            Write-Err "direktori signature tidak ada: $($c.databaseDir)"
            Write-Step "jalankan: powershell -ExecutionPolicy Bypass -File scripts\setup-clamav.ps1"
            return $false
        } else {
            $sig = @(Get-ChildItem $c.databaseDir -File -ErrorAction SilentlyContinue |
                     Where-Object { $_.Extension -in '.hdb', '.hsb', '.cvd', '.cld', '.ndb' })
            if ($sig.Count -eq 0) {
                Write-Err "tidak ada berkas signature di $($c.databaseDir)"
                Write-Step "jalankan: powershell -ExecutionPolicy Bypass -File scripts\setup-clamav.ps1"
                return $false
            }
            $real = @($sig | Where-Object { $_.Extension -in '.cvd', '.cld' })
            if ($real.Count -eq 0) {
                Write-Warn2 "$($sig.Count) berkas signature, tetapi tidak ada database utama (.cvd/.cld)."
                Write-Step "Pemindaian hanya mengenali signature uji; jalankan freshclam untuk database lengkap."
            } else {
                Write-Ok "$($sig.Count) berkas signature (termasuk database utama)"
            }
        }
        return $true
    }

    # mode daemon
    if (-not $c.daemonHost) {
        Write-Err "CLAMAV_MODE=daemon tetapi CLAMAV_HOST kosong."
        return $false
    }
    if (Test-Port $c.daemonHost $c.daemonPort) {
        Write-Ok "clamd sudah mendengarkan di $($c.daemonHost):$($c.daemonPort)"
        return $true
    }

    $clamd = @(
        'C:\Program Files\ClamAV\clamd.exe',
        (Join-Path $env:ProgramFiles 'ClamAV\clamd.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $clamd) {
        Write-Err "clamd.exe tidak ditemukan untuk mode daemon."
        return $false
    }

    $conf = Join-Path $env:LOCALAPPDATA 'epq-clamav\clamd.conf'
    if (-not (Test-Path $conf)) {
        Write-Err "clamd.conf tidak ada di $conf"
        Write-Step "jalankan: powershell -ExecutionPolicy Bypass -File scripts\setup-clamav.ps1"
        return $false
    }

    Start-Process -FilePath $clamd -ArgumentList @("--config-file=$conf") -WindowStyle Hidden | Out-Null
    Write-Step "menjalankan clamd"

    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $c.daemonHost $c.daemonPort 300) {
            Write-Ok "clamd mendengarkan di $($c.daemonHost):$($c.daemonPort)"
            return $true
        }
        Start-Sleep -Milliseconds 400
    }

    Write-Err "clamd tidak siap dalam $WaitSeconds detik."
    Write-Step "Di Windows, clamd umumnya memerlukan instalasi sebagai service (admin)."
    Write-Step "Alternatif tanpa admin: set CLAMAV_MODE=cli di .env."
    return $false
}

function Stop-Clamav($cfg) {
    Write-Host "ClamAV"
    if ($cfg.Clamav.mode -eq 'cli') {
        Write-Ok "mode cli: tidak ada daemon yang perlu dihentikan"
        return $true
    }
    $procs = Get-Process clamd -ErrorAction SilentlyContinue
    if (-not $procs) { Write-Ok "clamd tidak berjalan"; return $true }
    foreach ($p in $procs) {
        try { Stop-Process -Id $p.Id -Force -ErrorAction Stop; Write-Ok "clamd PID $($p.Id) dihentikan" }
        catch { Write-Warn2 "gagal menghentikan clamd PID $($p.Id)" }
    }
    return $true
}

# ------------------------------------------------------------------- status
function Show-Status($cfg) {
    Write-Host "Status layanan"
    $s3Up = Test-Port $cfg.S3Host $cfg.S3Port 500
    $line = if ($s3Up) { "UP      $($cfg.S3Host):$($cfg.S3Port)" } else { "DOWN    $($cfg.S3Host):$($cfg.S3Port)" }
    if ($s3Up) { Write-Ok "S3       $line" } else { Write-Warn2 "S3       $line" }

    if ($cfg.Storage.driver -eq 's3') {
        Write-Step "bucket   $($cfg.Storage.bucket) (driver s3)"
    } else {
        Write-Step "driver   lokal (S3 belum lengkap: $($cfg.Storage.missing -join ', '))"
    }

    $c = $cfg.Clamav
    if ($c.mode -eq 'cli') {
        $ok = $c.cliPath -and (Test-Path $c.cliPath)
        if ($ok) { Write-Ok "ClamAV   CLI siap ($($c.cliPath))" } else { Write-Warn2 "ClamAV   CLI belum siap" }
    } else {
        $up = $c.daemonHost -and (Test-Port $c.daemonHost $c.daemonPort 500)
        if ($up) { Write-Ok "ClamAV   daemon UP $($c.daemonHost):$($c.daemonPort)" }
        else { Write-Warn2 "ClamAV   daemon DOWN" }
    }
    Write-Step "wajib pindai: $(if ($c.requireScan) { 'ya (unggahan ditolak bila pemindai mati)' } else { 'tidak' })"

    return $s3Up
}

# --------------------------------------------------------------------- main
$cfg = Get-Config

switch ($Action) {
    'start' {
        Write-Host "Menyalakan layanan lokal E-PerformIQ`n"
        $s3 = Start-S3 $cfg
        $clam = Start-Clamav $cfg
        Write-Host ''
        Show-Status $cfg | Out-Null
        if (-not ($s3 -and $clam)) {
            Write-Host "`nSebagian layanan belum siap; lihat pesan di atas." -ForegroundColor Yellow
            exit 1
        }
        Write-Host "`nSemua layanan siap." -ForegroundColor Green
    }
    'stop' {
        Write-Host "Menghentikan layanan lokal E-PerformIQ`n"
        Stop-S3 $cfg | Out-Null
        Stop-Clamav $cfg | Out-Null
    }
    'restart' {
        & $PSCommandPath -Action stop -WaitSeconds $WaitSeconds | Out-Null
        Start-Sleep -Seconds 1
        & $PSCommandPath -Action start -WaitSeconds $WaitSeconds
    }
    'status' {
        Write-Host "Status layanan lokal E-PerformIQ`n"
        $up = Show-Status $cfg
        Write-Host ''
        if (-not $up) { exit 1 }
    }
}
