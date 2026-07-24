@echo off
REM Run the garbled name cleanup script against your MongoDB Atlas database
REM This script reads MONGO_URI from the .env file and passes it to the cleanup script
echo ========================================
echo Cleaning up garbled customer names...
echo ========================================

REM Find the .env file and extract MONGO_URI
for /f "tokens=*" %%a in ('findstr /b "MONGODB_URI=" ..\.env') do set "line=%%a"
set MONGO_URI=%line:MONGODB_URI=%
set MONGO_URI=%MONGO_URI:~1%

if "%MONGO_URI%"=="" (
  echo ERROR: Could not find MONGODB_URI in ..\.env
  exit /b 1
)

echo Connecting to MongoDB Atlas...
set MONGO_URI=%MONGO_URI%
node cleanup_garbled_names.mjs

if %ERRORLEVEL% EQU 0 (
  echo.
  echo Success! Corrupted customer names have been fixed.
) else (
  echo.
  echo Script failed with error code %ERRORLEVEL%
)

pause
