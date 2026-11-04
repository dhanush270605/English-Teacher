import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { db } from './db';

export const isNative = () => Capacitor.isNativePlatform();

// ---------- Secrets (API keys) ----------
// Keys are typed in by the user at runtime and never shipped in source or the APK.
// Native: Android SharedPreferences in app-private storage (backup disabled in manifest).
// Web: IndexedDB of this origin.
export type SecretName = 'groqKey' | 'geminiKey';

export async function getSecret(name: SecretName): Promise<string> {
  if (isNative()) return (await Preferences.get({ key: name })).value || '';
  return ((await db.kv.get('secret:' + name))?.value as string) || '';
}
export async function setSecret(name: SecretName, value: string) {
  const v = value.trim();
  if (v && !/^[A-Za-z0-9_\-.]{20,200}$/.test(v)) throw new Error('That does not look like a valid API key.');
  if (isNative()) {
    if (v) await Preferences.set({ key: name, value: v }); else await Preferences.remove({ key: name });
  } else {
    if (v) await db.kv.put({ key: 'secret:' + name, value: v }); else await db.kv.delete('secret:' + name);
  }
}
export async function clearSecrets() {
  await setSecret('groqKey', '');
  await setSecret('geminiKey', '');
}

export function maskKey(k: string) {
  return k ? k.slice(0, 4) + '••••' + k.slice(-4) : '';
}

// ---------- HTTP ----------
// Native requests go through CapacitorHttp (no browser CORS restrictions in the APK).
export class HttpError extends Error {
  constructor(public status: number, public body: any, msg?: string) { super(msg || `HTTP ${status}`); }
}

const TIMEOUT = 60000;

export async function postJson(url: string, headers: Record<string, string>, body: any): Promise<any> {
  if (isNative()) {
    const r = await CapacitorHttp.request({ url, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, data: body, connectTimeout: 20000, readTimeout: TIMEOUT });
    const data = typeof r.data === 'string' ? safeJson(r.data) : r.data;
    if (r.status >= 400) throw new HttpError(r.status, data);
    return data;
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = safeJson(await r.text());
    if (!r.ok) throw new HttpError(r.status, data);
    return data;
  } finally { clearTimeout(to); }
}

export async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  if (isNative()) {
    const r = await CapacitorHttp.request({ url, method: 'GET', headers, connectTimeout: 15000, readTimeout: 30000 });
    const data = typeof r.data === 'string' ? safeJson(r.data) : r.data;
    if (r.status >= 400) throw new HttpError(r.status, data);
    return data;
  }
  const r = await fetch(url, { headers });
  const data = safeJson(await r.text());
  if (!r.ok) throw new HttpError(r.status, data);
  return data;
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function postMultipart(url: string, headers: Record<string, string>, fields: [string, string][], file: { key: string; blob: Blob; name: string }): Promise<any> {
  if (isNative()) {
    const data: any[] = fields.map(([key, value]) => ({ type: 'string', key, value }));
    data.push({ type: 'base64File', key: file.key, value: await blobToBase64(file.blob), fileName: file.name, contentType: file.blob.type || 'audio/webm' });
    const r = await CapacitorHttp.request({ url, method: 'POST', headers: { ...headers, 'Content-Type': 'multipart/form-data' }, data, dataType: 'formData', connectTimeout: 20000, readTimeout: TIMEOUT });
    const d = typeof r.data === 'string' ? safeJson(r.data) : r.data;
    if (r.status >= 400) throw new HttpError(r.status, d);
    return d;
  }
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v);
  fd.append(file.key, file.blob, file.name);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { method: 'POST', headers, body: fd, signal: ctrl.signal });
    const d = safeJson(await r.text());
    if (!r.ok) throw new HttpError(r.status, d);
    return d;
  } finally { clearTimeout(to); }
}

export function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
