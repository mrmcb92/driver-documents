@echo off
chcp 65001 >nul
:: Porneste aplicatia Driver Documents PWA pe Windows

cd /d "%~dp0"

if not exist "node_modules\" (
    echo Dependentele nu sunt instalate. Se ruleaza npm install...
    npm install --cache .\.npm-cache
)

echo Se porneste serverul de dezvoltare...
echo Browserul se va deschide automat la http://localhost:5173

:: Deschide browserul dupa cateva secunde, in fundal
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

:: Porneste Vite in terminal (proces principal)
npm run dev
