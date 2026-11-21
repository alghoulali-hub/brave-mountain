// Focus time: today's homework list and timed focus sprints with movement breaks.
import { sb, state, esc, P, kid, today, addDays, localDay, render, toast, run, loadAll, logsFor } from './core.js';
import { ic } from './icons.js';

const KEY = 'brave-focus-timer';
const MOVES = ['10 jumping jacks!', 'Get a glass of water', 'Stretch up high, touch your toes', 'Walk around the house once', '5 big balloon breaths', 'Shake out your arms and legs', 'Do 5 wall push-ups', 'Look out the window and find 3 things'];
const fm = () => state.family?.focus_minutes || 10;
const bm = () => state.family?.break_minutes || 3;
const timer = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const setTimer = t => { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); };
const tasksOn = d => (state.d.study || []).filter(t => t.day === d).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));
const sessionsOn = d => (state.d.focus || []).filter(s => localDay(s.started_at) === d);
const reload = async () => { await loadAll(); render(); };
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

// ───────── Taym: card on the Mountain screen ─────────
export function focusCard() {
  const t = today();
  const tasks = tasksOn(t), done = tasks.filter(x => x.done).length;
  const sprints = sessionsOn(t).filter(s => s.completed).length;
  const tm = timer();
  const running = tm && (tm.mode === 'sprint' || tm.mode === 'break') && tm.end > Date.now();
  return `<section class="card" style="flex-direction:row;align-items:center;gap:14px">
    <span style="font-size:34px" aria-hidden="true">📚</span>
    <div class="col tight grow"><span class="bold">Homework & focus</span>
      <span class="small muted bold">${running ? (tm.mode === 'sprint' ? 'Focus sprint running…' : 'Break time…') : `${tasks.length ? `${done} of ${tasks.length} tasks done · ` : ''}${sprints} sprint${sprints === 1 ? '' : 's'} today`}</span></div>
    <button class="btn sm primary" data-act="tab" data-tab="focus">${running ? 'Open' : 'Start'}</button>
  </section>`;
}

