@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: restore repair_shop and repair_cost on complete"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
