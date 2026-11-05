/**
 * The CV dropped on the landing page waits in the student's own browser until the account
 * exists (docs/QUESTIONS.md C100). The server never keeps the file: it reads it, answers
 * with what it understood, and forgets it. Keeping it here means the questionnaire does
 * not ask for it again once the account is created.
 *
 * IndexedDB holds the file itself, so nothing is encoded or copied; every call fails
 * quietly, because private windows and locked-down browsers refuse the database.
 */

const DB_NAME = "jobgpt";
const STORE = "pending_cv";
const KEY = "cv";
/** A file nobody came back for is dropped after a day. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const HANDOFF_MAX_BYTES = 5 * 1024 * 1024;

type Stashed = { file: File; at: number };

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Only a PDF is kept: that is the format the account accepts for a CV. */
export function canStashCv(file: File): boolean {
  return /\.pdf$/i.test(file.name) && file.size <= HANDOFF_MAX_BYTES;
}

export async function stashCv(file: File): Promise<void> {
  if (!canStashCv(file)) return;
  const db = await openDb();
  if (!db) return;
  await run<IDBValidKey>(db, "readwrite", (store) =>
    store.put({ file, at: Date.now() } satisfies Stashed, KEY),
  );
  db.close();
}

export async function clearStashedCv(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await run<undefined>(db, "readwrite", (store) => store.delete(KEY));
  db.close();
}

/** Reads the waiting file and removes it: it is handed over once, to one account. */
export async function takeStashedCv(): Promise<File | null> {
  const db = await openDb();
  if (!db) return null;
  const stashed = await run<Stashed | undefined>(db, "readonly", (store) => store.get(KEY));
  await run<undefined>(db, "readwrite", (store) => store.delete(KEY));
  db.close();
  if (!stashed || !(stashed.file instanceof File)) return null;
  if (Date.now() - stashed.at > MAX_AGE_MS) return null;
  return stashed.file;
}
