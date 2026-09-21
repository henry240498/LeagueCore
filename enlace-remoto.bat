@echo off
rem Muestra (y copia al portapapeles) el enlace publico del tunel de Cloudflare de LeagueCore.
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\mostrar-enlace.ps1"
