@echo off
title Loto+Facil
cd /d "%~dp0"
echo Iniciando o Loto+Facil...
echo.
start "" http://localhost:8000/index.html
node server.js
pause
