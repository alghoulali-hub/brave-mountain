// Phone notifications: turn on/off for this phone and keep the subscription saved.
import { sb, state, render, toast, friendly, kid } from './core.js';

const VAPID = (window.BRAVE_CONFIG && window.BRAVE_CONFIG.vapid) || '';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID;

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.ready; } catch { return null; }
}

async function save(sub) {
  const j = sub.toJSON();
  const row = { family_id: state.profile.family_id, role: state.profile.role, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
  const { error } = await sb.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
  return error;
}

// Work out what to show: 'unsupported' | 'install' | 'denied' | 'on' | 'off'
export async function refreshPushStatus() {
  let s;
  if (isIOS() && !isStandalone()) s = 'install';
  else if (!supported()) s = 'unsupported';
  else if (Notification.permission === 'denied') s = 'denied';
  else {
    const reg = await registration();
    const sub = reg && await reg.pushManager.getSubscription();
    s = sub && Notification.permission === 'granted' ? 'on' : 'off';
    // keep the saved copy in step (e.g. after the phone renewed it)
    if (s === 'on' && state.profile) { const err = await save(sub); if (err) s = 'off'; }
  }
  state.ui.push = s;
  render();
  return s;
}

export async function enablePush() {
  if (!supported()) return toast(isIOS() ? 'Add the app to your Home Screen first, then open it from there.' : 'This browser cannot show notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { await refreshPushStatus(); return toast('Notifications were not allowed. You can allow them in the phone settings.'); }
  const reg = await registration();
  if (!reg) return toast('Please reload the app and try again.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
  let err = await save(sub);
  if (err) {
    // this phone was saved for someone else before: get a fresh subscription for this person
    try { await sub.unsubscribe(); } catch {}
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
    err = await save(sub);
  }
  if (err) { toast(friendly(err.message)); return; }
  await refreshPushStatus();
  toast('Notifications are on for this phone');
}

export async function disablePush(quiet = false) {
  try {
    const reg = await registration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      if (state.profile) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {}
  state.ui.push = 'off';
  if (!quiet) { render(); toast('Notifications are off for this phone'); }
}

export function pushCard(who) {
  const s = state.ui.push;
  if (!s || s === 'unsupported') return '';
  const kidView = who === 'child';
  if (s === 'on') return kidView ? '' : `<section class="card"><span class="h3">Notifications</span><span class="small muted">On for this phone. You'll hear about hearts, fear ratings, brave steps, prize claims, worries and Calm Corner use.</span><button class="btn sm ghost" data-act="pushOff">Turn off on this phone</button></section>`;
  if (s === 'install') return `<section class="card ${kidView ? 'soft' : ''}"><span class="h3">Get notifications</span><span class="small muted">On iPhone, notifications only work from the Home Screen app: tap Share → "Add to Home Screen", then open Brave Mountain from the new icon.</span></section>`;
  if (s === 'denied') return kidView ? '' : `<section class="card"><span class="h3">Notifications are blocked</span><span class="small muted">Allow them in the phone's Settings → Notifications → Brave Mountain (or the browser's site settings).</span></section>`;
  return `<section class="card ${kidView ? 'soft' : ''}"><span class="h3">${kidView ? 'Want to know when you get points or hearts?' : 'Turn on notifications'}</span>
    <span class="small muted">${kidView ? 'Get a message when you earn points or get a heart.' : `Get a message when ${kid()} rates his fear, finishes a brave step, sends a heart, claims a prize or uses the Calm Corner.`}</span>
    <button class="btn sm primary" data-act="pushOn">Turn on notifications</button></section>`;
}

export const pushActions = {
  pushOn: () => enablePush(),
  pushOff: () => disablePush()
};
