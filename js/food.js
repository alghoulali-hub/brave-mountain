// Healthy eating: Taym's Food tab, the parents' food card and the private weight log.
// Habits earn points. Weight is for parents only and is never linked to points.
import { sb, state, esc, P, kid, today, addDays, localDay, sum, render, toast, run, logsFor, loadAll } from './core.js';
import { ic } from './icons.js';

export const GROUPS = [
  ['veg', 'Vegetables', '🥦'], ['fruit', 'Fruit', '🍎'], ['protein', 'Protein', '🍗'],
  ['grains', 'Bread, rice, pasta', '🍞'], ['dairy', 'Milk, yogurt, cheese', '🥛'], ['water', 'Water', '💧'], ['treat', 'A treat', '🍪']
];
const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snack']];
const emoji = g => (GROUPS.find(x => x[0] === g) || [, , ''])[2];
const balanced = gs => (gs.includes('veg') || gs.includes('fruit')) && gs.includes('protein');
export const foodMissions = () => state.d.missions.filter(m => m.kind === 'food' && m.active);
const ui = () => (state.ui.food ||= { meal: defaultMeal(), groups: [] });
function defaultMeal() { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }
const reload = async () => { await loadAll(); render(); };

// ───────── Taym ─────────
export function childFoodView() {
  const u = ui();
  const t = today();
  const plates = (state.d.meals || []).filter(m => m.day === t).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const balancedToday = plates.filter(p => balanced(p.groups)).length;
  const missions = foodMissions().map(m => {
    const log = logsFor(m)[0];
    const cls = !log ? '' : log.status === 'approved' ? 'ok' : log.status === 'pending' ? 'pending' : '';
    return `<button class="list-item" style="border:none;width:100%;text-align:left" data-act="toggleRoutine" data-m="${m.id}" aria-pressed="${!!log}">
      <span class="check ${cls}">${log ? ic.check(20, log.status === 'approved' ? 'var(--ink)' : 'var(--sun-ink)') : ''}</span>
      <span class="grow col tight"><span class="bold">${esc(m.title)}</span><span class="small muted">${!log ? `+${m.points}` : log.status === 'approved' ? `Approved · +${m.points}` : `Waiting for ${esc(P())}`}</span></span>
    </button>`;
  }).join('');
  const picked = u.groups;
  return `<div class="screen">
    <header class="row between"><div class="col tight"><span class="h1">Healthy food</span><span class="small muted bold">Food is fuel for brave climbers.</span></div>
      <div class="points-pill">${ic.star()}<span>${state.d.balance}</span></div></header>
    <section class="card">
      <span class="h3">My plate</span>
      <div class="seg">${MEALS.map(([k, l]) => `<button data-act="foodMeal" data-v="${k}" class="${u.meal === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <span class="small muted bold">Tap what's on your plate</span>
      <div class="grid2">${GROUPS.map(([k, l, e]) => {
        const on = picked.includes(k);
        return `<button class="choice ${on ? 'on teal' : ''}" style="flex-direction:row;justify-content:flex-start;gap:10px;padding:0 12px;min-height:54px" data-act="foodGroup" data-v="${k}" aria-pressed="${on}">
          <span style="font-size:24px" aria-hidden="true">${e}</span><span style="text-align:left">${l}</span></button>`;
      }).join('')}</div>
      <div class="row" style="background:${balanced(picked) ? 'var(--teal-soft)' : 'var(--soft)'};border-radius:14px;padding:10px 12px">
        <span class="small bold">${balanced(picked) ? 'Balanced plate! +3 points' : 'A fruit or vegetable + a protein = balanced plate (+3)'}</span></div>
      <button class="btn teal block" data-act="savePlate" ${picked.length ? '' : 'disabled'}>Save my plate</button>
      <span class="tiny muted">Up to 3 balanced plates a day earn points. Treats are fine too. There are no bad foods here.</span>
    </section>
    ${plates.length ? `<section class="card"><div class="row between"><span class="h3">Today's plates</span><span class="small bold" style="color:var(--teal)">${balancedToday} balanced</span></div>
      ${plates.map(p => `<div class="row"><span class="small bold" style="width:80px">${(MEALS.find(m => m[0] === p.meal) || [, p.meal])[1]}</span>
        <span class="grow" style="font-size:22px;letter-spacing:2px" aria-label="${esc(p.groups.join(', '))}">${p.groups.map(emoji).join('')}</span>
        ${balanced(p.groups) ? ic.star(18) : ''}
        <button class="icon-btn" style="background:var(--soft);width:36px;height:36px" data-act="delPlate" data-p="${p.id}" aria-label="Remove this plate">${ic.close(16)}</button></div>`).join('')}
    </section>` : ''}
    <section class="col" style="gap:10px"><h2 class="h2">Food missions</h2>
      ${missions || '<div class="empty">No food missions yet</div>'}</section>
  </div>`;
}

// ───────── Parents: Today card ─────────
export function parentFoodCard(day) {
  const fm = foodMissions();
  if (!fm.length) return '';
  const t = day || today();
  const plates = (state.d.meals || []).filter(m => m.day === t);
  const pending = fm.flatMap(m => logsFor(m, t).filter(l => l.status === 'pending'));
  const rows = fm.map(m => {
    const l = logsFor(m, t)[0];
    return `<div class="row"><span class="grow small bold">${esc(m.title)}</span>
      ${!l ? `<button class="btn sm ghost" data-act="routineMark" data-m="${m.id}">Mark done</button>` :
        l.status === 'pending' ? `<button class="btn sm teal" data-act="approveLog" data-l="${l.id}">Approve +${m.points}</button>` :
        `<span class="small bold" style="color:var(--teal)">✓ +${m.points}</span>`}</div>`;
  }).join('');
  return `<section class="card"><div class="row between"><span class="h3">Healthy food</span>${pending.length > 1 ? `<button class="btn sm teal" data-act="approveAll">Approve all</button>` : ''}</div>
    ${plates.length ? `<span class="small muted">Plates: ${plates.map(p => p.groups.map(emoji).join('')).join('  ·  ')}</span>` : `<span class="small muted">No plates logged that day.</span>`}
    ${rows}</section>`;
}

// ───────── Parents: Progress section ─────────
export function parentHealthSection(fromDate) {
  const meals = (state.d.meals || []).filter(m => m.day >= fromDate);
  const fm = foodMissions();
  const ids = new Set(fm.map(m => m.id));
  const doneLogs = state.d.logs.filter(l => ids.has(l.mission_id) && l.status === 'approved' && l.log_date >= fromDate);
  const bal = meals.filter(m => balanced(m.groups)).length;
  const fv = meals.filter(m => m.groups.includes('veg') || m.groups.includes('fruit')).length;
  const byMission = fm.map(m => [m.title, doneLogs.filter(l => l.mission_id === m.id).length]);
  const maxM = Math.max(1, ...byMission.map(x => x[1]));

  const w = [...(state.d.weights || [])].sort((a, b) => a.day.localeCompare(b.day));
  const last = w.slice(-12);
  let chart = '<div class="empty">Add a weight to start the chart.</div>';
  if (last.length) {
    const vals = last.map(x => +x.kg); const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
    const W = 318, H = 120, x0 = 16, x1 = 302;
    const X = i => last.length === 1 ? (x0 + x1) / 2 : x0 + i * (x1 - x0) / (last.length - 1);
    const Y = v => 10 + (hi - v) / (hi - lo) * 90;
    chart = `<svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight entries: ${last.map(x => x.kg + ' kg').join(', ')}">
      <line x1="0" y1="100" x2="${W}" y2="100" stroke="#E3E6F0"/>
      ${last.length > 1 ? `<polyline points="${last.map((x, i) => `${X(i).toFixed(1)},${Y(+x.kg).toFixed(1)}`).join(' ')}" fill="none" stroke="#3A4FD8" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
      ${last.map((x, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(+x.kg).toFixed(1)}" r="4" fill="#3A4FD8"/>`).join('')}
      <text x="2" y="${H - 4}" font-size="11" fill="#4B5575">${esc(last[0].day)}</text>
      <text x="${W - 2}" y="${H - 4}" text-anchor="end" font-size="11" fill="#4B5575">${esc(last[last.length - 1].day)} · ${last[last.length - 1].kg} kg</text></svg>`;
  }
  return `<section class="card"><span class="h3">Healthy eating</span>
      <div class="grid2">
        <div class="col tight"><span class="tiny bold muted">Plates logged</span><span class="display" style="font-size:24px">${meals.length}</span></div>
        <div class="col tight"><span class="tiny bold muted">Balanced plates</span><span class="display" style="font-size:24px">${bal}</span></div>
        <div class="col tight"><span class="tiny bold muted">With fruit or veg</span><span class="display" style="font-size:24px">${meals.length ? Math.round(100 * fv / meals.length) + '%' : '–'}</span></div>
        <div class="col tight"><span class="tiny bold muted">Food missions done</span><span class="display" style="font-size:24px">${doneLogs.length}</span></div>
      </div>
      ${byMission.map(([t, n]) => `<div class="row"><span class="small bold grow">${esc(t)}</span><div class="bar" style="width:90px;height:10px"><div style="width:${Math.round(100 * n / maxM)}%;background:var(--teal)"></div></div><span class="small bold" style="width:18px">${n}</span></div>`).join('')}
    </section>
    <section class="card"><div class="col tight"><span class="h3">Weight log (private)</span>
      <span class="small muted">Only parents see this. ${esc(kid())} never sees it, and it never earns or costs points. Every 2–4 weeks is enough. With ${esc(kid())}, talk about habits, not weight.</span></div>
      ${chart}
      <div class="row wrap" style="gap:8px">
        <input class="input" id="w-day" type="date" value="${today()}" style="width:auto" aria-label="Date">
        <input class="input" id="w-kg" type="number" inputmode="decimal" step="0.1" placeholder="kg" style="width:90px" aria-label="Weight in kg">
        <input class="input" id="w-cm" type="number" inputmode="decimal" step="0.5" placeholder="cm (optional)" style="width:130px" aria-label="Height in cm">
        <button class="btn sm primary" data-act="addWeight">Add</button></div>
      ${w.slice(-5).reverse().map(x => `<div class="row small"><span class="grow bold">${esc(x.day)}</span><span>${x.kg} kg${x.height_cm ? ` · ${x.height_cm} cm` : ''}</span>
        <button class="icon-btn" style="background:var(--soft);width:36px;height:36px" data-act="delWeight" data-w="${x.id}" aria-label="Delete entry">${ic.trash(16)}</button></div>`).join('')}
    </section>`;
}

export function foodReportLines(fromDate) {
  const meals = (state.d.meals || []).filter(m => m.day >= fromDate);
  const lines = ['', `Healthy eating: ${meals.length} plates logged, ${meals.filter(m => balanced(m.groups)).length} balanced, ${meals.filter(m => m.groups.includes('veg') || m.groups.includes('fruit')).length} with fruit or vegetables.`];
  const ids = new Set(foodMissions().map(m => m.id));
  const done = state.d.logs.filter(l => ids.has(l.mission_id) && l.status === 'approved' && l.log_date >= fromDate).length;
  lines.push(`Food missions completed: ${done}.`);
  const w = [...(state.d.weights || [])].sort((a, b) => a.day.localeCompare(b.day));
  if (w.length) lines.push('Weight log: ' + w.slice(-6).map(x => `${x.day} ${x.kg} kg${x.height_cm ? ` / ${x.height_cm} cm` : ''}`).join('; '));
  return lines;
}

export const foodActions = {
  foodMeal: el => { ui().meal = el.dataset.v; render(); },
  foodGroup: el => { const u = ui(); const g = el.dataset.v; u.groups = u.groups.includes(g) ? u.groups.filter(x => x !== g) : [...u.groups, g]; render(); },
  async savePlate() {
    const u = ui(); if (!u.groups.length) return;
    const isBal = balanced(u.groups);
    const earnedToday = (state.d.events || []).filter(e => e.ref && e.ref.startsWith('plate:') && localDay(e.created_at) === today()).length;
    await run(sb.from('meals').insert({ family_id: state.profile.family_id, day: today(), meal: u.meal, groups: u.groups }));
    u.groups = [];
    toast(isBal ? (earnedToday < 3 ? 'Balanced plate! +3 points' : 'Balanced plate! Great choices') : 'Plate saved. Try adding a fruit or vegetable next time!');
    await reload();
  },
  async delPlate(el) { await run(sb.from('meals').delete().eq('id', el.dataset.p)); await reload(); },
  async addWeight() {
    const kg = parseFloat(document.getElementById('w-kg')?.value), cm = parseFloat(document.getElementById('w-cm')?.value);
    const day = document.getElementById('w-day')?.value || today();
    if (!(kg >= 10 && kg <= 200)) return toast('Enter a weight in kg');
    await run(sb.from('weights').insert({ family_id: state.profile.family_id, day, kg, height_cm: cm >= 80 && cm <= 220 ? cm : null }), 'Saved (private)');
    await reload();
  },
  async delWeight(el) { await run(sb.from('weights').delete().eq('id', el.dataset.w)); await reload(); }
};
