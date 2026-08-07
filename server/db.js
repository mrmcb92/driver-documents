import { Client } from 'pg';

let client;

export async function connectDb() {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL nu este configurată.');
    }

    client = new Client({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    await client.connect();
    console.log('[db] Conectat la baza de date PostgreSQL.');
  }
  return client;
}

export async function initDb() {
  const db = await connectDb();

  await db.query(`
    create table if not exists public.documents (
      id text primary key,
      type text not null,
      title text not null,
      issue_date text not null,
      expiry_date text not null,
      notes text,
      created_at bigint not null,
      updated_at bigint not null
    );
  `);

  await db.query(`
    create table if not exists public.tombstones (
      id text primary key,
      deleted_at bigint not null
    );
  `);

  await db.query(`
    create index if not exists idx_documents_updated_at
      on public.documents (updated_at);
  `);

  await db.query(`
    create index if not exists idx_tombstones_deleted_at
      on public.tombstones (deleted_at);
  `);

  console.log('[db] Tabele inițializate.');
}
