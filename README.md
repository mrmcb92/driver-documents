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
- Conturi de utilizator cu autentificare securizată (Supabase Auth)
- Date sincronizate în cloud (PostgreSQL + Row Level Security), fiecare utilizator vede doar documentele proprii
- Atașare scan / poză pentru fiecare document (Supabase Storage, bucket privat)

---

## Tehnologii

- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Supabase](https://supabase.com/) — autentificare, PostgreSQL cu Row Level Security, storage pentru scanuri

---

## Scripturi disponibile

| Comandă | Descriere |
|---|---|
| `npm install` | Instalează dependențele |
| `npm run dev` | Pornește serverul de dezvoltare |
| `npm run build` | Compilează aplicația pentru producție (`tsc && vite build`) |
| `npm run preview` | Previzualizează build-ul de producție local |

---

## Cum să urci codul pe GitHub

### 1. Creează un depozit nou pe GitHub

1. Intră pe [github.com/new](https://github.com/new).
2. Completează numele depozitului, de exemplu `driver-documents`.
3. Lasă-l **Public** (sau Private, dacă preferi).
4. **Nu** bifa „Initialize this repository with a README".
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

## Configurare backend Supabase

Aplicația folosește Supabase pentru autentificare, baza de date și stocarea scanurilor. Pașii de configurare:

### 1. Creează un proiect

1. Intră pe [supabase.com](https://supabase.com) → **New project**.
2. Alege organizația, numele (ex. `driver-documents`) și o regiune apropiată (ex. `Central EU (Frankfurt)`).
3. Salvează parola bazei de date într-un loc sigur — o vei folosi la pasul următor.

### 2. Aplică schema bazei de date

Rulezi migration-urile din `supabase/migrations` pe proiect. Există două opțiuni:

**Opțiunea A — SQL Editor (recomandată pentru început):**

1. Din dashboard → **SQL Editor**, deschide fișierul `supabase/migrations/20260808210000_init.sql` și execută tot conținutul.
2. Deschide apoi `supabase/migrations/20260808220000_document_user_id_trigger.sql` și execută-l.
3. Opțional, în **Storage → Buckets** (sau din același editor SQL) verifică bucketul `document-scans` creat cu acces privat.

**Opțiunea B — CLI:**

```bash
supabase link --project-ref REFERINȚA_PROIECTULUI
supabase db push
```

### 3. Configurează autentificarea

În **Authentication → Providers → Email**, asigură-te că providerul **Email** este activat. Pentru testare poți dezactiva „Confirm email" dacă vrei conturi create instant (nu recomandat în producție).

### 4. Setează variabilele de mediu

Creează un fișier `.env` (nu se expediază pe GitHub) cu:

```
VITE_SUPABASE_URL=https://REFERINȚA_PROIECTULUI.supabase.co
VITE_SUPABASE_ANON_KEY=cheia_anon
```

- `VITE_SUPABASE_URL` și `VITE_SUPABASE_ANON_KEY` se găsesc în dashboard → **Project Settings → API**.
- **Important:** folosește cheia **anon/public**, nu `service_role` (care are acces total și nu trebuie expusă în client).

### 5. La deploy (Vercel / Netlify)

Adaugă aceleași două variabile (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) în **Environment Variables** ale proiectului de hosting, apoi redeploy.

---

## Cum să faci deploy gratuit pe Vercel

1. Intră pe [vercel.com](https://vercel.com) și autentifică-te cu contul GitHub.
2. Apasă **Add New… → Project**.
3. Selectează depozitul `driver-documents` și apasă **Import**.
4. Adaugă variabilele de mediu `VITE_SUPABASE_URL` și `VITE_SUPABASE_ANON_KEY`.
5. Lasă setările implicite:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. Apasă **Deploy**.

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
2. Așteaptă să apară bannerul „Adaugă pe ecranul de start" sau apasă ⋮ → **Adaugă pe ecranul de start**.
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
│   ├── hooks/              # Hook-uri React
│   ├── types/              # Tipuri TypeScript
│   ├── utils/              # Funcții utilitare
│   ├── App.tsx             # Componenta principală
│   ├── index.css           # Stiluri globale
│   └── main.tsx            # Punct de intrare
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json             # Configurare deploy Vercel + rute SPA
└── vite.config.ts          # Configurare Vite + PWA
```

---

## Licență

Proiect privat / uz personal. Modifică și distribuie conform nevoilor tale.