// ───────── Taym: Focus screen ─────────
export function focusView() {
  const t = today();
  const tasks = tasksOn(t);
  const sprints = sessionsOn(t).filter(s => s.completed);
  const tm = timer();
  const mode = tm?.mode || 'idle';
  const cur = state.ui.focusTask && tasks.find(x => x.id === state.ui.focusTask && !x.done) || tasks.find(x => !x.done) || null;
  const total = mode === 'break' ? bm() * 60000 : fm() * 60000;
  const left = tm?.end ? tm.end - Date.now() : total;
  const C = 2 * Math.PI * 88;
  const frac = mode === 'sprint' || mode === 'break' ? Math.max(0, Math.min(1, left / total)) : 1;
  const ringColor = mode === 'break' ? 'var(--teal)' : 'var(--primary)';
  let centre = '', buttons = '', note = '';
  if (mode === 'sprint') {
    centre = `<span class="display" id="focus-time" style="font-size:52px">${mmss(left)}</span><span class="small bold muted">Focus!</span>`;
    note = `<span class="bold center">${tm.task ? esc(tm.task) : 'Your homework'}</span>`;
    buttons = `<button class="btn ghost block" data-act="focusStop">Stop early</button>`;
  } else if (mode === 'break') {
    centre = `<span class="display" id="focus-time" style="font-size:52px;color:var(--teal)">${mmss(left)}</span><span class="small bold" style="color:var(--teal)">Break</span>`;
    note = `<div class="card soft center" style="align-items:center"><span class="bold">Sprint done! +3 ⭐</span><span class="small">Move your body: <b>${esc(tm.move || MOVES[0])}</b></span></div>`;
    buttons = `<button class="btn ghost block" data-act="focusSkipBreak">Skip break, start next sprint</button>`;
  } else if (mode === 'ready') {
    centre = `<span class="display" style="font-size:30px">Ready?</span><span class="small bold muted">Break is over</span>`;
    note = `<span class="bold center">Next: ${cur ? esc(cur.title) : 'your homework'}</span>`;
    buttons = `<button class="btn primary block" data-act="focusStart">Start ${fm()}-minute sprint</button><button class="btn ghost block" data-act="focusReset">I'm finished for today</button>`;
  } else {
    centre = `<span class="display" style="font-size:44px">${fm()}:00</span><span class="small bold muted">minutes</span>`;
    note = `<span class="small bold muted center">${fm()} min focus, then a ${bm()} min break</span>` + (cur ? `<span class="bold center">First: ${esc(cur.title)}</span>` : `<span class="small muted center">Add your homework below, then start.</span>`);
    buttons = `<button class="btn primary block" data-act="focusStart">Start ${fm()}-minute sprint</button>`;
  }
  return `<div class="screen">
    <header class="row between"><div class="row"><button class="icon-btn" data-act="tab" data-tab="mountain" aria-label="Back">${ic.back()}</button><span class="h1">Focus time</span></div>
      <span class="tag primary">${sprints.length} sprint${sprints.length === 1 ? '' : 's'} today</span></header>
    <section class="card" style="align-items:center;gap:12px">
      <div style="position:relative;width:200px;height:200px">
        <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88" fill="none" stroke="var(--soft)" stroke-width="14"/>
          <circle id="focus-ring" cx="100" cy="100" r="88" fill="none" stroke="${ringColor}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}" transform="rotate(-90 100 100)"/></svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center" role="timer" aria-live="off">${centre}</div>
      </div>
      ${note}
      ${buttons}
      <span class="tiny muted center">Keep the phone next to you, face up. The screen stays on during a sprint.</span>
    </section>
    <section class="col" style="gap:10px"><h2 class="h2">Today's homework</h2>
      <div class="row"><input class="input grow" id="study-new" maxlength="120" placeholder="e.g. Math page 12, questions 1–5" aria-label="New homework task"><button class="btn sm primary" data-act="studyAdd">Add</button></div>
      ${tasks.map(x => `<div class="list-item" style="${cur && cur.id === x.id && mode !== 'sprint' ? 'outline:2px solid var(--primary)' : ''}">
        <button class="check ${x.done ? 'ok' : ''}" data-act="studyToggle" data-t="${x.id}" aria-pressed="${x.done}" aria-label="Done: ${esc(x.title)}">${x.done ? ic.check(20, 'var(--ink)') : ''}</button>
        <button class="grow" style="border:none;background:none;text-align:left;padding:0" data-act="studyPick" data-t="${x.id}"><span class="bold" style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.title)}</span>
          ${!x.done && cur && cur.id === x.id ? '<br><span class="tiny bold" style="color:var(--primary)">Next sprint</span>' : ''}</button>
        <button class="icon-btn" style="background:var(--soft);width:36px;height:36px" data-act="studyDel" data-t="${x.id}" aria-label="Remove">${ic.close(16)}</button></div>`).join('') || '<div class="empty">No homework added yet</div>'}
      <span class="small muted">Small pieces work best: "questions 1–5" instead of "all of math". When everything is done, show ${esc(P())}: checked homework is worth +5.</span>
    </section>
  </div>`;
}

