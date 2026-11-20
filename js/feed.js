// Activity feed: everything that happened, newest first, with an unread count on the bell.
import { state, esc, kid, today, addDays, localDay, render, openModal, closeModal } from './core.js';
import { ic } from './icons.js';

const seenKey = () => `brave-feed-seen-${state.session?.user?.id || 'x'}`;
const myRole = () => state.profile?.role;
const mine = a => a.to_role === myRole();
const items = () => state.d?.activity || [];

export function unreadCount() {
  const seen = localStorage.getItem(seenKey()) || '';
  return items().filter(a => mine(a) && a.created_at > seen).length;
}

export function bellButton(light = false) {
  const n = unreadCount();
  return `<button class="icon-btn" style="position:relative;${light ? 'background:rgba(255,255,255,.12);color:#fff' : ''}" data-act="openFeed" aria-label="Activity${n ? `, ${n} new` : ''}">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
    ${n ? `<span style="position:absolute;top:-4px;right:-4px;background:var(--rose);color:#fff;font-size:11px;font-weight:800;border-radius:999px;min-width:18px;height:18px;padding:0 5px;display:flex;align-items:center;justify-content:center">${n > 9 ? '9+' : n}</span>` : ''}
  </button>`;
}

const tabIcon = (tab, c) => ({
  mountain: ic.mountain(18, c), today: ic.today(18, c), rewards: ic.gift(18, c), gifts: ic.gift(18, c),
  plan: ic.box(18, c), progress: ic.chart(18, c), calm: ic.heart(18, c)
}[tab] || ic.star(18));

function dayHeading(d) {
  if (d === today()) return 'Today';
  if (d === addDays(today(), -1)) return 'Yesterday';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function feedModal(m) {
  const parent = myRole() === 'parent';
  const filter = m.filter || 'all';
  const seen = m.seenBefore || '';
  let list = items();
  if (!parent) list = list.filter(mine);
  else if (filter === 'me') list = list.filter(a => a.to_role === 'parent');
  else if (filter === 'kid') list = list.filter(a => a.to_role === 'child');
  let lastDay = '';
  const rows = list.map(a => {
    const d = localDay(a.created_at);
    const head = d !== lastDay ? `<span class="small bold muted" style="margin-top:6px">${dayHeading(d)}</span>` : '';
    lastDay = d;
    const isNew = mine(a) && a.created_at > seen;
    const forKid = parent && a.to_role === 'child';
    return `${head}<button class="list-item" style="border:none;width:100%;text-align:left;align-items:flex-start;${isNew ? 'background:var(--primary-tint)' : ''}" data-act="feedGo" data-tab="${esc(a.tab || '')}">
      <span class="ico" style="background:${forKid ? 'var(--sun-soft)' : 'var(--primary-soft)'};width:36px;height:36px">${tabIcon(a.tab, forKid ? 'var(--sun-ink)' : 'var(--primary)')}</span>
      <span class="grow col tight"><span class="bold" style="font-size:15px">${esc(a.title)}</span>${a.body ? `<span class="small muted">${esc(a.body)}</span>` : ''}
        <span class="tiny muted">${new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${forKid ? ` · sent to ${esc(kid())}` : ''}${isNew ? ' · <b style="color:var(--primary)">new</b>' : ''}</span></span>
    </button>`;
  }).join('');
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="Activity">
    <div class="row between"><span class="h2">${parent ? 'Activity' : 'What happened'}</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
    ${parent ? `<div class="seg">${[['all', 'Everything'], ['me', 'For me'], ['kid', `For ${esc(kid())}`]].map(([k, l]) => `<button data-act="feedFilter" data-v="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <div class="col" style="gap:8px">${rows || `<div class="empty">Nothing yet. ${parent ? 'Approvals, brave steps, hearts and prizes will show up here.' : 'Your points, hearts and prizes will show up here.'}</div>`}</div>
  </div>`;
}

export const feedActions = {
  openFeed: () => {
    const seenBefore = localStorage.getItem(seenKey()) || '';
    localStorage.setItem(seenKey(), new Date().toISOString());
    openModal('feed', { seenBefore, filter: 'all' });
  },
  feedFilter: el => { state.modal.filter = el.dataset.v; render(); },
  feedGo: el => {
    const t = el.dataset.tab;
    const parent = myRole() === 'parent';
    const valid = parent ? ['today', 'plan', 'progress', 'gifts', 'settings'] : ['mountain', 'calm', 'food', 'rewards', 'tonight'];
    closeModal();
    if (t && valid.includes(t)) { state.tab = t; render(); window.scrollTo(0, 0); }
  }
};
