@echo off
rem wait for dev server then open default browser
timeout /t 6 /nobreak >/dev/null
start "" http://127.0.0.1:5178
exit
