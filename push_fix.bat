@echo off
cd /d "C:\Users\Thugcom\Desktop\Kuma App"
git add -A
git commit -m "fix: public contract page, contract button on success, monthly branch_id, middleware /contract public"
git push
echo.
echo === Push done! Now run: vercel --prod ===
pause
