// Boot: read the Supabase settings, then start the app.
const saved = (() => { try { return JSON.parse(localStorage.getItem('brave-config') || 'null'); } catch { return null; } })();
const params = new URLSearchParams(location.search);
if (params.has('setup')) { localStorage.removeItem('brave-config'); }
if (!window.BRAVE_CONFIG?.url && saved?.url && !params.has('setup')) window.BRAVE_CONFIG = saved;

const root = document.getElementById('app');

if (!window.BRAVE_CONFIG?.url || !window.BRAVE_CONFIG?.key) {
  root.innerHTML = `<div class="screen"><div class="col center" style="align-items:center;margin:30px 0 10px"><div class="h1">Connect to Supabase</div><div class="muted small">One-time setup on this phone</div></div>
    <div class="card">
      <div class="field"><label for="c-url">Project URL</label><input class="input" id="c-url" placeholder="https://xxxx.supabase.co" autocapitalize="none"></div>
      <div class="field"><label for="c-key">Publishable (anon) key</label><input class="input" id="c-key" autocapitalize="none"></div>
      <button class="btn primary block" id="c-save">Save and continue</button>
    </div></div>`;
  document.getElementById('c-save').onclick = () => {
    const url = document.getElementById('c-url').value.trim().replace(/\/$/, '');
    const key = document.getElementById('c-key').value.trim();
    if (!/^https:\/\//.test(url) || key.length < 20) return alert('Please paste the Project URL and key from Supabase → Project Settings → API.');
    localStorage.setItem('brave-config', JSON.stringify({ url, key }));
    location.href = location.pathname;
  };
} else {
  start();
}

async function start() {
  const core = await import('./core.js');
  const { state, sb, setRenderer, loadProfile, loadAll, subscribe, unsubscribe, scheduleReload, esc, toast } = core;
  const { authView, noProfileView, authActions } = await import('./auth.js');
  const { childView, childModal, childActions } = await import('./child.js');
  const { parentView, parentModal, parentActions, confirmText } = await import('./parent.js');
  const { pushActions, refreshPushStatus, disablePush } = await import('./push.js');
  const { foodActions } = await import('./food.js');
  const { lockActions, lockView, lockOnStart, watchVisibility } = await import('./lock.js');
  const { feedActions } = await import('./feed.js');

  const actions = {
    ...authActions, ...childActions, ...parentActions, ...pushActions, ...foodActions, ...lockActions, ...feedActions,
    tab: el => { state.tab = el.dataset.tab; state.modal = null; render(); window.scrollTo(0, 0); },
    closeModal: () => { state.modal = null; render(); },
    async pinForgot() { state.locked = false; state.ui.lock = null; await actions.signOut(); toast('Sign in with your email and password.'); },
    async signOut() { await disablePush(true); unsubscribe(); await sb.auth.signOut(); state.session = null; state.profile = null; state.family = null; state.d = null; state.tab = null; state.ui = {}; render(); }
  };

  let acting = false;
  // long step / mission / prize names: grow the box so the whole text shows
  const fitText = t => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 4) + 'px'; };
  document.addEventListener('input', ev => { if (ev.target.matches && ev.target.matches('textarea.step-text')) fitText(ev.target); });
  function render() {
    // keep what the person is typing when live updates re-draw the screen
    const keep = {};
    let focusId = null, selStart = null, selEnd = null;
    if (!acting) {
      root.querySelectorAll('input[id]:not([type=file]):not([type=checkbox]), textarea[id], select[id]').forEach(el => {
        if (el.value !== el.defaultValue) keep[el.id] = el.value;
      });
      const a = document.activeElement;
      if (a && a.id && root.contains(a)) { focusId = a.id; try { selStart = a.selectionStart; selEnd = a.selectionEnd; } catch {} }
    }
    const modalEl = root.querySelector('.modal'); const modalScroll = modalEl ? modalEl.scrollTop : 0;

    let html;
    if (!state.session) html = authView();
    else if (!state.profile) html = noProfileView();
    else if (!state.d) html = `<div class="loading">Loading…</div>`;
    else if (state.locked && state.profile.role === 'parent') html = lockView();
    else html = state.profile.role === 'parent' ? parentView() : childView();

    if (state.modal && state.d && !state.locked) {
      const m = state.profile.role === 'parent' ? parentModal(state.modal) : childModal(state.modal);
      if (m) html += `<div class="modal-back" data-backdrop="1">${m}</div>`;
    }
    if (state.toast) html += `<div class="toast" role="status">${esc(state.toast)}</div>`;
    root.innerHTML = `<div class="app">${html}</div>`;

    Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus({ preventScroll: true }); try { if (selStart != null) el.setSelectionRange(selStart, selEnd); } catch {} } }
    root.querySelectorAll('textarea.step-text').forEach(fitText);
    const newModal = root.querySelector('.modal'); if (newModal && modalScroll) newModal.scrollTop = modalScroll;
  }
  setRenderer(render);

  async function perform(name, el, ev) {
    const fn = actions[name];
    if (!fn) return;
    if (state.locked && !['pinKey', 'pinForgot'].includes(name)) return;
    if (state.profile?.role === 'parent') {
      if (el.dataset.confirmed) state.modal = null;
      else { const c = confirmText(name, el); if (c) { state.modal = { kind: 'confirm', act: name, data: { ...el.dataset }, ...c }; render(); return; } }
    }
    if (el.tagName === 'BUTTON') el.disabled = true;
    acting = true;
    try { await fn(el, ev); } catch (e) { console.error(e); }
    finally { acting = false; if (el.isConnected && el.tagName === 'BUTTON') el.disabled = false; }
  }

  document.addEventListener('click', ev => {
    const back = ev.target.closest('[data-backdrop]');
    if (back && ev.target === back) { state.modal = null; render(); return; }
    const el = ev.target.closest('[data-act]');
    if (el && root.contains(el)) { ev.preventDefault(); perform(el.dataset.act, el, ev); }
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-change]');
    if (el) perform(el.dataset.change, el, ev);
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && state.modal) { state.modal = null; render(); }
    if (ev.key === 'Enter' && ev.target.matches('input')) {
      const btn = ev.target.closest('.row, .card')?.querySelector('[data-act]');
      if (btn && ['addWish', 'addAcc', 'kidSignIn', 'parentSignIn', 'bonusCustom', 'addWeight'].includes(btn.dataset.act)) { ev.preventDefault(); perform(btn.dataset.act, btn, ev); }
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.profile) scheduleReload(); });

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') { state.session = null; state.profile = null; state.d = null; render(); }
  });

  const startTab = params.get('tab');
  if (startTab) { state.tab = startTab; history.replaceState(null, '', location.pathname); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'open-tab' && e.data.tab) { state.tab = e.data.tab; state.modal = null; render(); }
    if (state.profile) scheduleReload();
  });

  render();
  await loadProfile();
  lockOnStart(); watchVisibility();
  if (state.profile) { render(); await loadAll(); subscribe(); refreshPushStatus(); }
  render();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
