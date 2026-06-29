@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: use Array.from(Set) for uniqueModels, TS target compatibility"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
