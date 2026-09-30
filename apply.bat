@echo off
REM MuseBridge - terapkan balasan Muse (letakkan file ini di folder project)
REM Simpan dulu balasan Muse sebagai .musebridge\inbox.txt
cd /d "%~dp0"
python bridge.py apply
pause
