@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================================
echo   NeuroLink Unified Mega-Server Launcher
echo   Postgres (:5432) + qEEG (:8001) + Express (:4000) + Node-RED IoT (:1880) + UI (:5173)
echo ========================================================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    python start_unified_server.py %*
    goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 start_unified_server.py %*
    goto :done
)

echo [ERROR] Python 3 was not found in PATH. Please install Python 3.10+ or run "npm run dev".
pause
exit /b 1

:done
if %errorlevel% neq 0 (
    echo.
    echo [EXIT] Launcher terminated with exit code %errorlevel%.
    pause
)
endlocal
