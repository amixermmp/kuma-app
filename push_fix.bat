@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: apply pricing formula + student promo to booking form"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
