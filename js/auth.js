import { sb, state, esc, render, toast, friendly, KID_DOMAIN, loadProfile, loadAll, subscribe } from './core.js';
import { ic } from './icons.js';

const ui = () => (state.ui.auth ||= { who: 'parent', mode: 'signin' });
const val = id => (document.getElementById(id)?.value || '').trim();

function brand() {
  return `<div class="col center" style="align-items:center;gap:10px;margin:24px 0 8px">
    <div style="width:76px;height:76px;border-radius:24px;background:var(--primary);display:flex;align-items:center;justify-content:center">${ic.flag(40, '#fff')}</div>
    <div class="h1">Brave Mountain</div>
    <div class="muted small">One brave step at a time</div>
  </div>`;
}

export function authView() {
  const a = ui();
  let body = '';
  if (a.who === 'kid') {
    body = `
      <div class="field"><label for="k-user">Your username</label><input class="input" id="k-user" autocomplete="username" autocapitalize="none" placeholder="taym"></div>
      <div class="field"><label for="k-pass">Your password</label><input class="input" id="k-pass" type="password" autocomplete="current-password"></div>
      <button class="btn primary block" data-act="kidSignIn">Let's go!</button>
      <p class="muted small center">Your ${'parent'} makes your username in their app (Settings).</p>`;
  } else if (a.mode === 'signin') {
    body = `
      <div class="field"><label for="p-email">Email</label><input class="input" id="p-email" type="email" autocomplete="email"></div>
      <div class="field"><label for="p-pass">Password</label><input class="input" id="p-pass" type="password" autocomplete="current-password"></div>
      <button class="btn primary block" data-act="parentSignIn">Sign in</button>
      <button class="btn ghost block" data-act="authMode" data-mode="signup">Create a family account</button>
      <button class="btn ghost block" data-act="authMode" data-mode="join">I have a family code</button>`;
  } else {
    const join = a.mode === 'join';
    body = `
      <div class="field"><label for="p-name">Your name</label><input class="input" id="p-name" autocomplete="name"></div>
      ${join ? `<div class="field"><label for="p-code">Family code</label><input class="input" id="p-code" autocapitalize="characters" placeholder="ABC123"></div>` : `
      <div class="field"><label>${'In the app, Taym calls you'}</label>
        <div class="seg" role="radiogroup">
          <button type="button" data-act="pickLabel" data-v="Mom" class="${(a.label || 'Mom') === 'Mom' ? 'on' : ''}">Mom</button>
          <button type="button" data-act="pickLabel" data-v="Dad" class="${a.label === 'Dad' ? 'on' : ''}">Dad</button>
        </div></div>
      <div class="field"><label for="p-child">Child's name</label><input class="input" id="p-child" value="Taym"></div>`}
      <div class="field"><label for="p-email">Email</label><input class="input" id="p-email" type="email" autocomplete="email"></div>
      <div class="field"><label for="p-pass">Password (6+ characters)</label><input class="input" id="p-pass" type="password" autocomplete="new-password"></div>
      <button class="btn primary block" data-act="${join ? 'parentJoin' : 'parentSignUp'}">${join ? 'Join family' : 'Create account'}</button>
      <button class="btn ghost block" data-act="authMode" data-mode="signin">I already have an account</button>`;
  }
  return `<div class="screen">
    ${brand()}
    <div class="seg" role="tablist">
      <button data-act="authWho" data-who="parent" class="${a.who === 'parent' ? 'on' : ''}">I'm a parent</button>
      <button data-act="authWho" data-who="kid" class="${a.who === 'kid' ? 'on' : ''}">I'm Taym</button>
    </div>
    <div class="card">${body}</div>
  </div>`;
}

export function noProfileView() {
  return `<div class="screen">
    ${brand()}
    <div class="card">
      <div class="h3">Almost there</div>
      <p class="muted small" style="margin:0">Your login works, but it isn't linked to a family yet.</p>
      <div class="field"><label for="p-name">Your name</label><input class="input" id="p-name"></div>
      <div class="field"><label for="p-code">Family code (if another parent invited you)</label><input class="input" id="p-code" placeholder="Leave empty to start a new family"></div>
      <button class="btn primary block" data-act="finishSetup">Continue</button>
      <button class="btn ghost block" data-act="signOut">Sign out</button>
    </div>
  </div>`;
}

async function afterSignIn() {
  await loadProfile();
  if (state.profile) { await loadAll(); subscribe(); state.tab = null; import('./push.js').then(m => m.refreshPushStatus()); }
  render();
}

export const authActions = {
  authWho: el => { ui().who = el.dataset.who; render(); },
  authMode: el => { ui().mode = el.dataset.mode; render(); },
  pickLabel: el => { ui().label = el.dataset.v; render(); },
  async kidSignIn() {
    const u = val('k-user').toLowerCase().replace(/\s+/g, ''), p = document.getElementById('k-pass').value;
    if (!u || !p) return toast('Type your username and password');
    const { error } = await sb.auth.signInWithPassword({ email: `${u}@${KID_DOMAIN}`, password: p });
    if (error) return toast(friendly(error.message));
    await afterSignIn();
  },
  async parentSignIn() {
    const { error } = await sb.auth.signInWithPassword({ email: val('p-email'), password: document.getElementById('p-pass').value });
    if (error) return toast(friendly(error.message));
    await afterSignIn();
  },
  async parentSignUp() {
    const name = val('p-name'), child = val('p-child') || 'Taym', label = ui().label || 'Mom';
    const { data, error } = await sb.auth.signUp({ email: val('p-email'), password: document.getElementById('p-pass').value });
    if (error) return toast(friendly(error.message));
    if (!data.session) return toast('Check your email to confirm, then sign in.');
    const r = await sb.rpc('create_family', { p_parent_name: name, p_parent_label: label, p_child_name: child });
    if (r.error) return toast(friendly(r.error.message));
    await afterSignIn();
    toast('Welcome! Start with Settings to make Taym’s login.');
  },
  async parentJoin() {
    const name = val('p-name'), code = val('p-code');
    if (!code) return toast('Enter the family code');
    const { data, error } = await sb.auth.signUp({ email: val('p-email'), password: document.getElementById('p-pass').value });
    if (error) return toast(friendly(error.message));
    if (!data.session) return toast('Check your email to confirm, then sign in.');
    const r = await sb.rpc('join_family', { p_code: code, p_name: name });
    if (r.error) return toast(friendly(r.error.message));
    await afterSignIn();
  },
  async finishSetup() {
    const name = val('p-name'), code = val('p-code');
    const r = code ? await sb.rpc('join_family', { p_code: code, p_name: name })
                   : await sb.rpc('create_family', { p_parent_name: name, p_parent_label: 'Mom', p_child_name: 'Taym' });
    if (r.error) return toast(friendly(r.error.message));
    await afterSignIn();
  }
};
