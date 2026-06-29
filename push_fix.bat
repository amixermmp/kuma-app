@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: persist form state + signature in localStorage, clear on submit success"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