// keep the countdown moving without redrawing the whole screen
let ticker = null;
export function startTicker() {
  clearInterval(ticker);
  ticker = setInterval(tick, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
async function tick() {
  const tm = timer();
  if (!tm || !tm.end || !(tm.mode === 'sprint' || tm.mode === 'break')) return;
  const left = tm.end - Date.now();
  const el = document.getElementById('focus-time');
  if (el) {
    el.textContent = mmss(left);
    const total = (tm.mode === 'break' ? bm() : fm()) * 60000;
    const ring = document.getElementById('focus-ring');
    if (ring) { const C = 2 * Math.PI * 88; ring.setAttribute('stroke-dashoffset', (C * (1 - Math.max(0, left / total))).toFixed(1)); }
  }
  if (left > 0 || tm.finishing) return;
  if (tm.mode === 'sprint') {
    setTimer({ ...tm, finishing: true });
    try { await sb.from('focus_sessions').update({ completed: true }).eq('id', tm.sessionId); } catch {}
    buzz([200, 100, 200]);
    setTimer({ mode: 'break', end: Date.now() + bm() * 60000, move: MOVES[Math.floor(Math.random() * MOVES.length)] });
    toast('Sprint done! +3 points. Time for a break.');
    await reload();
  } else {
    buzz([300]);
    setTimer({ mode: 'ready' });
    keepAwake(false);
    render();
  }
}

// ───────── Parents: Homework card on Today ─────────
export function parentHomeworkCard(day) {
  const tasks = tasksOn(day);
  const ss = sessionsOn(day);
  const done = ss.filter(s => s.completed);
  const checked = (state.d.events || []).some(e => e.ref === 'homework:' + day);
  if (!tasks.length && !ss.length) return `<section class="card"><div class="row between"><span class="h3">📚 Homework & focus</span></div>
    <span class="small muted">No homework added for this day. You or ${esc(kid())} can add tasks; ${esc(kid())} runs ${fm()}-minute focus sprints on his phone.</span>
    <div class="row"><input class="input grow" id="p-study-new" maxlength="120" placeholder="Add a homework task" aria-label="New homework task"><button class="btn sm primary" data-act="studyAddParent">Add</button></div></section>`;
  return `<section class="card"><div class="row between"><span class="h3">📚 Homework & focus</span><span class="small muted bold">${done.length} sprint${done.length === 1 ? '' : 's'} · ${done.reduce((a, s) => a + s.minutes, 0)} min</span></div>
    ${tasks.map(x => `<div class="row"><button class="check ${x.done ? 'ok' : ''}" style="width:36px;height:36px" data-act="studyToggle" data-t="${x.id}" aria-label="Done: ${esc(x.title)}">${x.done ? ic.check(16, 'var(--ink)') : ''}</button><span class="grow small bold" style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.title)}</span>
      <button class="icon-btn" style="background:var(--soft);width:32px;height:32px" data-act="studyDel" data-t="${x.id}" aria-label="Remove">${ic.close(14)}</button></div>`).join('')}
    <div class="row"><input class="input grow" id="p-study-new" maxlength="120" placeholder="Add a homework task" aria-label="New homework task"><button class="btn sm ghost" data-act="studyAddParent">Add</button></div>
    ${ss.length > done.length ? `<span class="tiny muted">${ss.length - done.length} sprint${ss.length - done.length === 1 ? '' : 's'} stopped early (no points).</span>` : ''}
    ${checked ? `<span class="small bold" style="color:var(--teal)">✓ Homework checked · +5</span>` : `<button class="btn sm teal" data-act="homeworkChecked" data-day="${day}">Homework checked ✓ +5</button>`}
  </section>`;
}

export function focusProgress(fromDate) {
  const ss = (state.d.focus || []).filter(s => s.completed && localDay(s.started_at) >= fromDate);
  const days = {}; ss.forEach(s => { const d = localDay(s.started_at); days[d] = (days[d] || 0) + s.minutes; });
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today(), -6 + i));
  const max = Math.max(10, ...last7.map(d => days[d] || 0));
  return `<section class="card"><span class="h3">Focus time</span>
    <div class="grid2"><div class="col tight"><span class="tiny bold muted">Sprints finished</span><span class="display" style="font-size:24px">${ss.length}</span></div>
      <div class="col tight"><span class="tiny bold muted">Minutes of focus</span><span class="display" style="font-size:24px">${ss.reduce((a, s) => a + s.minutes, 0)}</span></div></div>
    <div class="row" style="align-items:flex-end;gap:8px;height:80px" role="img" aria-label="Focus minutes, last 7 days">
      ${last7.map(d => `<div class="col" style="align-items:center;gap:4px;flex:1"><div style="width:100%;max-width:28px;height:${Math.round(56 * (days[d] || 0) / max)}px;min-height:3px;border-radius:6px;background:var(--primary)"></div>
        <span class="tiny muted">${new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}</span></div>`).join('')}
    </div></section>`;
}
export function focusReportLine(fromDate) {
  const ss = (state.d.focus || []).filter(s => localDay(s.started_at) >= fromDate);
  const done = ss.filter(s => s.completed);
  return ['', `Focus time: ${done.length} sprints finished (${done.reduce((a, s) => a + s.minutes, 0)} minutes), ${ss.length - done.length} stopped early.`];
}

