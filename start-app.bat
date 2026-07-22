@echo off
REM Start Backend and Frontend for DigiLog Application

echo Starting DigiLog Application...
echo.

REM Check if node_modules exist in both directories
if not exist "apps\api\node_modules" (
    echo Installing backend dependencies...
    cd apps\api
    call npm install
    cd ..\..
)

if not exist "apps\web\node_modules" (
    echo Installing frontend dependencies...
    cd apps\web
    call npm install
    cd ..\..
)

echo.
echo Starting Backend Server (Port 5000)...
start "DigiLog Backend" cmd /k "cd apps\api && npm run dev"

timeout /t 3

echo Starting Frontend Server (Port 3000)...
start "DigiLog Frontend" cmd /k "cd apps\web && npm run dev"

echo.
echo Both servers should be running now:
echo   - Backend:  http://localhost:5000 (or check your API config)
echo   - Frontend: http://localhost:3000
echo.
echo Close either command window to stop that server.
