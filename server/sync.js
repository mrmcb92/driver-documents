export const TIE_WINDOW_MS = 2000;
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;
export const MAX_PUSH_ITEMS = 200;

export function isDocument(value) {
  if (!value || typeof value !== 'object') return false;
  const doc = value;
  return (
    typeof doc.id === 'string' &&
    typeof doc.type === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.issueDate === 'string' &&
    typeof doc.expiryDate === 'string' &&
    typeof doc.createdAt === 'number' &&
    typeof doc.updatedAt === 'number'
  );
}

export function toRow(doc) {
  return [
    doc.id,
    doc.type,
    doc.title,
    doc.issueDate,
    doc.expiryDate,
    doc.notes ?? null,
    doc.createdAt,
    doc.updatedAt,
  ];
}

export function fromRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    notes: row.notes ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function requireAuth(header, authToken) {
  if (!authToken) return true;
  return header === `Bearer ${authToken}`;
}

export async function pushItems(db, items) {
  const accepted = [];
  const conflicts = [];
  const serverNow = Date.now();

  const ids = items.map((item) => item.id);
  const existingResult = await db.query(
    'select id, updated_at from public.documents where id = any($1)',
    [ids]
  );
  const existingById = new Map(existingResult.rows.map((row) => [row.id, Number(row.updated_at)]));

  for (const item of items) {
    const existingUpdatedAt = existingById.get(item.id);

    if (item.deleted) {
      const deletedAt = typeof item.deletedAt === 'number' ? item.deletedAt : serverNow;

      if (existingUpdatedAt !== undefined && existingUpdatedAt > deletedAt) {
        const existingResult = await db.query(
          'select * from public.documents where id = $1',
          [item.id]
        );
        if (existingResult.rows[0]) {
          conflicts.push({
            id: item.id,
            kind: 'server-wins',
            document: fromRow(existingResult.rows[0]),
          });
          continue;
        }
      }

      await db.query('delete from public.documents where id = $1', [item.id]);
      await db.query(
        `insert into public.tombstones (id, deleted_at)
         values ($1, $2)
         on conflict (id) do update set deleted_at = excluded.deleted_at`,
        [item.id, deletedAt]
      );
      accepted.push(item.id);
      continue;
    }

    const doc = item.document;
    if (!isDocument(doc)) {
      throw new Error(`Document invalid pentru id ${item.id}`);
    }

    if (existingUpdatedAt !== undefined && existingUpdatedAt > doc.updatedAt) {
      const existingResult = await db.query(
        'select * from public.documents where id = $1',
        [doc.id]
      );
      if (existingResult.rows[0]) {
        conflicts.push({
          id: item.id,
          kind: 'server-wins',
          document: fromRow(existingResult.rows[0]),
        });
        continue;
      }
    }

    if (
      existingUpdatedAt !== undefined &&
      Math.abs(existingUpdatedAt - doc.updatedAt) <= TIE_WINDOW_MS
    ) {
      const existingResult = await db.query(
        'select * from public.documents where id = $1',
        [doc.id]
      );
      if (existingResult.rows[0]) {
        const resolved = { ...fromRow(existingResult.rows[0]), updatedAt: serverNow };
        await upsertDocument(db, resolved);
        conflicts.push({ id: item.id, kind: 'server-wins', document: resolved });
        continue;
      }
    }

    await upsertDocument(db, doc);
    await db.query('delete from public.tombstones where id = $1', [doc.id]);
    accepted.push(item.id);
  }

  return { accepted, conflicts, serverNow };
}

async function upsertDocument(db, doc) {
  await db.query(
    `insert into public.documents (id, type, title, issue_date, expiry_date, notes, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set
       type = excluded.type,
       title = excluded.title,
       issue_date = excluded.issue_date,
       expiry_date = excluded.expiry_date,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
    toRow(doc)
  );
}

export async function pullChanges(db, since, limit) {
  const docsResult = await db.query(
    'select * from public.documents where updated_at > $1 order by updated_at asc limit $2',
    [since, limit + 1]
  );

  const tombstonesResult = await db.query(
    'select * from public.tombstones where deleted_at > $1 order by deleted_at asc limit $2',
    [since, limit + 1]
  );

  const changes = [
    ...docsResult.rows.map((row) => ({ ts: Number(row.updated_at), doc: fromRow(row) })),
    ...tombstonesResult.rows.map((row) => ({
      ts: Number(row.deleted_at),
      tombstone: { id: row.id, deletedAt: Number(row.deleted_at) },
    })),
  ].sort((a, b) => a.ts - b.ts);

  const page = changes.slice(0, limit);
  const pageItems = page.filter((c) => c.doc).map((c) => c.doc);
  const pageTombstones = page.filter((c) => c.tombstone).map((c) => c.tombstone);
  const nextCursor = page.length > 0 ? Math.max(...page.map((c) => c.ts)) : since;
  const hasMore = changes.length > limit;

  return { items: pageItems, tombstones: pageTombstones, nextCursor, hasMore };
}
