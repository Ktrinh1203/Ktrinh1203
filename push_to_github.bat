@echo off
setlocal
set "GIT=C:\Users\kissk\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"

echo =======================================================
echo   NeuroLink - Pushing source code to GitHub
echo   Target: https://github.com/Ktrinh1203/Ktrinh1203.git
echo =======================================================
echo.

"%GIT%" push -u origin main --force

echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Source code pushed to GitHub successfully!
) else (
    echo [ERROR] Push failed. If prompted, please authenticate via browser or Personal Access Token.
)
echo.
pause
