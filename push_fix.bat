@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: monthly contact alert in Job Tasks + bike menu status fix"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
