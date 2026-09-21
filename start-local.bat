@echo off
rem Levanta LeagueCore SOLO en esta PC (API + Web), sin abrir el tunel de Cloudflare:
rem nadie puede entrar desde afuera. Para el acceso remoto usar start.bat.
wscript.exe //B "%~dp0scripts\start-hidden.vbs" "%~dp0." -NoTunnel
