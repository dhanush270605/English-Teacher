import { render } from 'preact';
import { App } from './app';
import './styles/app.css';

render(<App />, document.getElementById('app')!);

// Offline app shell for the browser/PWA build (the Android app bundles files locally already).
if ('serviceWorker' in navigator && location.protocol === 'https:' && !(window as any).Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
