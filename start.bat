@echo off
rem Levanta LeagueCore (API + Web) sin ventanas de consola visibles y abre el navegador.
rem Logs si algo falla: logs\backend.log y logs\frontend.log
wscript.exe //B "%~dp0scripts\start-hidden.vbs" "%~dp0"
