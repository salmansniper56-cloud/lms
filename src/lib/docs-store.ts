export interface Doc {
  id: string;
  name: string;
  folder: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
  owner_id: string;
  mime_type: string | null;
}

const DB_NAME = "numl_scholar_docs_db";
const DB_VERSION = 1;
const STORE_NAME = "documents";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available in this environment."));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("owner_id", "owner_id", { unique: false });
        store.createIndex("folder", "folder", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getCurrentUserId(): string {
  if (typeof window !== "undefined") {
    try {
      const u = localStorage.getItem("numl_user");
      if (u) {
        const parsed = JSON.parse(u);
        return parsed.id || parsed.numl_id || "student";
      }
    } catch {}
  }
  return "student";
}

export async function listDocs(userId?: string): Promise<Doc[]> {
  const uid = userId || getCurrentUserId();
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all: (Doc & { fileData?: Blob })[] = req.result || [];
        const filtered = all
          .filter((d) => !uid || d.owner_id === uid || d.owner_id === "student" || d.owner_id === "default")
          .map(({ fileData, ...meta }) => meta)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not read local docs:", err);
    return [];
  }
}

export async function uploadDoc(file: File, folder = "General"): Promise<Doc> {
  if (file.size > 100 * 1024 * 1024) {
    throw new Error("File is too large. Maximum file size is 100 MB.");
  }
  const uid = getCurrentUserId();
  const id = "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();

  const docRecord: Doc & { fileData: Blob } = {
    id,
    name: file.name,
    folder: folder || "General",
    size_bytes: file.size,
    storage_path: `local/${id}/${file.name}`,
    created_at: now,
    owner_id: uid,
    mime_type: file.type || "application/octet-stream",
    fileData: file,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(docRecord);
    req.onsuccess = () => {
      const { fileData, ...meta } = docRecord;
      resolve(meta);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getDocBlob(docId: string): Promise<Blob> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(docId);
    req.onsuccess = () => {
      if (!req.result || !req.result.fileData) {
        return reject(new Error("Document not found in storage."));
      }
      resolve(req.result.fileData);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function renameDoc(id: string, newName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      if (!req.result) return reject(new Error("Doc not found"));
      req.result.name = newName;
      req.result.updated_at = new Date().toISOString();
      store.put(req.result).onsuccess = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function moveDoc(id: string, newFolder: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      if (!req.result) return reject(new Error("Doc not found"));
      req.result.folder = newFolder;
      req.result.updated_at = new Date().toISOString();
      store.put(req.result).onsuccess = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveFile(doc: { id: string; name: string }) {
  const blob = await getDocBlob(doc.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function docToHtml(docId: string): Promise<string> {
  const blob = await getDocBlob(docId);
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  return value;
}
