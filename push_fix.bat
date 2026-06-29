@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: remove photo_url and location_note from repair insert (columns not in schema)"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
