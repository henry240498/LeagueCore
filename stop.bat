@echo off
rem Apaga LeagueCore (API + Web), liberando los puertos 4001 y 5173.
powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
