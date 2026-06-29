@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: exclude monthly rentals from search results, persist form+signature in localStorage"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
