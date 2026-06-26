@echo off
chcp 65001 > nul
title Goksun SYDV Yonetim Sistemi
setlocal

set "APP_DIR=%~dp0"
set "NODE_EXE="

where node > nul 2> nul
if %errorlevel%==0 set "NODE_EXE=node"

if "%NODE_EXE%"=="" (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  )
)

if "%NODE_EXE%"=="" (
  echo Program icin gereken calistirici bulunamadi.
  echo Lutfen Node.js kurun veya programi Codex kurulu bilgisayarda calistirin.
  pause
  exit /b 1
)

cd /d "%APP_DIR%"
echo Goksun SYDV Yonetim Sistemi baslatiliyor...
echo Ana menu tarayicida otomatik acilacaktir.
"%NODE_EXE%" "%APP_DIR%server.js"
pause
