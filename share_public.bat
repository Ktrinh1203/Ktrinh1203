@echo off
title NeuroLink Public Tunnel
cd /d "%~dp0"

echo ========================================================================
echo   NeuroLink Public Tunnel Launcher
echo   Tao duong dan cong khai cho ban be truy cap tu nha khac qua Internet
echo ========================================================================
echo.
echo [1] Dam bao ban da chay start.bat o mot cua so khac.
echo [2] Khoi tao duong dan de nho: https://neurolink-eeg.loca.lt
echo.
echo * Luu y: Neu trinh duyet ban be hoi "Tunnel Password", nhap dia chi IP:
echo   14.245.243.143 (hoac xem tai https://loca.lt/mytunnelpassword)
echo ========================================================================
echo.

npx --yes localtunnel --port 5173 --subdomain neurolink-eeg
pause
