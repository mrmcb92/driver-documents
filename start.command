#!/bin/bash
# Porneste aplicatia Driver Documents PWA pe macOS

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Dependentele nu sunt instalate. Se ruleaza npm install..."
  npm install --cache ./.npm-cache
fi

echo "Se porneste serverul de dezvoltare..."
echo "Browserul se va deschide automat la http://localhost:5173"

# Deschide browserul dupa cateva secunde, in fundal
(sleep 3 && open "http://localhost:5173") &

# Porneste Vite in terminal (proces principal)
npm run dev
