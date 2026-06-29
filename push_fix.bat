@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: docs page add missing pob/tax + route fix from job tasks"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
