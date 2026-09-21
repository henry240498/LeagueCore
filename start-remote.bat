@echo off
rem Levanta LeagueCore (API + Web) y crea un tunel de Cloudflare para acceso remoto.
rem La URL publica (https://XXXX.trycloudflare.com) aparece en esta ventana.
rem Cerra la ventana o Ctrl+C para bajar el tunel. Usa stop.bat para apagar API + Web.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-remote.ps1" "%~dp0"
pause
