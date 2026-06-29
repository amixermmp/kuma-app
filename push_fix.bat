@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: add title to repair insert (not null constraint)"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
