@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: repair insert use only existing columns, fix status in_progress"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
