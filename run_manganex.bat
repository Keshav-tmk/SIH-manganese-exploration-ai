@echo off
title ManganEX Launcher

echo Starting ManganEX Backend...

start "ManganEX Backend" cmd /k "cd /d D:\Antigravity\sih mang\backend && call venv\Scripts\activate && python -m uvicorn app.main:app --reload"

timeout /t 3 /nobreak >nul

echo Starting ManganEX Frontend...

start "ManganEX Frontend" cmd /k "cd /d D:\Antigravity\sih mang\frontend && npm run dev"

timeout /t 5 /nobreak >nul

echo Opening ManganEX...

start http://localhost:5173

exit