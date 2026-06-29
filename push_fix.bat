@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: unified send car form with live price calculator, student promo, lock choice"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
