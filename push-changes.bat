@echo off
cd /d "%~dp0"
echo ========================================
echo  Kuma App — Push to GitHub
echo ========================================
git config --global user.email "amixerversatile@gmail.com"
git config --global user.name "amixermmp"
git add -A
git commit -m "feat: add dashboard, bikes, rentals, customers pages with bottom nav"
git push origin main
echo.
echo ========================================
echo  DONE! Vercel จะ rebuild อัตโนมัติ
echo ========================================
pause
