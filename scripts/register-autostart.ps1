#Requires -Version 5.1
<#
.SYNOPSIS
    Mendaftarkan/melepas autostart layanan lokal E-PerformIQ (S3 + ClamAV).

.DESCRIPTION
    Membuat Scheduled Task yang berjalan SAAT LOGON untuk user saat ini, tanpa
    hak administrator dan tanpa menyimpan kata sandi (LogonType Interactive).

    Tugas ini menjalankan `scripts\dev-services.ps1 start`, yang idempoten:
    bila layanan sudah hidup, ia tidak menyalakan proses kedua.

.PARAMETER Action
    register | unregister | status

.PARAMETER TaskName
    Nama tugas (default: EPerformIQ-LocalServices).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\register-autostart.ps1 register

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\register-autostart.ps1 status
#>
param(
    [ValidateSet('register', 'unregister', 'status')]
    [string]$Action = 'status',
    [string]$TaskName = 'EPerformIQ-LocalServices'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$servicesScript = Join-Path $PSScriptRoot 'dev-services.ps1'

function Write-Step([string]$Message) { Write-Host "  $Message" }
function Write-Ok([string]$Message)   { Write-Host "  [ok]   $Message" -ForegroundColor Green }
function Write-Warn2([string]$Message) { Write-Host "  [warn] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message)  { Write-Host "  [err]  $Message" -ForegroundColor Red }

function Get-Task {
    Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}

switch ($Action) {
    'register' {
        Write-Host "Mendaftarkan autostart: $TaskName`n"

        if (-not (Test-Path $servicesScript)) {
            Write-Err "dev-services.ps1 tidak ditemukan di $servicesScript"
            exit 1
        }

        $powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$servicesScript`" start"

        $taskAction = New-ScheduledTaskAction -Execute $powershellExe -Argument $arguments -WorkingDirectory $repoRoot
        $taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
        $taskSettings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
            -MultipleInstances IgnoreNew

        # LogonType Interactive: tidak menyimpan kata sandi, hanya jalan saat user login.
        $taskPrincipal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

        try {
            if (Get-Task) {
                Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
                Write-Step "tugas lama dihapus"
            }
            Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger `
                -Settings $taskSettings -Principal $taskPrincipal `
                -Description 'Menyalakan gateway S3 (SeaweedFS) dan memverifikasi ClamAV untuk E-PerformIQ.' | Out-Null
            Write-Ok "tugas terdaftar: $TaskName"
        } catch {
            Write-Err "gagal mendaftarkan tugas: $($_.Exception.Message)"
            Write-Step "Bila kebijakan mesin melarang Scheduled Task, jalankan manual tiap sesi:"
            Write-Step "  powershell -ExecutionPolicy Bypass -File scripts\dev-services.ps1 start"
            exit 1
        }

        Write-Host "`nTugas akan berjalan saat Anda logon berikutnya." -ForegroundColor Green
        Write-Step "Uji sekarang tanpa logout: schtasks /run /tn `"$TaskName`""
        Write-Step "Lihat hasil: powershell -ExecutionPolicy Bypass -File scripts\dev-services.ps1 status"
    }

    'unregister' {
        Write-Host "Melepas autostart: $TaskName`n"
        if (-not (Get-Task)) {
            Write-Ok "tugas tidak terdaftar (tidak ada yang perlu dilepas)"
            exit 0
        }
        try {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-Ok "tugas dilepas"
        } catch {
            Write-Err "gagal melepas tugas: $($_.Exception.Message)"
            exit 1
        }
    }

    'status' {
        Write-Host "Status autostart: $TaskName`n"
        $task = Get-Task
        if (-not $task) {
            Write-Warn2 "belum terdaftar"
            Write-Step "Daftarkan: powershell -ExecutionPolicy Bypass -File scripts\register-autostart.ps1 register"
            exit 1
        }

        $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
        Write-Ok "terdaftar"
        Write-Step "state      : $($task.State)"
        Write-Step "terakhir   : $($info.LastRunTime)"
        Write-Step "hasil      : $($info.LastTaskResult)"
        Write-Step "berikutnya : $($info.NextRunTime)"
        exit 0
    }
}
