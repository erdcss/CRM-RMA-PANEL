@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Caliskan B2B - iOS Live Development
echo.
echo ==========================================
echo   CALISKAN B2B - iOS CANLI GELISTIRME
echo ==========================================
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo [HATA] Git bulunamadi. https://git-scm.com/download/win adresinden kurun.
  goto :failed
)
where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi. Node.js 22 LTS surumunu kurun.
  goto :failed
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [HATA] npm bulunamadi. Node.js kurulumunu kontrol edin.
  goto :failed
)
if not exist "mobile\package.json" (
  echo [HATA] Bu dosyayi CRM-RMA-PANEL klasorunun icinden calistirin.
  goto :failed
)
if not exist ".git" (
  echo [UYARI] GitHub otomatik guncelleme icin projeyi git clone ile indirin.
  echo [UYARI] ZIP indirdiyseniz degisiklikleri otomatik cekemezsiniz.
)
if not exist "mobile\node_modules\expo\package.json" (
  echo [1/2] Ilk kurulum: mobile npm paketleri yukleniyor...
  pushd "mobile"
  call npm ci
  if errorlevel 1 (
    popd
    echo [HATA] npm ci basarisiz. Yukaridaki hatayi kontrol edin.
    goto :failed
  )
  popd
)
echo [2/2] Expo tunnel baslatiliyor...
echo iPhone'da yuklu DEVELOPMENT CLIENT ile terminaldeki QR kodu acin.
echo TestFlight / App Store surumu Metro gelistirme sunucusuna baglanamaz.
echo.
set "EXPO_PUBLIC_API_URL=https://b2b.ecalisgan.com"
set "EXPO_PUBLIC_BRANDING_API_URL=https://admin.ecalisgan.com"
pushd "mobile"
call npm run dev:live:tunnel
set "EXITCODE=%ERRORLEVEL%"
popd
echo.
echo Expo kapandi (cikis kodu: %EXITCODE%).
pause
exit /b %EXITCODE%
:failed
echo.
pause
exit /b 1
