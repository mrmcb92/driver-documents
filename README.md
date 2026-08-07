# Driver Documents – Management documente ridesharing

Aplicație web **PWA (Progressive Web App)** pentru gestionarea documentelor auto și personale ale șoferilor de ridesharing (Uber, Bolt etc.).

Folosește aplicația direct din browser sau instaleaz-o pe telefon pentru acces rapid, notificări pentru expirări și funcționare offline.

---

## Funcționalități

- Adăugare, editare și ștergere documente (RCA, ITP, licență, certificat, etc.)
- Notificări pentru documente care expiră
- Temă întunecată / deschisă
- Funcționare offline ca aplicație instalabilă (PWA)
- Interfață optimizată pentru mobil
- **Sincronizare între dispozitive** (PWA mobilă ⇄ web desktop) prin server REST de sincronizare:
  - scrieri offline în coadă (outbox) + reîncărcare la reconectare
  - pull delta cu cursor, rezoluție conflicte last-write-wins + tombstones
  - indicator de stare sincronizare + buton manual

---

## Tehnologii

- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

---

## Scripturi disponibile

| Comandă | Descriere |
|---|---|
| `npm install` | Instalează dependențele |
| `npm run dev` | Pornește serverul de dezvoltare |
| `npm run build` | Compilează aplicația pentru producție (`tsc && vite build`) |
| `npm run preview` | Previzualizează build-ul de producție local |
| `npm run sync-server` | Pornește serverul local de sincronizare (port 3001) |

---

## Sincronizare între dispozitive

Aplicația folosește un **motor de sincronizare client** (`src/sync/`) care persistă datele în
**IndexedDB** (în loc de localStorage), cu o **coadă de scrieri offline (outbox)** și **pull delta**
de la server. Fără server configurat, aplicația funcționează exact ca înainte (offline,
doar local).

### Pornire locală (client + server)

1. Instalează dependențele:
   ```bash
   npm install
   ```
2. Creează fișierul `.env` pe baza exemplului:
   ```bash
   cp .env.example .env
   ```
   `VITE_SYNC_API_URL` trebuie să pointeze către serverul de sincronizare.
3. Pornește serverul de sincronizare:
   ```bash
   npm run sync-server
   ```
4. Într-un alt terminal, pornește aplicația:
   ```bash
   npm run dev
   ```

Deschide aplicația pe **două dispozitive** (ex. browser desktop + telefon pe aceeași rețea,
folosind IP-ul local al calculatorului) și modifică documente — datele se sincronizează automat:
salvare → debounce 3 s → push; reconectare/intrare în pagină → pull delta.

### Rezoluția conflictelor

- **Last-write-wins** pe document, comparând `updatedAt` (clientul pastrează scrierea mai nouă).
- **Egalitate de timp (tie):** serverul câștigă și returnează starea rezolvată conflictului; clientul o adoptă.
- **Ștergere vs editare:** tombstones — ștergerea mai nouă câștigă; „ghost edit” pe un document șters nu-l readuce.

### Server de sincronizare

Backend-ul de sincronizare expune rutele `POST /sync/push` și `GET /sync` și persistă
datele direct în **PostgreSQL** folosind driverul `pg` și `DATABASE_URL`.

Tabelele necesare (`documents` și `tombstones`) sunt create automat la prima conectare
dacă nu există deja.

Există două moduri de rulare:

**1. Local (pentru dezvoltare):**

```bash
npm run sync-server
```

În alt terminal:

```bash
npm run dev
```

Setează în `.env`:

```bash
VITE_SYNC_API_URL=http://localhost:3001
DATABASE_URL=...
```

**2. Online pe Vercel (pentru producție):**

API-ul de sincronizare este implementat ca **serverless functions** în directorul `api/`.
Când faci deploy pe Vercel, aceleași rute (`/sync`, `/sync/push`, `/health`) sunt disponibile
pe domeniul aplicației, deci frontend-ul poate apela backend-ul direct.

Setează în Vercel → Project Settings → Environment Variables:

