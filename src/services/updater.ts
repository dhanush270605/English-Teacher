// Over-the-air updates for the Android app.
// The APK contains a native shell + a copy of the web app. On launch the app asks GitHub for the
// latest release's version.json; if it is newer, it downloads web-bundle.zip, unpacks it into private
// storage and tells Capacitor to serve the app from there (same origin, so all data is kept).
// Native changes (new plugins/permissions) still need a new APK; Capacitor automatically falls back
// to the APK's bundled files after an APK upgrade.
import { CapacitorHttp, WebView } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { unzipSync } from 'fflate';
import { isNative } from './platform';

export const REPO = 'dhanush270605/English-Teacher';
export const BUILD = Number(import.meta.env.VITE_BUILD || 0);
const LATEST = `https://github.com/${REPO}/releases/latest/download`;

export interface UpdateState { current: number; latest?: number; status: 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error' | 'unsupported'; message?: string }

let state: UpdateState = { current: BUILD, status: isNative() ? 'idle' : 'unsupported' };
const listeners = new Set<(s: UpdateState) => void>();
function set(s: Partial<UpdateState>) { state = { ...state, ...s }; listeners.forEach((l) => l(state)); }
export function onUpdateState(l: (s: UpdateState) => void) { listeners.add(l); l(state); return () => listeners.delete(l); }

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Switch to a bundle downloaded earlier. Called at startup; reloads the WebView once. */
export async function applyPendingUpdate(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { value } = await Preferences.get({ key: 'ota_pending' });
    if (!value) return false;
    const p = JSON.parse(value) as { build: number; path: string };
    await Preferences.remove({ key: 'ota_pending' });
    if (p.build <= BUILD) return false;
    await Preferences.set({ key: 'ota_active', value: String(p.build) });
    await WebView.setServerBasePath({ path: p.path });
    await WebView.persistServerBasePath();
    return true;
  } catch {
    return false;
  }
}

/** Check GitHub for a newer build; download and stage it. Safe to call often. */
export async function checkForUpdate(opts: { applyNow?: boolean } = {}): Promise<UpdateState> {
  if (!isNative()) return state;
  if (state.status === 'checking' || state.status === 'downloading') return state;
  set({ status: 'checking', message: undefined });
  try {
    const v = await CapacitorHttp.request({ url: `${LATEST}/version.json`, method: 'GET', connectTimeout: 15000, readTimeout: 20000 });
    const info = typeof v.data === 'string' ? JSON.parse(v.data) : v.data;
    const latest = Number(info?.build || 0);
    if (v.status >= 400 || !latest) throw new Error('No version info');
    if (latest <= BUILD) { set({ status: 'up-to-date', latest }); return state; }
    const staged = await Preferences.get({ key: 'ota_pending' });
    if (staged.value && JSON.parse(staged.value).build >= latest) {
      set({ status: 'ready', latest });
      if (opts.applyNow) await applyPendingUpdate();
      return state;
    }
    set({ status: 'downloading', latest });
    const z = await CapacitorHttp.request({ url: `https://github.com/${REPO}/releases/download/v1.0.${latest}/web-bundle.zip`, method: 'GET', responseType: 'blob', connectTimeout: 20000, readTimeout: 120000 });
    if (z.status >= 400 || typeof z.data !== 'string') throw new Error('Download failed');
    const files = unzipSync(b64ToBytes(z.data));
    if (!files['index.html']) throw new Error('Bad update package');
    const dir = `ota/${latest}`;
    for (const [name, data] of Object.entries(files)) {
      if (name.endsWith('/')) continue;
      await Filesystem.writeFile({ path: `${dir}/${name}`, data: bytesToB64(data), directory: Directory.Data, recursive: true });
    }
    const uri = (await Filesystem.getUri({ path: dir, directory: Directory.Data })).uri;
    const path = decodeURIComponent(uri.replace(/^file:\/\//, ''));
    await Preferences.set({ key: 'ota_pending', value: JSON.stringify({ build: latest, path }) });
    // Remove older downloaded bundles.
    try {
      const list = await Filesystem.readdir({ path: 'ota', directory: Directory.Data });
      for (const f of list.files) if (Number(f.name) < latest && Number(f.name) !== Number((await Preferences.get({ key: 'ota_active' })).value)) await Filesystem.rmdir({ path: `ota/${f.name}`, directory: Directory.Data, recursive: true });
    } catch { /* ignore */ }
    set({ status: 'ready', latest });
    if (opts.applyNow) await applyPendingUpdate();
    return state;
  } catch (e: any) {
    set({ status: 'error', message: e?.message || 'Update check failed' });
    return state;
  }
}
