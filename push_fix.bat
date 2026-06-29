@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: hotel-style booking — search by model, assign bike at send time"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
