@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 正在检查运行环境...

:: 检查Node.js环境
node -v > temp.txt
set /p NODE_VERSION=<temp.txt
del temp.txt

if not defined NODE_VERSION (
    echo 错误: 未安装Node.js或无法找到Node.js
    echo 请访问 https://nodejs.org 下载并安装Node.js
    pause
    exit /b 1
)

echo √ Node.js环境检查通过

:: 检查必要文件
if not exist package.json (
    echo 错误: 缺少必要文件 package.json
    pause
    exit /b 1
)

if not exist server.js (
    echo 错误: 缺少必要文件 server.js
    pause
    exit /b 1
)

if not exist vite.config.js (
    echo 错误: 缺少必要文件 vite.config.js
    pause
    exit /b 1
)

echo √ 必要文件检查通过

:: 检查数据库文件
if not exist vip.db (
    echo 提示: 数据库文件不存在，将在首次运行时自动创建
) else (
    echo √ 数据库文件检查通过
)

:: 检查依赖是否安装
if not exist node_modules (
    echo 正在安装依赖...
    npm install
    if !errorlevel! neq 0 (
        echo 提示: 依赖安装完成，请重新运行安装脚本进行检查
        pause
        exit /b 1
    )
    echo √ 依赖安装完成
) else (
    echo √ 依赖检查通过
)

echo.
echo 恭喜！环境检查完成，系统环境已准备就绪！
echo.

pause