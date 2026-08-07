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

### Deploy cu Supabase (recomandat pentru producție)

Backend-ul de producție este inclus în repo: un **Edge Function** (`supabase/functions/sync/`)
care implementează exact aceleași rute ca serverul local (`POST /sync/push`, `GET /sync`),
persistate în **Postgres** (tabelele `documents` și `tombstones`).

Toată configurarea se face **din Dashboard-ul Supabase, fără CLI și fără parola bazei de
date**. `<project-ref>` îl găsești în Dashboard → Project Settings → General → Reference ID
(pentru acest proiect: `vfqduelvlmotnbscnbyx`).

**Pași manuali — se fac o singură dată, totul din browser:**

1. **Creează proiectul** pe [supabase.com](https://supabase.com) (plan gratuit e suficient).
2. **Creează tabelele** (`documents` și `tombstones`):
   - Deschide Dashboard → **SQL Editor** → **New query**
   - Inserează conținutul fișierului `supabase/migrations/00001_create_sync_tables.sql`
   - Apasă **Run**
3. **Setează secret-ul** `SYNC_API_KEY` (cheie lungă și aleatorie, ex. generată cu
   `openssl rand -hex 32`):
   - Dashboard → **Edge Functions** → **Secrets Management** (sau direct
     [supabase.com/dashboard/project/_/functions/secrets](https://supabase.com/dashboard/project/_/functions/secrets))
   - Adaugă `SYNC_API_KEY` = cheia ta și apasă **Save**
4. **Deploy Edge Function-ul `sync`**:
   - Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**
   - Dă-i numele `sync` (minuscul, exact așa)
   - În editor, șterge codul template și inserează conținutul fișierului
     `supabase/functions/sync/index.ts`
   - Apasă **Deploy function**
5. **Dezactivează verificarea JWT** pentru funcție (obligatoriu, altfel platforma respinge
   cererile clientului înainte de a ajunge la codul nostru):
   - Din lista de Edge Functions, deschide funcția `sync`
   - La **Details / Settings**, dezactivează **„Verify JWT with legacy secret”**(sau
     „Enforce JWT Verification”) și salvează
   - Notă: acest toggle are un bug cunoscut care îl poate reactiva la un redeploy —
     dacă sincronizarea nu mai funcționează după un redeploy, verifică toggle-ul din nou
6. **În `.env`** din proiect, setează:
   ```
   VITE_SYNC_API_URL=https://<project-ref>.supabase.co/functions/v1/sync
   VITE_SYNC_AUTH_TOKEN=<aceeași-cheie-ca-la-pasul-3>
   ```
   și repornește `npm run dev`.

> **Notă:** dacă nu vrei protecție prin cheie, nu seta `SYNC_API_KEY` — dar atunci
> oricine poate citi/modifica datele sincronizate. Nu e recomandat în afara testelor locale.

### Server local de referință

`server/index.js` rămâne disponibil pentru test local (fără cont Supabase):
stochează datele într-un fișier JSON local (`server/data.json`, ignorat de Git).
Folosește-l cu `.env` în care `VITE_SYNC_API_URL` pointează spre `http://localhost:3001`.

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
├── supabase/
│   ├── migrations/         # SQL (tabele documents + tombstones)
│   └── functions/sync/     # Edge Function de sincronizare
├── tailwind.config.js
├── tsconfig.json
├── vercel.json             # Configurare deploy Vercel + rute SPA
└── vite.config.ts          # Configurare Vite + PWA
```

---

## Licență

Proiect privat / uz personal. Modifică și distribuie conform nevoilor tale.
