@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================================
echo   NeuroLink Unified Mega-Server Launcher
echo   Postgres (:5432) + qEEG (:8001) + Express (:4000) + Node-RED (:1880)
echo   [Tu dong tao link Public Internet qua Cloudflare Tunnel cho ban be]
echo ========================================================================
echo.

set "PY_CMD="
if exist "qeeg_service\.venv\Scripts\python.exe" (
    "qeeg_service\.venv\Scripts\python.exe" -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul && set "PY_CMD=qeeg_service\.venv\Scripts\python.exe"
)
if not defined PY_CMD if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul && set "PY_CMD=.venv\Scripts\python.exe"
)
if not defined PY_CMD (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul && set "PY_CMD=python"
)
if not defined PY_CMD (
    py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul && set "PY_CMD=py -3"
)

if defined PY_CMD (
    %PY_CMD% start_unified_server.py %*
    goto :done
)

set "HAS_PREFLIGHT=0"
set "HAS_TUNNEL=0"
for %%A in (%*) do (
    if /i "%%~A"=="--preflight" set "HAS_PREFLIGHT=1"
    if /i "%%~A"=="--tunnel" set "HAS_TUNNEL=1"
)
if "%HAS_PREFLIGHT%"=="1" goto :node_preflight
if "%HAS_TUNNEL%"=="1" (
    echo [ERROR] Tuy chon --tunnel can Python 3.10+ hoac chay truc tiep share_public.bat.
    pause
    endlocal & exit /b 1
)

echo [INFO] Khong tim thay Python 3.10+ - su dung che do du phong Node.js
echo        (He thong su dung san bo xu ly qEEG TypeScript tich hop).
echo.

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Khong tim thay Node.js / npm trong PATH. Vui long cai Node.js 20+.
    pause
    endlocal & exit /b 1
)

node -e "const n=require('net');const chk=(p)=>new Promise(r=>{const s=n.connect(p,'127.0.0.1');s.setTimeout(600);s.on('connect',()=>{s.destroy();r(true);});s.on('timeout',()=>{s.destroy();r(false);});s.on('error',()=>r(false));});Promise.all([chk(4000),chk(5173),chk(5174)]).then(([a,w,m])=>{if(a&&w){process.exit(m?11:10);}process.exit(0);});"
set "PORT_STATE=%errorlevel%"

if "%PORT_STATE%"=="10" goto :already_running_web
if "%PORT_STATE%"=="11" goto :already_running_all

echo [INFO] Dang khoi dong he sinh thai NeuroLink:
echo        Postgres (:5432) + Express API (:4000) + Web (:5173) + Mobile (:5174)
echo.
call npm run dev:all
goto :done

:already_running_web
echo [OK] NeuroLink dang chay san!
echo      Web App : http://localhost:5173
echo      API     : http://localhost:4000/api/health
echo.
set "OPEN_UI="
set /p "OPEN_UI=Mo trinh duyet http://localhost:5173 ngay? [y/N]: "
if /i "%OPEN_UI%"=="y" start "" "http://localhost:5173"
pause
endlocal & exit /b 0

:already_running_all
echo [OK] NeuroLink dang chay san!
echo      Web App : http://localhost:5173
echo      Mobile  : http://localhost:5174
echo      API     : http://localhost:4000/api/health
echo.
set "OPEN_UI="
set /p "OPEN_UI=Mo trinh duyet http://localhost:5173 ngay? [y/N]: "
if /i "%OPEN_UI%"=="y" start "" "http://localhost:5173"
pause
endlocal & exit /b 0

:node_preflight
echo [preflight] Mode            : Node.js fallback (Python 3.10+ not installed)
echo [preflight] Root dir        : %CD%
where node >nul 2>nul && (for /f "delims=" %%v in ('node -v') do echo [preflight] Node.js         : %%v) || echo [preflight] Node.js         : MISSING
where npm >nul 2>nul && (for /f "delims=" %%v in ('call npm -v') do echo [preflight] npm             : %%v) || echo [preflight] npm             : MISSING
if exist "server\.env" (echo [preflight] server/.env     : True) else (echo [preflight] server/.env     : False)
node -e "const n=require('net');const chk=(p)=>new Promise(r=>{const s=n.connect(p,'127.0.0.1');s.setTimeout(500);s.on('connect',()=>{s.destroy();r('OPEN');});s.on('timeout',()=>{s.destroy();r('CLOSED');});s.on('error',()=>r('CLOSED'));});Promise.all([5432,4000,5173,5174,8001,1880].map(async p=>console.log('[preflight] Port :'+String(p).padEnd(9)+': '+await chk(p))));"
endlocal & exit /b 0

:done
set "EXIT_CODE=%errorlevel%"
if not "%EXIT_CODE%"=="0" (
    echo.
    echo [EXIT] Launcher terminated with exit code %EXIT_CODE%.
    pause
)
endlocal & exit /b %EXIT_CODE%
