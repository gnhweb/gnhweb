export interface FaithCardRecord {
  id: string;
  weekLabel: string;
  createdAt: number;
  summaryText: string;
  verseRef: string;
  moodLabel: string;
  moodEmoji: string;
  blob: Blob;
}

const DB_NAME = 'gnhweb-faith-cards';
const STORE_NAME = 'cards';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('카드 보관함을 열지 못했어요.'));
  });
}

export async function saveFaithCard(record: FaithCardRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('카드를 저장하지 못했어요.'));
    tx.onabort = () => reject(tx.error ?? new Error('카드 저장이 취소됐어요.'));
  });
  db.close();
}

export async function listFaithCards(): Promise<FaithCardRecord[]> {
  const db = await openDb();
  const records = await new Promise<FaithCardRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as FaithCardRecord[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error ?? new Error('카드 목록을 불러오지 못했어요.'));
  });
  db.close();
  return records;
}

export async function deleteFaithCard(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('카드를 삭제하지 못했어요.'));
    tx.onabort = () => reject(tx.error ?? new Error('카드 삭제가 취소됐어요.'));
  });
  db.close();
}
