import { getUploadSignature, deleteDocument } from "./cloudinary.functions";

export interface Doc {
  id: string;
  name: string;
  folder: string;
  size_bytes: number;
  storage_path: string;
  secure_url?: string;
  resource_type?: string;
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

  let storagePath = `local/${id}/${file.name}`;
  let secureUrl: string | undefined = undefined;
  let resourceType: string | undefined = undefined;

  // Upload to Cloudinary
  try {
    const sig = await getUploadSignature({ data: { folder } });
    if (sig?.apiKey && sig?.cloudName) {
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("signature", sig.signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
        method: "POST",
        body: form,
      });

      if (res.ok) {
        const json = await res.json();
        storagePath = json.public_id || storagePath;
        secureUrl = json.secure_url;
        resourceType = json.resource_type;
      }
    }
  } catch (err) {
    console.warn("Cloudinary upload failed, falling back to local storage:", err);
  }

  const docRecord: Doc & { fileData: Blob } = {
    id,
    name: file.name,
    folder: folder || "General",
    size_bytes: file.size,
    storage_path: storagePath,
    secure_url: secureUrl,
    resource_type: resourceType,
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
    req.onsuccess = async () => {
      if (req.result?.fileData) {
        return resolve(req.result.fileData);
      }
      if (req.result?.secure_url) {
        try {
          const res = await fetch(req.result.secure_url);
          if (res.ok) {
            const blob = await res.blob();
            return resolve(blob);
          }
        } catch {}
      }
      reject(new Error("Document not found in storage."));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = async () => {
      const doc = getReq.result;
      if (doc?.storage_path) {
        deleteDocument({
          data: {
            id,
            storage_path: doc.storage_path,
            resource_type: doc.resource_type || "raw",
          },
        }).catch(() => null);
      }
      const delReq = store.delete(id);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
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

export async function saveFile(doc: { id: string; name: string; secure_url?: string }) {
  if (doc.secure_url) {
    try {
      const res = await fetch(doc.secure_url);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    } catch {}
  }
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
