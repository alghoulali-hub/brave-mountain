// Parent PIN lock. The PIN is kept (hashed) only on this phone. Forgetting it is fine:
// signing in again with the account password unlocks the app and lets you set a new PIN.
import { state, render, toast, esc } from './core.js';
import { ic } from './icons.js';

const AWAY_MS = 60 * 1000;     // lock again after 1 minute in the background
const key = () => `brave-pin-${state.session?.user?.id || 'x'}`;
let hiddenAt = 0;

function stored() { try { return JSON.parse(localStorage.getItem(key()) || 'null'); } catch { return null; } }
export const hasPin = () => state.profile?.role === 'parent' && !!stored();

async function hash(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function savePin(pin) {
  const salt = crypto.getRandomValues(new Uint32Array(4)).join('-');
  localStorage.setItem(key(), JSON.stringify({ salt, hash: await hash(pin, salt) }));
}
async function matches(pin) { const s = stored(); return !!s && (await hash(pin, s.salt)) === s.hash; }

export function lockOnStart() { state.locked = hasPin(); }
export function watchVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hasPin() && hiddenAt && Date.now() - hiddenAt > AWAY_MS) { state.locked = true; state.modal = null; render(); }
  });
}

// ───────── lock screen ─────────
const L = () => (state.ui.lock ||= { entry: '', fails: 0, until: 0, msg: '' });
export function lockView() {
  const l = L();
  const waiting = l.until > Date.now();
  const dots = [0, 1, 2, 3].map(i => `<span style="width:16px;height:16px;border-radius:999px;${i < l.entry.length ? 'background:var(--primary)' : 'border:2px solid #C5CDF5'}"></span>`).join('');
  const key = (v, label = v) => `<button class="choice" style="min-height:64px;font-family:var(--display);font-size:26px" data-act="pinKey" data-v="${v}" ${waiting ? 'disabled' : ''} aria-label="${label}">${v === 'del' ? '⌫' : v}</button>`;
  return `<div class="screen" style="align-items:center;justify-content:center;gap:22px;padding-bottom:40px">
    <div style="width:64px;height:64px;border-radius:20px;background:var(--primary);display:flex;align-items:center;justify-content:center">${ic.lock(30, '#fff')}</div>
    <div class="col center" style="align-items:center;gap:4px"><span class="h1">Parent area</span><span class="small muted bold">Enter your PIN</span></div>
    <div class="row" style="gap:14px" role="status" aria-label="${l.entry.length} of 4 digits entered">${dots}</div>
    <span class="small bold" style="min-height:20px;color:var(--rose)">${esc(waiting ? `Too many tries. Wait ${Math.ceil((l.until - Date.now()) / 1000)} seconds.` : l.msg)}</span>
    <div class="grid3" style="width:100%;max-width:300px;gap:10px">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(v => key(v)).join('')}
      <span></span>${key('0')}${key('del', 'Delete digit')}
    </div>
    <button class="btn ghost sm" data-act="pinForgot">Forgot PIN? Sign in with your password</button>
  </div>`;
}

export const lockActions = {
  async pinKey(el) {
    const l = L();
    if (l.until > Date.now()) return;
    const v = el.dataset.v;
    if (v === 'del') { l.entry = l.entry.slice(0, -1); l.msg = ''; render(); return; }
    if (l.entry.length >= 4) return;
    l.entry += v; l.msg = ''; render();
    if (l.entry.length === 4) {
      if (await matches(l.entry)) { state.locked = false; state.ui.lock = null; render(); return; }
      l.fails++; l.entry = '';
      if (l.fails >= 5) { l.until = Date.now() + 30000; l.fails = 0; setTimeout(render, 30200); }
      l.msg = 'Wrong PIN. Try again.'; render();
    }
  },
  async pinSet() {
    const a = document.getElementById('pin-new')?.value || '', b = document.getElementById('pin-again')?.value || '';
    if (!/^\d{4}$/.test(a)) return toast('Use 4 digits');
    if (a !== b) return toast("The two PINs don't match");
    if (hasPin()) {
      const cur = document.getElementById('pin-current')?.value || '';
      if (!(await matches(cur))) return toast('Current PIN is wrong');
    }
    await savePin(a); state.ui.pinForm = false; toast('PIN saved. The parent area is now locked when the app opens.'); render();
  },
  async pinRemove() {
    const cur = document.getElementById('pin-current')?.value || '';
    if (!(await matches(cur))) return toast('Enter your current PIN to remove it');
    localStorage.removeItem(key()); state.ui.pinForm = false; toast('PIN removed'); render();
  },
  pinForm: () => { state.ui.pinForm = !state.ui.pinForm; render(); },
  lockNow: () => { if (!hasPin()) return toast('Set a PIN first (Settings)'); state.locked = true; state.modal = null; render(); }
};

export function pinCard() {
  const on = hasPin();
  const form = state.ui.pinForm || !on;
  const pinInput = (id, label) => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" style="letter-spacing:.4em;font-size:20px;max-width:160px"></div>`;
  return `<section class="card"><span class="h3">PIN lock</span>
    <span class="small muted">${on ? 'On for this phone. The parent area asks for your PIN when the app opens, and after 1 minute in the background.' : "Lock the parent area on this phone with a 4-digit PIN, so Taym can't open it if he uses your phone."}</span>
    ${on && !state.ui.pinForm ? `<div class="grid2"><button class="btn sm primary" data-act="lockNow">${ic.lock(16, '#fff')} Lock now</button><button class="btn sm ghost" data-act="pinForm">Change or remove</button></div>` : ''}
    ${form ? `${on ? pinInput('pin-current', 'Current PIN') : ''}${pinInput('pin-new', on ? 'New PIN' : 'New PIN (4 digits)')}${pinInput('pin-again', 'Type it again')}
      <div class="row wrap" style="gap:8px"><button class="btn sm primary" data-act="pinSet">Save PIN</button>${on ? `<button class="btn sm danger" data-act="pinRemove">Remove PIN</button><button class="btn sm ghost" data-act="pinForm">Cancel</button>` : ''}</div>` : ''}
    <span class="tiny muted">Forgot it? On the lock screen, sign in again with your password. Tip: in the phone's notification settings you can hide previews on the lock screen.</span>
  </section>`;
}
