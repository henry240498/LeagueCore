@echo off
rem Crea los accesos directos de LeagueCore en el Escritorio de ESTE equipo y verifica los requisitos
rem (Node.js, configuracion del backend, cloudflared). Ejecutar una vez por equipo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\crear-acceso-directo.ps1"
echo.
pause
