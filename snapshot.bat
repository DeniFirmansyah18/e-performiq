@echo off
REM MuseBridge - buat snapshot project (letakkan file ini di folder project)
cd /d "%~dp0"
python bridge.py snapshot
pause
