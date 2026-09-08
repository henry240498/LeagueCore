' Arranca LeagueCore (API + Web) sin mostrar ninguna ventana de consola,
' y abre el navegador cuando el frontend está listo.
'
' Uso: wscript.exe //B start-hidden.vbs "<ruta raíz del repo, con backslash final>"
' Logs (si algo falla, revisar acá): <raiz>\logs\backend.log y <raiz>\logs\frontend.log

Dim root, shell, fso
root = WScript.Arguments(0)

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If Not fso.FolderExists(root & "logs") Then
    fso.CreateFolder(root & "logs")
End If

shell.CurrentDirectory = root & "src\backend"
shell.Run "cmd /c npm run start:dev > """ & root & "logs\backend.log"" 2>&1", 0, False

shell.CurrentDirectory = root & "src\frontend"
shell.Run "cmd /c npm run dev > """ & root & "logs\frontend.log"" 2>&1", 0, False

WScript.Sleep 8000

shell.Run "http://localhost:5173", 1, False
