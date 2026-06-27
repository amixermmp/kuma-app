@echo off
cd /d "%~dp0"
echo Fixing next.config and pushing to GitHub...
git config --global user.email "amixerversatile@gmail.com"
git config --global user.name "amixermmp"
git rm --cached next.config.ts 2>nul
del next.config.ts 2>nul
git add next.config.mjs
git add -A
git commit -m "fix: rename next.config.ts to next.config.mjs for Next.js 14 compatibility"
git push origin main
echo.
echo Done! Vercel will rebuild automatically.
pause