// ───────── Actions ─────────
export const focusActions = {
  async focusStart() {
    const t = today();
    const cur = state.ui.focusTask && tasksOn(t).find(x => x.id === state.ui.focusTask && !x.done) || tasksOn(t).find(x => !x.done) || null;
    const { data, error } = await sb.from('focus_sessions').insert({ family_id: state.profile.family_id, task_id: cur?.id || null, task_title: cur?.title || null, minutes: fm() }).select().single();
    if (error) return toast('Could not start. Check the internet and try again.');
    setTimer({ mode: 'sprint', end: Date.now() + fm() * 60000, sessionId: data.id, task: cur?.title || null });
    keepAwake(true); buzz(80);
    render();
  },
  async focusStop() {
    const tm = timer();
    if (tm?.sessionId) { try { await sb.from('focus_sessions').update({ ended_at: new Date().toISOString() }).eq('id', tm.sessionId); } catch {} }
    setTimer(null); keepAwake(false);
    toast("Stopped. That's OK. Rest a little and try again.");
    await reload();
  },
  focusSkipBreak: () => { setTimer({ mode: 'ready' }); focusActions.focusStart(); },
  focusReset: () => { setTimer(null); keepAwake(false); toast('Great work today!'); render(); },
  studyPick: el => { state.ui.focusTask = el.dataset.t; render(); },
  async studyAdd() {
    const v = (document.getElementById('study-new')?.value || '').trim(); if (!v) return;
    await run(sb.from('study_tasks').insert({ family_id: state.profile.family_id, day: today(), title: v, sort: tasksOn(today()).length }));
    const el = document.getElementById('study-new'); if (el) el.value = '';
    await reload();
  },
  async studyAddParent() {
    const v = (document.getElementById('p-study-new')?.value || '').trim(); if (!v) return;
    const day = (state.ui.par && state.ui.par.day) || today();
    await run(sb.from('study_tasks').insert({ family_id: state.profile.family_id, day, title: v, sort: tasksOn(day).length }), 'Added');
    await reload();
  },
  async studyToggle(el) { const x = (state.d.study || []).find(s => s.id === el.dataset.t); if (!x) return; await run(sb.from('study_tasks').update({ done: !x.done }).eq('id', x.id)); if (!x.done && state.profile.role === 'child') toast('Nice! One more done.'); await reload(); },
  async studyDel(el) { await run(sb.from('study_tasks').delete().eq('id', el.dataset.t)); await reload(); },
  async homeworkChecked(el) {
    const day = el.dataset.day; const isToday = day === today();
    await run(sb.from('point_events').insert({ family_id: state.profile.family_id, points: 5, reason: 'Homework checked by ' + P(), category: 'bonus', ref: 'homework:' + day, ...(isToday ? {} : { created_at: new Date(day + 'T12:00:00').toISOString() }) }), `+5 sent to ${kid()}`);
    // also tick "Homework done" in the evening routine, if it's there and not ticked yet
    const hw = state.d.missions.find(m => m.kind === 'routine' && m.active && /homework/i.test(m.title));
    if (hw) {
      const l = logsFor(hw, day)[0];
      if (!l) await sb.from('mission_logs').insert({ family_id: state.profile.family_id, mission_id: hw.id, log_date: day, slot: 1, status: 'approved' });
      else if (l.status === 'pending') await sb.from('mission_logs').update({ status: 'approved' }).eq('id', l.id);
    }
    await reload();
  }
};
