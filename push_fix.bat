@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: routine job card links to specific routine by id"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
