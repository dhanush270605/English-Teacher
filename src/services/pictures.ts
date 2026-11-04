// Free picture source: Wikimedia Commons search API (openly licensed, no key, CORS enabled with origin=*).
import { PICTURE_CATEGORIES } from '../data/content/practice';
import { cacheGet, cacheSet, markUsed, recentKeys } from './db';
import { blobToBase64, getJson, isNative } from './platform';
import { CapacitorHttp } from '@capacitor/core';

export interface Picture { url: string; thumb: string; title: string; caption: string; credit: string; license: string; pageUrl: string; category: string }

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

async function searchCommons(q: string): Promise<Omit<Picture, 'category'>[]> {
  const ck = 'commons:' + q;
  const cached = await cacheGet<Omit<Picture, 'category'>[]>(ck, 14 * 86400000);
  if (cached?.length) return cached;
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '25',
    prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '900',
  });
  const d = await getJson(url);
  const pages = Object.values(d?.query?.pages || {}) as any[];
  const out = pages
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl || (ii.width || 0) < 600) return null;
      if (/\.(svg|gif|tif)/i.test(p.title) || /map|logo|diagram|chart|flag|coat of arms|icon/i.test(p.title)) return null;
      const md = ii.extmetadata || {};
      return {
        url: ii.url, thumb: ii.thumburl, title: String(p.title).replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        caption: stripHtml(md.ImageDescription?.value || '').slice(0, 300) || String(p.title).replace(/^File:/, '').replace(/[_-]/g, ' ').replace(/\.[a-z]+$/i, ''),
        credit: stripHtml(md.Artist?.value || 'Wikimedia Commons').slice(0, 80), license: stripHtml(md.LicenseShortName?.value || ''), pageUrl: ii.descriptionurl || '',
      };
    })
    .filter(Boolean) as Omit<Picture, 'category'>[];
  if (out.length) await cacheSet(ck, out);
  return out;
}

export async function nextPicture(categoryLabel?: string): Promise<Picture> {
  const recent = await recentKeys(60);
  const cats = categoryLabel ? PICTURE_CATEGORIES.filter((c) => c.label === categoryLabel || c.id === categoryLabel) : PICTURE_CATEGORIES;
  const cat = cats[0] || PICTURE_CATEGORIES[Math.floor(Math.random() * PICTURE_CATEGORIES.length)];
  const queries = [...cat.queries].sort(() => Math.random() - 0.5);
  for (const q of queries) {
    try {
      const list = await searchCommons(q);
      const fresh = list.filter((p) => !recent.has('pic:' + p.url));
      if (fresh.length) {
        const pick = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
        return { ...pick, category: cat.label };
      }
    } catch { /* try next query */ }
  }
  throw new Error('Could not load a picture. Check your internet connection and try again.');
}

export async function markPictureUsed(p: Picture) { await markUsed('pic:' + p.url); }

/** Downloads a small version of the image for Gemini vision analysis (optional). */
export async function pictureForAI(p: Picture): Promise<{ mime: string; base64: string } | undefined> {
  const small = p.thumb.replace(/\/\d+px-/, '/512px-');
  try {
    if (isNative()) {
      const r = await CapacitorHttp.request({ url: small, method: 'GET', responseType: 'blob' as any });
      if (typeof r.data === 'string') return { mime: 'image/jpeg', base64: r.data };
      return undefined;
    }
    const res = await fetch(small);
    if (!res.ok) return undefined;
    const b = await res.blob();
    if (b.size > 1_500_000) return undefined;
    return { mime: b.type || 'image/jpeg', base64: await blobToBase64(b) };
  } catch { return undefined; }
}
