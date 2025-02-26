Option Explicit

Dim shell, fso, currentPath, nodeCmd, viteCmd

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取当前脚本所在目录
currentPath = fso.GetParentFolderName(WScript.ScriptFullName)

' 设置工作目录
shell.CurrentDirectory = currentPath

' 启动后端服务器
nodeCmd = "node server.js"
shell.Run nodeCmd, 0, False

' 等待2秒确保后端服务器启动
WScript.Sleep 2000

' 启动前端开发服务器
viteCmd = "npm run dev"
shell.Run viteCmd, 0, False

Set shell = Nothing
Set fso = Nothing