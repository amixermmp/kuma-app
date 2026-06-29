@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: repair page select and form type cleanup"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
