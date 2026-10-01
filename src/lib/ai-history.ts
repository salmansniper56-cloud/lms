import type { ChatMsg } from "./ai-client";

export interface StoredThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMsg[];
}

const STORAGE_KEY = "numl_ai_threads_v1";

function getCurrentUserId(): string {
  if (typeof window === "undefined") return "guest";
  try {
    const raw = localStorage.getItem("numl_user");
    if (raw) {
      const u = JSON.parse(raw);
      return u.id || u.numl_id || "default";
    }
  } catch {}
  return "default";
}

function getKey(): string {
  return `${STORAGE_KEY}_${getCurrentUserId()}`;
}

export function getStoredThreads(): StoredThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getKey());
    if (!raw) return [];
    const list: StoredThread[] = JSON.parse(raw);
    return Array.isArray(list) ? list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) : [];
  } catch {
    return [];
  }
}

export function getStoredThread(id: string): StoredThread | null {
  const threads = getStoredThreads();
  return threads.find((t) => t.id === id) || null;
}

export function createStoredThread(title = "New conversation", initialPrompt?: string): StoredThread {
  const threads = getStoredThreads();
  const id = "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();
  const newThread: StoredThread = {
    id,
    title: initialPrompt ? initialPrompt.slice(0, 50) : title,
    created_at: now,
    updated_at: now,
    messages: [],
  };
  threads.unshift(newThread);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getKey(), JSON.stringify(threads));
    } catch {}
  }
  return newThread;
}

export function saveStoredThreadMessages(id: string, messages: ChatMsg[]): void {
  if (typeof window === "undefined") return;
  const threads = getStoredThreads();
  const idx = threads.findIndex((t) => t.id === id);
  const now = new Date().toISOString();

  let title = "New conversation";
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser) {
    title = firstUser.content.split("\n")[0].slice(0, 50);
  }

  if (idx >= 0) {
    threads[idx].messages = messages;
    threads[idx].updated_at = now;
    if (threads[idx].title === "New conversation" && title !== "New conversation") {
      threads[idx].title = title;
    }
  } else {
    threads.unshift({
      id,
      title,
      created_at: now,
      updated_at: now,
      messages,
    });
  }

  try {
    localStorage.setItem(getKey(), JSON.stringify(threads));
  } catch {}
}

export function deleteStoredThread(id: string): void {
  if (typeof window === "undefined") return;
  const threads = getStoredThreads().filter((t) => t.id !== id);
  try {
    localStorage.setItem(getKey(), JSON.stringify(threads));
  } catch {}
}
