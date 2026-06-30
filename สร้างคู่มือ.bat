@echo off
chcp 65001 > nul
echo.
echo ===================================================
echo  สร้างคู่มือการใช้งาน Kuma App (Staff Manual)
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/2] ติดตั้ง docx library...
call npm install docx --no-fund --no-audit --prefer-offline 2>nul || npm install docx --no-fund --no-audit

echo.
echo [2/2] กำลังสร้างไฟล์ .docx...
node make_manual.js

echo.
if exist "คู่มือการใช้งาน_Kuma_Staff.docx" (
    echo ✅ สำเร็จ! เปิดไฟล์อัตโนมัติ...
    start "" "คู่มือการใช้งาน_Kuma_Staff.docx"
) else (
    echo ❌ ไม่พบไฟล์ที่สร้าง — ดู error ข้างบน
)
pause
