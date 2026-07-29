@echo off
title Loto+Facil - Atualizar concursos
cd /d "%~dp0"
echo Buscando concursos novos (Lotofacil, Mega-Sena, Quina)...
echo.
node scripts\atualizar.js
echo.
pause
