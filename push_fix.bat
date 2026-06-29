@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "feat: add repair history to bike detail page"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
