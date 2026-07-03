@echo off
title 一闪·墨斩
cd /d "%~dp0"

where npm >/dev/null 2>/dev/null
if errorlevel 1 (
    echo [错误] 未检测到 Node.js / npm
    echo 请先安装 Node.js: https://nodejs.org
    echo.
    pause
    exit /b
)

if not exist "node_modules" (
    echo 首次运行，正在安装依赖，约 1 分钟...
    call npm install
)

if not exist "public\models\hand_landmarker.task" (
    echo 正在下载手部识别模型（约 8MB）...
    call npm run fetch-assets
)

echo.
echo 游戏启动中，浏览器将自动打开...
echo 关闭本窗口即可停止。
echo.

start "OpenBrowser" "%~dp0_open_browser.bat"
call npm run dev

pause
