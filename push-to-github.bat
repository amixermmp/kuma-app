@echo off
echo ========================================
echo  Kuma App — Push to GitHub
echo ========================================
cd /d "%~dp0"

echo.
echo [0/5] set git identity...
git config --global user.email "amixerversatile@gmail.com"
git config --global user.name "amixermmp"

echo.
echo [1/5] git init...
git init

echo.
echo [2/5] git add all files...
git add .

echo.
echo [3/5] git commit...
git commit -m "feat: initial Next.js + Supabase setup"

echo.
echo [4/5] set branch to main...
git branch -M main

echo.
echo [5/5] push to GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/amixermmp/kuma-app.git
git push -u origin main

echo.
echo ========================================
echo  DONE! ดู repo ได้ที่:
echo  https://github.com/amixermmp/kuma-app
echo ========================================
pause
