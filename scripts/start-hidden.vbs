' Arranca LeagueCore (API + Web + tunel de Cloudflare) sin mostrar ninguna ventana de consola.
' Delega todo el trabajo en scripts\start-all.ps1 (que tambien abre el navegador).
'
' Uso: wscript.exe //B start-hidden.vbs "<carpeta raiz del repo>" [-NoTunnel]
' Logs (si algo falla, revisar aca): <raiz>\logs\launcher.log, backend.log, frontend.log, tunnel.log

Dim shell, fso, root, extra, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' GetAbsolutePathName normaliza la ruta y quita el "\" final ("C:\x\" o "C:\x\." -> "C:\x"),
' que si no rompe el entrecomillado al pasarlo a PowerShell.
root = fso.GetAbsolutePathName(WScript.Arguments(0))

extra = ""
If WScript.Arguments.Count > 1 Then extra = " " & WScript.Arguments(1)

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & root & "\scripts\start-all.ps1"" -Root """ & root & """" & extra
shell.Run cmd, 0, False
