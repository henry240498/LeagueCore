@echo off
rem Apaga LeagueCore (API + Web + tunel de Cloudflare), liberando los puertos 4001 y 5173.
rem Solo detiene procesos propios de LeagueCore; los de otros programas no se tocan.
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
