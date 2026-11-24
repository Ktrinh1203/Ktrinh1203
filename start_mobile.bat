@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================================
echo   NeuroLink Mobile Launcher (http://localhost:5174)
echo   Giao dien di dong toi gian · Emerald Identity · qEEG ^& VietQR
echo ========================================================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Khong tim thay Node.js / npm trong PATH. Vui long cai Node.js 20+.
    pause
    endlocal & exit /b 1
)

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5174' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not %errorlevel%==0 goto :check_api

echo [OK] NeuroLink Mobile dang chay san tai http://localhost:5174
start "" "http://localhost:5174"
endlocal & exit /b 0

:check_api
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4000/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not %errorlevel%==0 goto :start_all

echo [INFO] Phat hien API :4000 dang chay san - chi khoi dong Mobile :5174...
echo [INFO] Mo trinh duyet tai http://localhost:5174 sau khi khoi dong xong.
echo.
call npm run dev:mobile
goto :done

:start_all
echo [INFO] Dang khoi dong day du he sinh thai NeuroLink:
echo        Postgres :5432 + API :4000 + Web :5173 + Mobile :5174
echo.
call npm run dev:all

:done
set "EXIT_CODE=%errorlevel%"
if not "%EXIT_CODE%"=="0" (
    echo.
    echo [EXIT] Launcher da dung voi ma loi %EXIT_CODE%.
    pause
)
endlocal & exit /b %EXIT_CODE%
