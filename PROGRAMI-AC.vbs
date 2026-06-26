Option Explicit

Dim shell, files, baseFolder, nodeExe, serverFile
Dim service, processes, process, commandLine
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")

baseFolder = files.GetParentFolderName(WScript.ScriptFullName)
serverFile = files.BuildPath(baseFolder, "server.js")
nodeExe = shell.ExpandEnvironmentStrings("%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")

If Not files.FileExists(nodeExe) Then
  nodeExe = "node"
End If

If Not files.FileExists(serverFile) Then
  MsgBox "Program dosyasi bulunamadi: " & serverFile, 16, "Goksun SYDV Yonetim Sistemi"
  WScript.Quit 1
End If

On Error Resume Next
Set service = GetObject("winmgmts:\\.\root\cimv2")
Set processes = service.ExecQuery("Select * from Win32_Process Where Name='node.exe'")
For Each process In processes
  commandLine = ""
  commandLine = process.CommandLine
  If InStr(1, commandLine, serverFile, vbTextCompare) > 0 Then
    process.Terminate
  End If
Next
On Error GoTo 0
WScript.Sleep 500

shell.CurrentDirectory = baseFolder
shell.Run """" & nodeExe & """ """ & serverFile & """", 0, False
