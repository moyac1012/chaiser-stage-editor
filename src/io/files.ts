/** ファイルの読み込み・書き出し（ブラウザ API との境界） */
import type { StageDocument } from '../domain/types';

export function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

export function downloadText(text: string, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 旧エディタと同じ形（インデント 2）で書き出す */
export function serializeDocument(doc: StageDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function defaultExportFileName(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `chaiser-stages-${y}-${m}-${d}.json`;
}

export async function fetchDefaultDocument(): Promise<unknown> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/default-stages.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`既定データを取得できません（${res.status}）`);
  return res.json();
}

/** 書き出した内容と同じかどうかを見分けるための短い値（FNV-1a） */
export function documentFingerprint(doc: StageDocument): string {
  const text = JSON.stringify(doc);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length}-${(h >>> 0).toString(16)}`;
}