| Variabilă | Valoare |
|---|---|
| `DATABASE_URL` | connection string PostgreSQL |
| `AUTH_TOKEN` | cheie secretă pentru protecția API (opțional, dar recomandat) |
| `VITE_SYNC_API_URL` | `/` (apeluri pe același domeniu) |
| `VITE_SYNC_AUTH_TOKEN` | aceeași valoare ca `AUTH_TOKEN` |

După setarea variabilelor, redeploy.

---

## Cum să urci codul pe GitHub

### 1. Creează un depozit nou pe GitHub

1. Intră pe [github.com/new](https://github.com/new).
2. Completează numele depozitului, de exemplu `driver-documents`.
3. Lasă-l **Public** (sau Private, dacă preferi).
4. **Nu** bifa „Initialize this repository with a README”.
5. Apasă **Create repository**.

### 2. Conectează depozitul local la GitHub

Rulează comenzile de mai jos în terminal, în folderul proiectului:

```bash
# Adaugă remote-ul GitHub (înlocuiește USERNAME cu numele tău de utilizator)
git remote add origin https://github.com/USERNAME/driver-documents.git

# Trimite codul pe GitHub
git branch -M main
git push -u origin main
```

După `git push`, codul sursă va fi disponibil pe GitHub.

---

## Cum să faci deploy gratuit pe Vercel

1. Intră pe [vercel.com](https://vercel.com) și autentifică-te cu contul GitHub.
2. Apasă **Add New… → Project**.
3. Selectează depozitul `driver-documents` și apasă **Import**.
4. Lasă setările implicite:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Apasă **Deploy**.

În câteva secunde vei primi un link public de forma:

```
https://driver-documents-USERNAME.vercel.app
```

Aplicația este acum live și accesibilă de pe orice telefon sau browser.

---

## Cum să faci deploy gratuit pe Netlify (alternativă)

1. Intră pe [app.netlify.com](https://app.netlify.com) și autentifică-te.
2. Apasă **Add new site → Import an existing project**.
3. Alege **GitHub** și selectează depozitul `driver-documents`.
4. Configurează:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Apasă **Deploy site**.

Netlify va genera un link public, de exemplu:

```
https://driver-documents-123456.netlify.app
```

---

## Cum instalezi aplicația PWA pe telefon

### Android (Chrome)

1. Deschide link-ul public al aplicației în **Chrome**.
2. Așteaptă să apară bannerul „Adaugă pe ecranul de start” sau apasă ⋮ → **Adaugă pe ecranul de start**.
3. Confirmă și aplicația va apărea ca o pictogramă normală în launcher.

### iOS (Safari)

1. Deschide link-ul public al aplicației în **Safari**.
2. Apasă butonul **Partajează** (pătratul cu săgeată în sus).
3. Selectează **Adaugă pe ecranul principal**.
4. Confirmă cu **Adaugă**.

După instalare, aplicația se deschide în modul standalone, fără bara de adrese, și funcționează offline pentru vizualizarea datelor deja încărcate.

---

## Structura proiectului

```
driver-documents/
├── public/                 # Resurse statice (iconițe, manifest)
├── src/
│   ├── components/         # Componente React
│   ├── contexts/           # Contexte React (temă, etc.)
│   ├── types/              # Tipuri TypeScript
│   ├── utils/              # Funcții utilitare
│   ├── App.tsx             # Componenta principală
│   ├── index.css           # Stiluri globale
│   └── main.tsx            # Punct de intrare
├── .gitignore
├── index.html
├── package.json
├── api/                    # Serverless functions Vercel (/sync, /sync/push, /health)
│   ├── sync.js
│   ├── sync/push.js
│   └── health.js
├── server/
│   ├── index.js            # Server de sincronizare local (Express + PostgreSQL)
│   ├── db.js               # Utilitar de conectare PostgreSQL
│   └── sync.js             # Logică partajată sync
├── supabase/
│   └── migrations/         # SQL (tabele documents + tombstones)
├── tailwind.config.js
├── tsconfig.json
├── vercel.json             # Configurare deploy Vercel + rute SPA
└── vite.config.ts          # Configurare Vite + PWA
```

---

## Licență

Proiect privat / uz personal. Modifică și distribuie conform nevoilor tale.
