@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: repair complete only updates status (missing columns in table)"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
