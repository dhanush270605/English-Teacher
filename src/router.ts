import { useEffect, useState } from 'preact/hooks';

export interface Route { path: string; parts: string[]; query: URLSearchParams }

export function parse(hash = location.hash): Route {
  const raw = hash.replace(/^#/, '') || '/home';
  const [p, q] = raw.split('?');
  const path = p.startsWith('/') ? p : '/' + p;
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q || '') };
}

export function go(to: string) {
  const h = to.startsWith('#') ? to : '#' + to;
  if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = h;
}

export function back() {
  if (history.length > 1) history.back(); else go('#/home');
}

export function useRoute(): Route {
  const [r, setR] = useState(parse());
  useEffect(() => {
    const f = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
