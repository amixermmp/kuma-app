@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: include repair costs in dashboard expenses"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
