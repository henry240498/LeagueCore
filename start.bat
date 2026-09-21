@echo off
rem Levanta LeagueCore completo (API + Web + tunel de Cloudflare) sin ventanas de consola visibles
rem y abre el navegador. Funciona desde cualquier carpeta/equipo (usa la ubicacion de este archivo).
rem Logs si algo falla: logs\launcher.log, backend.log, frontend.log, tunnel.log
wscript.exe //B "%~dp0scripts\start-hidden.vbs" "%~dp0."
