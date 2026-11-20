import {
  sb, state, esc, APP_VERSION, paths, summitFor, P, fillP, kid, today, mondayOf, addDays, localDay, sum, render, toast, openModal, closeModal, run, friendly,
  ladder, stepsOf, currentStep, attemptsOf, todaysAttempt, readiness, mystery, summit, secretFor, eventsOn, earnedOn,
  attendanceOn, logsFor, routineMissions, PARTS, currentPart, behaviourMissions, childProfile, heartsToday, loadAll, KID_DOMAIN, uid
} from './core.js';
import { ic } from './icons.js';
import { pushCard } from './push.js';
import { pinCard, hasPin } from './lock.js';
import { bellButton, feedModal } from './feed.js';
import { parentFoodCard, parentHealthSection, foodReportLines, foodMissions } from './food.js';

const ui = () => (state.ui.par ||= { path: 'school', range: 'week' });
const val = id => (document.getElementById(id)?.value ?? '').trim();
const fam = () => state.profile.family_id;
const reload = async () => { await loadAll(); render(); };
// The day being filled in on the Today tab (today, or up to 3 days back)
const BACK_DAYS = 6; // today + the 6 days before = one week
const selDay = () => { const d = ui().day; return d && d >= addDays(today(), -BACK_DAYS) && d <= today() ? d : today(); };
const attemptOn = (step, day) => { const l = state.d.attempts.filter(a => a.step_id === step.id && a.attempt_date === day); return l[l.length - 1] || null; };
const noonOf = day => new Date(day + 'T12:00:00').toISOString();

export function parentView() {
  const tab = state.tab || 'today';
  const views = { today: todayTab, plan: planTab, progress: progressTab, gifts: giftsTab, settings: settingsTab };
  const pending = state.d.attempts.filter(a => a.result == null).length + state.d.logs.filter(l => l.status === 'pending').length
    + state.d.redemptions.filter(r => r.status === 'claimed').length;
  const tabs = [['today', 'Today', ic.today(24)], ['plan', 'Plan', ic.mountain(24)], ['progress', 'Progress', ic.chart(24)], ['gifts', 'Rewards', ic.gift(24)], ['settings', 'Settings', ic.cog(24)]];
  return `<div class="screen parent">${(views[tab] || todayTab)()}</div>
    <nav class="tabbar" aria-label="Parent"><div class="inner">${tabs.map(([k, l, i]) =>
      `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}" aria-current="${tab === k ? 'page' : 'false'}">${i}${k === 'today' && pending ? `<span class="badge">${pending}</span>` : ''}${l}</button>`).join('')}</div></nav>`;
}

const head = (title, sub = '') => `<header class="col tight"><span class="row between" style="width:100%"><span class="tag parent">Parent</span><span class="row" style="gap:8px">${hasPin() ? `<button class="btn sm ghost" style="min-height:36px" data-act="lockNow" aria-label="Lock the parent area">${ic.lock(14)} Lock</button>` : ''}${bellButton()}</span></span><span class="h1">${title}</span>${sub ? `<span class="small muted bold">${sub}</span>` : ''}</header>`;

// ───────── Today ─────────
function todayTab() {
  const t = selDay();
  const isToday = t === today();
  const dayLabel = d => d === today() ? 'Today' : d === addDays(today(), -1) ? 'Yesterday' : new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  const dayPicker = `<div class="row" style="gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch" role="tablist" aria-label="Day">${Array.from({ length: BACK_DAYS + 1 }, (_, i) => { const d = addDays(today(), -i); const filled = state.d.attendance.some(a => a.day === d) || state.d.logs.some(l => l.log_date === d); return `<button role="tab" class="pill ${d === t ? 'on' : ''}" style="flex-shrink:0" data-act="pickDay" data-v="${d}" aria-selected="${d === t}">${dayLabel(d)}${filled || d === today() ? '' : ' ·'}</button>`; }).join('')}</div>
    <span class="tiny muted" style="margin-top:-10px">Missed a day? Pick it to fill it in. Days marked · have nothing recorded yet.</span>
    ${isToday ? '' : `<div class="card" style="background:#FFF6E3;box-shadow:none;flex-direction:row;align-items:center;gap:10px">${ic.today(20, 'var(--sun-ink)')}<span class="small bold grow">Filling in ${new Date(t + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}. Points are dated to that day.</span><button class="btn sm ghost" data-act="pickDay" data-v="${today()}">Back to today</button></div>`}`;
  const att = attendanceOn(t);
  const pendingAttempts = state.d.attempts.filter(a => a.result == null);
  const confirmCards = pendingAttempts.map(a => {
    const s = state.d.steps.find(x => x.id === a.step_id);
    return `<div class="card tint" style="box-shadow:none">
      <div class="col tight"><span class="eyebrow" style="color:var(--primary)">Confirm brave step${a.attempt_date !== t ? ' · ' + new Date(a.attempt_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : ''}</span>
      <span class="bold">Camp ${s?.position} · ${esc(fillP(s?.title))}</span>
      <span class="small muted">Fear before: <b>${a.fear_before ?? '–'}</b>${a.fear_after != null ? ` · during: <b>${a.fear_after}</b>` : ' · not rated after yet'}</span></div>
      <div class="grid3">
        <button class="choice" data-act="setResult" data-att="${a.id}" data-v="done"><span>Done</span><span class="tiny">+30</span></button>
        <button class="choice" data-act="setResult" data-att="${a.id}" data-v="tried"><span>Tried</span><span class="tiny">+10</span></button>
        <button class="choice" data-act="setResult" data-att="${a.id}" data-v="not"><span>Not today</span><span class="tiny">0</span></button>
      </div></div>`;
  }).join('');

  const recordRows = paths().map(l => {
    const top = !currentStep(l);
    const s = currentStep(l) || stepsOf(l).slice(-1)[0];
    if (!s) return '';
    const a = attemptOn(s, t);
    if (a) {
      const label = a.result ? { done: 'Done · +30', tried: 'Tried · +10', not: 'Not today' }[a.result] : 'Waiting for your confirmation above';
      return `<div class="row between small"><span class="bold">${esc(l.title)}: ${top ? 'Top (keep it up)' : 'Camp ' + s.position}</span><span class="muted bold">${label}</span></div>`;
    }
    return `<div class="col"><span class="small bold">${esc(l.title)} · ${top ? 'Top (keep it up)' : 'Camp ' + s.position}: ${esc(fillP(s.title))}</span>
      <div class="grid3"><button class="choice" data-act="recordStep" data-step="${s.id}" data-v="done"><span>Done</span><span class="tiny">+30</span></button>
      <button class="choice" data-act="recordStep" data-step="${s.id}" data-v="tried"><span>Tried</span><span class="tiny">+10</span></button>
      <button class="choice off" data-act="noop" disabled><span class="tiny">Or let ${esc(kid())} rate it first</span></button></div></div>`;
  }).join('<div class="divider"></div>');

  const behaviour = behaviourMissions().map(m => {
    const logs = logsFor(m, t);
    const names = m.checkins === 3 ? ['After school', 'Afternoon', 'Bedtime'] : Array.from({ length: m.checkins }, (_, i) => `Check ${i + 1}`);
    return `<div class="col"><div class="row between"><span class="bold">${esc(m.title)}</span><span class="small muted bold">+${m.points} each</span></div>
      <div class="grid3">${names.map((n, i) => {
        const l = logs.find(x => x.slot === i + 1);
        const st = l?.status;
        return `<button class="choice ${st === 'approved' ? 'on teal' : st === 'missed' ? 'off' : ''}" data-act="cycleSlot" data-m="${m.id}" data-slot="${i + 1}" aria-label="${esc(n)}: ${st || 'not checked'}">
          <span style="font-size:18px">${st === 'approved' ? '✓' : st === 'missed' ? '–' : '?'}</span><span class="tiny">${n}</span></button>`;
      }).join('')}</div></div>`;
  }).join('');

  const routine = routineMissions();
  const pendingLogs = routine.flatMap(m => logsFor(m, t).filter(l => l.status === 'pending'));
  const routineRow = m => {
    const l = logsFor(m, t)[0];
    return `<div class="row"><span class="grow small bold">${esc(m.title)}</span>
      ${!l ? `<button class="btn sm ghost" data-act="routineMark" data-m="${m.id}">Mark done</button>` :
        l.status === 'pending' ? `<button class="btn sm teal" data-act="approveLog" data-l="${l.id}">Approve +${m.points}</button>` :
        `<span class="small bold" style="color:var(--teal)">✓ +${m.points}</span>`}</div>`;
  };
  const routineRows = PARTS.map(([part, label]) => {
    const list = routineMissions(part); if (!list.length) return '';
    const done = list.filter(m => logsFor(m, t)[0]).length;
    return `<div class="row between" style="margin-top:4px"><span class="small bold" style="color:var(--primary)">${label}${isToday && part === currentPart() ? ' · now' : ''}</span><span class="tiny muted bold">${done}/${list.length}</span></div>${list.map(routineRow).join('')}`;
  }).join('<div class="divider"></div>');

  const claimed = state.d.redemptions.filter(r => r.status === 'claimed');
  const readyPrizes = state.d.redemptions.filter(r => r.status === 'approved');
  const hearts = heartsToday();
  const sentToday = hearts.filter(h => h.from_role === 'parent').length;
  const kidReplies = hearts.filter(h => h.from_role === 'child').length;
  const plan = state.family.checkins_per_day;

  return `${head(`${esc(kid())} ${isToday ? 'today' : '· ' + dayLabel(t)}`, new Date(t + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}
    ${dayPicker}
    <div class="card" style="flex-direction:row;align-items:center"><div class="grow col tight"><span class="small muted bold">Earned ${isToday ? 'today' : 'that day'}</span><span class="display" style="font-size:28px;color:var(--primary)">+${earnedOn(t)}</span></div>
      <div class="col tight" style="align-items:flex-end"><span class="small muted bold">Balance</span><span class="display" style="font-size:22px">${state.d.balance}</span></div></div>
    ${isToday && state.ui.push && state.ui.push !== 'on' ? pushCard('parent') : ''}
    ${confirmCards}
    <section class="card"><span class="h3">School ${isToday ? 'today' : 'that day'}</span>
      <div class="grid3">${[['went', 'Went', '+20'], ['partly', 'Part of day', '+10'], ['no', "Didn't go", '0']].map(([v, l, p]) =>
        `<button class="choice ${att?.status === v ? 'on' : ''}" data-act="setSchool" data-v="${v}" aria-pressed="${att?.status === v}"><span>${l}</span><span class="tiny">${p}</span></button>`).join('')}</div>
      ${att?.status === 'no' ? `<span class="small muted bold">No points lost. Tomorrow is a fresh start.</span>` : ''}
      <div class="divider"></div><span class="h3">Brave steps</span>${recordRows}
    </section>
    ${behaviour ? `<section class="card">${behaviour}</section>` : ''}
    ${parentFoodCard(t)}
    <section class="card"><div class="row between"><span class="h3">Routines</span>${pendingLogs.length > 1 ? `<button class="btn sm teal" data-act="approveAll">Approve all</button>` : ''}</div>${routineRows || '<span class="small muted">No routine steps</span>'}</section>
    <section class="col"><span class="h3">Quick bonus</span>
      <div class="grid2">${[['Brave moment', 10], ['Calmed down', 5], ['Kind act', 5], ['Tried something hard', 5]].map(([l, p]) =>
        `<button class="card" style="border:none;flex-direction:row;align-items:center;justify-content:space-between;padding:14px" data-act="bonus" data-r="${l}" data-p="${p}"><span class="bold small" style="text-align:left">${l}</span><span class="tag primary" style="background:var(--primary);color:#fff">+${p}</span></button>`).join('')}</div>
      <div class="row"><input class="input grow" id="bonus-reason" placeholder="Other reason…" aria-label="Bonus reason"><input class="input" id="bonus-pts" type="number" inputmode="numeric" value="5" min="1" max="50" style="width:76px" aria-label="Points"><button class="btn sm primary" data-act="bonusCustom">Give</button></div>
    </section>
    ${!isToday ? '' : `${claimed.length ? `<section class="card tint" style="box-shadow:none"><span class="h3">Prize requests</span><span class="small muted">${esc(kid())} spent his points on these. Say yes, and it waits in his "My prizes" until he uses it. Say no, and his points come back.</span>
      ${claimed.map(r => `<div class="col" style="gap:6px"><span class="small bold">${esc(fillP(r.name))} · ${r.price} pts</span>
        <div class="grid2"><button class="btn sm teal" data-act="acceptPrize" data-r="${r.id}">Yes, accept</button><button class="btn sm ghost" data-act="declinePrize" data-r="${r.id}">Not now (refund)</button></div></div>`).join('')}</section>` : ''}
    ${readyPrizes.length ? `<section class="card"><span class="h3">Prizes ready to use</span><span class="small muted">Tap "Used" when he has had it. It then disappears from his list.</span>
      ${readyPrizes.map(r => `<div class="row"><span style="font-size:20px" aria-hidden="true">🎟️</span><span class="grow small bold">${esc(fillP(r.name))}</span><button class="btn sm primary" data-act="markUsed" data-r="${r.id}">Used</button></div>`).join('')}</section>` : ''}
    <section class="card"><div class="row between"><span class="h3">Heart check-ins</span><span class="small muted bold">${sentToday} of ${plan} today</span></div>
      <span class="small muted">${kidReplies ? `${esc(kid())} sent ${kidReplies} heart${kidReplies === 1 ? '' : 's'} back today.` : `Send a heart at the planned times (e.g. break). ${esc(kid())} can reply.`}</span>
      <button class="btn ghost" data-act="sendHeart" ${sentToday >= plan ? 'disabled' : ''}>${ic.heart(18)} ${sentToday >= plan ? "Today's hearts are sent" : 'Send a heart'}</button></section>
    <section class="card soft"><span class="eyebrow" style="color:var(--primary)">Say it today</span><span class="display" style="font-size:18px;font-weight:700;line-height:1.35">"${esc(state.family.supportive_phrase)}"</span><span class="small muted">Accept the feeling, and show you trust him to cope.</span></section>`}`;
}

// ───────── Plan ─────────
function planTab() {
  const u = ui();
  const l = ladder(u.path) || paths()[0];
  const sm = summitFor(l);
  const steps = stepsOf(l);
  const cur = currentStep(l);
  const r = cur ? readiness(cur) : null;
  const rows = steps.map(s => {
    const done = s.position < l.current_position, now = cur && s.id === cur.id;
    return `<div class="row" style="padding:8px 10px;border-radius:14px;${now ? 'background:var(--primary-tint)' : ''}">
      <span class="rung" style="padding:0"><span class="dot ${done ? 'done' : ''}" style="width:30px;height:30px;font-size:13px;${now ? 'background:var(--primary);color:#fff' : ''}">${done ? '✓' : s.position}</span></span>
      <span class="grow small bold">${esc(fillP(s.title))}</span><span class="tiny bold" style="color:${done ? 'var(--teal)' : 'var(--primary)'}">${done ? 'Climbed' : now ? 'Now' : ''}</span></div>`;
  }).join('');
  const worries = state.d.worries.filter(w => !w.talked_about);
  return `${head('Brave plan', `Plan the steps with ${esc(kid())} and his psychologist.`)}
    <div class="row wrap" style="gap:8px">${paths().map(x => `<button class="pill ${x.id === l.id ? 'on' : ''}" data-act="parPath" data-v="${x.id}" aria-pressed="${x.id === l.id}">${esc(x.title)}</button>`).join('')}
      <button class="pill" style="border-style:dashed;color:var(--primary)" data-act="newPath">${ic.plus(14)} New path</button>
      <button class="pill" style="color:var(--primary)" data-act="managePaths">${ic.cog(14)} Manage paths</button></div>
    <section class="card">${rows}
      <span class="small muted">Summit prize: ${sm ? `<b>${esc(sm.title || 'not named yet')}</b>${sm.status === 'won' ? ' (won!)' : ''}` : 'none for this path'} · set it in Rewards.</span>
      ${cur ? `<div class="col tight" style="background:${r.ready ? 'var(--teal-soft)' : '#FFF6E3'};border-radius:14px;padding:12px">
        <span class="bold small">${r.ready ? 'Looks ready to move up' : 'Keep practicing this camp'}</span>
        <span class="small muted">${r.last.length ? `Fear before on Camp ${cur.position}: ${r.last.join(' → ')}. ` : 'No ratings yet. '}Move up when it stays at 3 or less for 2–3 tries. Done ${r.doneCount} time${r.doneCount === 1 ? '' : 's'}.</span></div>` :
        `<div class="col tight" style="background:var(--sun-soft);border-radius:14px;padding:12px"><span class="bold small">Top reached! 🏆</span>
          <span class="small muted">${esc(kid())} keeps practicing the top step as "Keep it up" (same points), so the habit stays. When you're ready: add harder steps (Edit steps), start a new path, or set a new summit prize in Rewards.</span></div>`}
      <div class="grid2"><button class="btn sm ghost" data-act="editSteps">Edit steps</button><button class="btn sm primary" data-act="askClimb" ${cur ? '' : 'disabled'}>${ic.up(16, '#fff')} Move up a camp</button></div>
    </section>
    <section class="card"><div class="col tight"><span class="h3">Things I do because of his anxiety</span><span class="small muted">Reduce one at a time, in step with the ladder. Only parents see this.</span></div>
      ${state.d.accommodations.map(a => `<div class="row"><span class="grow small bold" style="${a.status === 'done' ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(a.text)}</span>
        <button class="pill" style="min-height:36px;font-size:12px;${a.status === 'now' ? 'background:var(--primary);color:#fff;border-color:var(--primary)' : a.status === 'done' ? 'background:var(--teal-soft);border-color:var(--teal-soft);color:var(--teal)' : ''}" data-act="cycleAcc" data-a="${a.id}">${{ now: 'Reducing now', next: 'Next', done: 'Done' }[a.status]}</button>
        <button class="icon-btn" style="background:var(--soft);width:36px;height:36px" data-act="delAcc" data-a="${a.id}" aria-label="Remove">${ic.trash(16)}</button></div>`).join('')}
      <div class="row"><input class="input grow" id="acc-text" placeholder="Add one…" aria-label="New item"><button class="btn sm primary" data-act="addAcc">Add</button></div>
    </section>
    <section class="card"><div class="col tight"><span class="h3">Heart check-ins per school day</span><span class="small muted">Lower it week by week: 3 → 2 → 1 → 0.</span></div>
      <div class="grid4" style="grid-template-columns:repeat(5,minmax(0,1fr))">${[0, 1, 2, 3, 4].map(n => `<button class="choice ${state.family.checkins_per_day === n ? 'on' : ''}" data-act="setCheckins" data-v="${n}">${n}</button>`).join('')}</div></section>
    <section class="card"><div class="col tight"><span class="h3">Worry time</span><span class="small muted">Worries ${esc(kid())} locked in the box. Go through them together, then mark them.</span></div>
      ${worries.length ? worries.map(w => `<div class="col tight" style="background:var(--soft);border-radius:14px;padding:10px 12px"><span class="small bold">${esc(w.text)}</span>
        <div class="row between"><span class="tiny muted">${new Date(w.created_at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span><button class="btn sm ghost" data-act="talkedWorry" data-w="${w.id}">We talked about it</button></div></div>`).join('') : '<div class="empty">No worries waiting</div>'}
    </section>`;
}

// ───────── Progress ─────────
function progressTab() {
  const u = ui();
  const days = u.range === 'week' ? 7 : 30;
  const from = addDays(today(), -(days - 1));
  const inRange = d => d >= from;
  const att = state.d.attendance.filter(a => inRange(a.day));
  const attempts = state.d.attempts.filter(a => inRange(a.attempt_date));
  const rated = attempts.filter(a => a.fear_before != null);
  const avg = rated.length ? (sum(rated, a => a.fear_before) / rated.length).toFixed(1) : '–';
  const earned = sum(state.d.events.filter(e => e.points > 0 && inRange(localDay(e.created_at))), e => e.points);
  const calm = state.d.calm.filter(c => inRange(localDay(c.created_at)));
  const tiles = [
    ['School days', att.filter(a => a.status === 'went').length + att.filter(a => a.status === 'partly').length, `${att.filter(a => a.status === 'went').length} full, ${att.filter(a => a.status === 'partly').length} partly`],
    ['Brave steps', attempts.filter(a => a.result === 'done' || a.result === 'tried').length, `${attempts.filter(a => a.result === 'done').length} done, ${attempts.filter(a => a.result === 'tried').length} tried`],
    ['Avg fear before', avg, rated.length ? `${rated.length} rating${rated.length === 1 ? '' : 's'}` : 'No ratings yet'],
    ['Points earned', earned, `Calm tools used: ${calm.length}`]
  ];
  // fear chart: last 12 rated attempts on the school path (fallback: all)
  const sch = ladder('school');
  let series = state.d.attempts.filter(a => a.fear_before != null && stepsOf(sch).some(s => s.id === a.step_id));
  if (!series.length) series = state.d.attempts.filter(a => a.fear_before != null);
  series = series.slice(-12);
  const W = 318, H = 150, x0 = 14, x1 = 304, yv = v => 10 + (10 - v) * 11;
  const xs = i => series.length <= 1 ? (x0 + x1) / 2 : x0 + i * (x1 - x0) / (series.length - 1);
  let pts = '', marks = '', lastStep = null, segs = [], seg = [];
  series.forEach((a, i) => {
    if (lastStep && a.step_id !== lastStep) {
      segs.push(seg); seg = [];
      const pos = state.d.steps.find(s => s.id === a.step_id)?.position;
      marks += `<line x1="${xs(i) - 8}" y1="6" x2="${xs(i) - 8}" y2="120" stroke="#C5CDF5" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${xs(i) - 4}" y="14" font-size="11" font-weight="700" fill="#4B5575">Camp ${pos}</text>`;
    }
    seg.push(`${xs(i).toFixed(1)},${yv(a.fear_before)}`); lastStep = a.step_id;
    pts += `<circle cx="${xs(i).toFixed(1)}" cy="${yv(a.fear_before)}" r="4.5" fill="${i === series.length - 1 ? '#FFB020' : '#3A4FD8'}" ${i === series.length - 1 ? 'stroke="#1B2559" stroke-width="1.5"' : ''}/>`;
  });
  if (seg.length) segs.push(seg);
  const lines = segs.map(sg => sg.length > 1 ? `<polyline points="${sg.join(' ')}" fill="none" stroke="#3A4FD8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : '').join('');
  const chart = series.length ? `<svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fear before each brave step: ${series.map(a => a.fear_before).join(', ')}">
    <line x1="0" y1="${yv(10)}" x2="${W}" y2="${yv(10)}" stroke="#EEF0F6"/><line x1="0" y1="${yv(5)}" x2="${W}" y2="${yv(5)}" stroke="#EEF0F6"/><line x1="0" y1="${yv(0)}" x2="${W}" y2="${yv(0)}" stroke="#E3E6F0"/>
    <line x1="0" y1="${yv(3)}" x2="${W}" y2="${yv(3)}" stroke="#0B7A70" stroke-dasharray="4 4"/><text x="${W - 2}" y="${yv(3) - 4}" text-anchor="end" font-size="11" font-weight="700" fill="#0B7A70">Ready to move up (3)</text>
    ${marks}${lines}${pts}
    <text x="2" y="${H - 6}" font-size="11" fill="#4B5575">oldest</text><text x="${W - 2}" y="${H - 6}" text-anchor="end" font-size="11" fill="#4B5575">latest: ${series[series.length - 1].fear_before}</text></svg>
    <span class="small muted">Fear usually rises at each new camp, then falls with practice. That's the pattern you want.</span>` : '<div class="empty">The chart appears after the first fear ratings.</div>';

  // calendar: this month's weekdays
  const now = new Date(); const y = now.getFullYear(), mo = now.getMonth();
  const first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0);
  let cells = '';
  const lead = (first.getDay() + 6) % 7; // Mon=0
  if (lead < 5) for (let i = 0; i < lead; i++) cells += '<span style="border:none"></span>';
  for (let d = 1; d <= last.getDate(); d++) {
    const dt = new Date(y, mo, d); const dow = dt.getDay(); if (dow === 0 || dow === 6) continue;
    const ds = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const a = attendanceOn(ds); const isToday = ds === today();
    const style = a?.status === 'went' ? 'background:var(--sun);border-color:var(--sun)' : a?.status === 'partly' ? 'background:#FFD27A;border-color:#FFD27A' : a?.status === 'no' ? 'background:var(--line);border-color:var(--line);color:var(--muted)' : isToday ? 'border-color:var(--primary);color:var(--primary)' : 'color:var(--muted)';
    cells += `<span style="${style}">${d}</span>`;
  }
  const buckets = { Mornings: 0, Afternoons: 0, Evenings: 0 };
  calm.forEach(c => { const h = new Date(c.created_at).getHours(); buckets[h < 12 ? 'Mornings' : h < 18 ? 'Afternoons' : 'Evenings']++; });
  const maxB = Math.max(1, ...Object.values(buckets));

  return `${head('Progress')}
    <div class="seg"><button data-act="parRange" data-v="week" class="${u.range === 'week' ? 'on' : ''}">Last 7 days</button><button data-act="parRange" data-v="month" class="${u.range === 'month' ? 'on' : ''}">Last 30 days</button></div>
    <div class="grid2">${tiles.map(([l, v, s]) => `<div class="card" style="gap:2px;padding:12px 14px"><span class="tiny bold muted">${l}</span><span class="display" style="font-size:26px">${v}</span><span class="tiny bold" style="color:var(--teal)">${s}</span></div>`).join('')}</div>
    <section class="card"><span class="h3">Fear before each brave step (0–10)</span>${chart}</section>
    <section class="card"><span class="h3">School · ${now.toLocaleDateString('en-GB', { month: 'long' })}</span>
      <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => `<span style="border:none;height:auto" class="tiny muted">${d}</span>`).join('')}${cells}</div>
      <div class="row wrap tiny bold muted" style="gap:12px"><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:4px;background:var(--sun)"></span>At school</span><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:4px;background:#FFD27A"></span>Part of day</span><span class="row" style="gap:6px"><span style="width:12px;height:12px;border-radius:4px;background:var(--line)"></span>At home</span></div></section>
    <section class="card"><span class="h3">When he uses the Calm Corner</span>
      ${Object.entries(buckets).map(([k, v]) => `<div class="row"><span class="small bold" style="width:92px">${k}</span><div class="bar grow" style="height:12px"><div style="width:${Math.round(100 * v / maxB)}%;background:var(--teal)"></div></div><span class="small bold" style="width:18px">${v}</span></div>`).join('')}</section>
    ${parentHealthSection(from)}
    <button class="btn primary block" data-act="shareReport">${ic.share(18, '#fff')} Share report with his psychologist / ABA team</button>`;
}

function reportText() {
  const u = ui(); const days = u.range === 'week' ? 7 : 30; const from = addDays(today(), -(days - 1));
  const att = state.d.attendance.filter(a => a.day >= from);
  const attempts = state.d.attempts.filter(a => a.attempt_date >= from);
  const lines = [`${kid()}'s Brave Mountain report (last ${days} days, to ${today()})`, '',
    `School: ${att.filter(a => a.status === 'went').length} full days, ${att.filter(a => a.status === 'partly').length} part days, ${att.filter(a => a.status === 'no').length} at home.`];
  paths().forEach(l => { const s = currentStep(l); lines.push(`${l.title}: ${s ? `Camp ${s.position} – ${fillP(s.title)}` : 'top reached'}`); });
  lines.push('', 'Brave steps (date · step · fear before/after · result):');
  attempts.forEach(a => { const s = state.d.steps.find(x => x.id === a.step_id); lines.push(`${a.attempt_date} · Camp ${s?.position} ${fillP(s?.title)} · ${a.fear_before ?? '-'}/${a.fear_after ?? '-'} · ${a.result || 'pending'}`); });
  const calm = state.d.calm.filter(c => localDay(c.created_at) >= from);
  lines.push('', `Calm Corner used ${calm.length} times${calm.length ? ': ' + Object.entries(calm.reduce((o, c) => (o[c.tool] = (o[c.tool] || 0) + 1, o), {})).map(([k, v]) => `${k} ${v}`).join(', ') : ''}.`);
  lines.push(...foodReportLines(from));
  const acc = state.d.accommodations; if (acc.length) lines.push('', 'Accommodations being reduced: ' + acc.map(a => `${a.text} (${a.status})`).join('; '));
  return lines.join('\n');
}

// ───────── Rewards & gifts ─────────
function giftsTab() {
  const g = mystery(); const sec = secretFor(g);
  const summits = state.d.gifts.filter(x => x.kind === 'summit' && x.status !== 'given');
  const grand = state.d.gifts.filter(x => x.kind === 'grand' && x.status !== 'given').slice(-1)[0];
  const toppedCount = paths().filter(l => !currentStep(l) && stepsOf(l).length).length;
  const photoBox = (gift, act) => `<div class="row wrap" style="gap:8px"><div style="width:72px;height:72px;border-radius:14px;flex-shrink:0;${gift?.photo_url ? `background:url('${esc(gift.photo_url)}') center/cover` : 'background:var(--sun-soft)'};display:flex;align-items:center;justify-content:center">${gift?.photo_url ? '' : ic.gift(26, 'var(--sun-ink)')}</div>
    <label class="btn sm ghost" style="cursor:pointer">${gift?.photo_url ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" data-change="${act}" data-g="${gift?.id}" style="display:none"></label>
    ${gift?.photo_url ? `<button class="btn sm danger" data-act="removePhoto" data-g="${gift.id}">Remove photo</button>` : ''}</div>`;
  return `${head('Rewards & gifts')}
    ${g ? `<section class="card"><div class="col tight"><span class="eyebrow" style="color:var(--sun-ink)">Treasure chest · secret</span><span class="small muted">${esc(kid())} only sees a locked chest. The photo and name show only when all 4 locks are open.</span></div>
      <div class="field"><label for="g-secret">What is it? (hidden from ${esc(kid())})</label><input class="input" id="g-secret" value="${esc(sec?.secret_title || '')}"></div>
      ${photoBox(g, 'uploadGiftPhoto')}
      <div class="row between"><span class="bold">Locks open: ${Math.min(4, Math.floor(g.pieces_unlocked / Math.max(1, Math.round(g.pieces_total / 4))))} / 4</span>
        <div class="row" style="gap:6px"><button class="icon-btn" style="background:var(--soft)" data-act="pieces" data-n="-${Math.max(1, Math.round(g.pieces_total / 4))}" aria-label="Close one lock">–</button><button class="icon-btn" style="background:var(--soft)" data-act="pieces" data-n="${Math.max(1, Math.round(g.pieces_total / 4))}" aria-label="Open one lock">${ic.plus(18)}</button></div></div>
      <span class="small muted">Each camp climbed opens one lock automatically. Use + for a big brave day.</span>
      <button class="btn sm primary" data-act="saveSecret">Save</button>
      ${g.status === 'won' ? `<button class="btn teal" data-act="newGift">Mark as given and start a new treasure chest</button>` : ''}
    </section>` : `<button class="btn primary" data-act="newGift">Start a treasure chest</button>`}
    ${summits.map(s => { const pl = state.d.ladders.find(x => x.id === s.ladder_id); return `<section class="card"><div class="col tight"><span class="eyebrow" style="color:var(--sun-ink)">Summit prize · ${esc(pl?.title || 'no path')}</span><span class="small muted">Chosen together with ${esc(kid())}. Won at the top of its path.</span></div>
      <div class="field"><label for="s-title-${s.id}">Prize</label><input class="input" id="s-title-${s.id}" value="${esc(s.title || '')}"></div>
      <div class="field"><label for="s-path-${s.id}">Path</label><select class="input" id="s-path-${s.id}">${paths().map(x => `<option value="${x.id}" ${x.id === s.ladder_id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>
      ${photoBox(s, 'uploadSummitPhoto')}
      <span class="small bold">${s.status === 'active' ? 'Not won yet' : 'Won! Give it to him'}</span>
      <div class="row"><button class="btn sm primary grow" data-act="saveSummit" data-g="${s.id}">Save</button>${s.status === 'won' ? `<button class="btn sm teal grow" data-act="summitGiven" data-g="${s.id}">Mark as given</button>` : ''}</div></section>`; }).join('')}
    ${grand ? `<section class="card"><div class="col tight"><span class="eyebrow" style="color:var(--sun-ink)">Grand summit</span><span class="small muted">Won when every active path is at the top (${toppedCount} of ${paths().length} now). Hidden paths don't count.</span></div>
      <div class="field"><label for="grand-title">Prize</label><input class="input" id="grand-title" value="${esc(grand.title || '')}"></div>
      ${photoBox(grand, 'uploadGiftPhoto')}
      <span class="small bold">${grand.status === 'active' ? 'Not won yet' : 'Won! Give it to him'}</span>
      <div class="row"><button class="btn sm primary grow" data-act="saveGrand" data-g="${grand.id}">Save</button>${grand.status === 'won' ? `<button class="btn sm teal grow" data-act="summitGiven" data-g="${grand.id}">Mark as given</button>` : ''}</div></section>` :
    `<section class="card"><span class="h3">Add a grand summit</span><span class="small muted">One very big prize for reaching the top of every path.</span>
      <div class="row"><input class="input grow" id="new-grand-title" placeholder="e.g. A big trip" aria-label="Grand summit prize"><button class="btn sm primary" data-act="addGrand">Add</button></div></section>`}
    <section class="card"><span class="h3">Add a summit prize</span><span class="small muted">One big prize per path, chosen with ${esc(kid())}. After he wins one, mark it given and add the next.</span>
      <input class="input" id="new-s-title" placeholder="e.g. New bike" aria-label="Summit prize">
      <div class="row"><select class="input grow" id="new-s-path" aria-label="Path">${paths().filter(x => !summits.some(s => s.ladder_id === x.id && s.status === 'active')).map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('') || '<option value="">Every path has one</option>'}</select>
      <button class="btn sm primary" data-act="addSummit">Add</button></div></section>
    <section class="card"><span class="h3">Prize shop</span><span class="small muted">Keep prices steady. Daily prizes should be reachable every day.</span>
      ${state.d.rewards.map(r => `<div class="col" style="gap:6px;padding:10px 0;border-top:1px solid var(--line)">
        <textarea class="input step-text" id="rn-${r.id}" rows="1" style="min-height:48px;resize:none;line-height:1.35" aria-label="Prize name">${esc(r.name)}</textarea>
        <div class="row"><input class="input" id="rp-${r.id}" type="number" inputmode="numeric" value="${r.price}" style="width:90px" aria-label="Price">
          <select class="input" id="rt-${r.id}" style="width:auto" aria-label="Type"><option value="daily" ${r.tier === 'daily' ? 'selected' : ''}>Daily</option><option value="weekly" ${r.tier === 'weekly' ? 'selected' : ''}>Weekly</option></select>
          <label class="row small bold" style="gap:4px"><input type="checkbox" id="ra-${r.id}" ${r.active ? 'checked' : ''}> On</label></div>
        <div class="row"><button class="btn sm primary grow" data-act="saveReward" data-r="${r.id}">Save</button><button class="btn sm danger" data-act="delReward" data-r="${r.id}">Delete</button></div></div>`).join('')}
      <div class="col" style="gap:6px;padding-top:10px;border-top:1px solid var(--line)"><span class="small bold">Add a prize</span>
        <input class="input" id="new-r-name" placeholder="e.g. Ice cream trip">
        <div class="row"><input class="input" id="new-r-price" type="number" inputmode="numeric" placeholder="Points" style="width:100px"><select class="input" id="new-r-tier" style="width:auto"><option value="daily">Daily</option><option value="weekly">Weekly</option></select><button class="btn sm primary grow" data-act="addReward">Add</button></div></div>
    </section>
    <section class="card"><span class="h3">${esc(kid())}'s wish list</span>${state.d.wishes.length ? state.d.wishes.map(w => `<div class="row small bold">${ic.heartFill(16)} ${esc(w.text)}</div>`).join('') : '<div class="empty">Nothing yet</div>'}</section>`;
}

// ───────── Settings ─────────
function settingsTab() {
  const f = state.family; const kidP = childProfile();
  const missionRow = m => `<div class="col" style="gap:6px;padding:10px 0;border-top:1px solid var(--line)">
    <textarea class="input step-text" id="mt-${m.id}" rows="1" style="min-height:48px;resize:none;line-height:1.35" aria-label="Mission name">${esc(m.title)}</textarea>
    <div class="row"><label class="small bold">Points <input class="input" id="mp-${m.id}" type="number" inputmode="numeric" value="${m.points}" style="width:76px"></label>
      ${m.kind === 'behaviour' ? `<label class="small bold">Check-ins <input class="input" id="mc-${m.id}" type="number" inputmode="numeric" value="${m.checkins}" min="1" max="5" style="width:70px"></label>` : ''}
      <button class="btn sm primary" data-act="saveMission" data-m="${m.id}">Save</button><button class="icon-btn" style="background:var(--soft)" data-act="delMission" data-m="${m.id}" aria-label="Delete">${ic.trash(16)}</button></div></div>`;
  return `${head('Settings')}
    ${pinCard()}
    ${pushCard('parent')}
    <section class="card"><span class="h3">${esc(kid())}'s login</span>
      ${kidP ? `<span class="small">Username: <b>${esc(kidP.username || '')}</b></span><span class="small muted">On his phone: open the app → "I'm ${esc(kid())}" → username and password.</span>` : `
      <span class="small muted">Make a simple username and password for ${esc(kid())}'s phone.</span>
      <div class="field"><label for="kid-user">Username</label><input class="input" id="kid-user" autocapitalize="none" value="${esc(kid().toLowerCase())}"></div>
      <div class="field"><label for="kid-pass">Password (6+ characters)</label><input class="input" id="kid-pass" type="text" autocomplete="off"></div>
      <button class="btn primary" data-act="createKid">Create ${esc(kid())}'s login</button>`}
    </section>
    <section class="card"><span class="h3">Family</span>
      <div class="field"><label>${esc(kid())} calls you</label><div class="seg"><button data-act="setLabel" data-v="Mom" class="${f.parent_label === 'Mom' ? 'on' : ''}">Mom</button><button data-act="setLabel" data-v="Dad" class="${f.parent_label === 'Dad' ? 'on' : ''}">Dad</button></div></div>
      <div class="field"><label for="f-child">Child's name</label><input class="input" id="f-child" value="${esc(f.child_name)}"></div>
      <div class="field"><label for="f-phrase">"Say it today" phrase</label><input class="input" id="f-phrase" value="${esc(f.supportive_phrase)}"></div>
      <div class="field"><label for="f-msg">Brave voice message (text)</label><textarea class="input" id="f-msg" placeholder="You are safe. You are brave…">${esc(f.brave_message || '')}</textarea></div>
      <div class="col"><span class="small bold">Voice recording</span>
        ${f.brave_audio_url ? `<audio controls src="${esc(f.brave_audio_url)}" style="width:100%"></audio>` : '<span class="small muted">No recording yet.</span>'}
        <button class="btn sm ghost" data-act="${state.ui.recording ? 'stopRec' : 'startRec'}">${ic.mic(18)} ${state.ui.recording ? 'Stop and save' : 'Record a message'}</button></div>
      <div class="field"><label for="f-safety">Safety plan (shown in the Calm Corner)</label><textarea class="input" id="f-safety" style="min-height:160px">${esc(f.safety_plan || '')}</textarea><span class="tiny muted">{P} becomes "${esc(P())}". Replace the [name] with a real trusted adult.</span></div>
      <button class="btn primary" data-act="saveFamily">Save</button>
    </section>
    ${PARTS.map(([part, label]) => `<section class="card"><span class="h3">${label}</span>${routineMissions(part).map(missionRow).join('')}
      <button class="btn sm ghost" data-act="addMission" data-k="routine" data-part="${part}">${ic.plus(16)} Add step</button></section>`).join('')}
    <section class="card"><span class="h3">Food missions</span><span class="small muted">Healthy habits that earn points. No weight goals here.</span>${foodMissions().map(missionRow).join('')}
      <button class="btn sm ghost" data-act="addMission" data-k="food">${ic.plus(16)} Add food mission</button></section>
    <section class="card"><span class="h3">Behaviour rules</span><span class="small muted">Start with one simple rule.</span>${behaviourMissions().map(missionRow).join('')}
      <button class="btn sm ghost" data-act="addMission" data-k="behaviour">${ic.plus(16)} Add rule</button></section>
    <section class="card"><span class="h3">Second parent</span><span class="small muted">Make a code. The other parent opens the app → "I have a family code". Valid 2 days.</span>
      ${state.ui.invite ? `<span class="display" style="font-size:30px;letter-spacing:.1em">${esc(state.ui.invite)}</span>` : ''}
      <button class="btn sm ghost" data-act="makeInvite">Make a code</button></section>
    <section class="card"><span class="h3">Add to home screen</span><span class="small muted">iPhone: Safari → Share → "Add to Home Screen". Android: Chrome menu → "Add to Home screen" / "Install app".</span></section>
    <button class="btn danger" data-act="signOut">Sign out</button>
    <span class="tiny muted center">App version ${APP_VERSION}</span>`;
}

// ───────── Modals ─────────
export function parentModal(m) {
  if (m.kind === 'feed') return feedModal(m);
  if (m.kind === 'climb') {
    const l = ladder(ui().path) || paths()[0]; const cur = currentStep(l); const next = stepsOf(l).find(s => s.position === cur.position + 1);
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Move up a camp"><span class="h2">Move ${esc(kid())} up a camp?</span>
      <p class="muted" style="margin:0">Camp ${cur.position} (${esc(fillP(cur.title))}) is climbed. ${next ? `Next: Camp ${next.position} · ${esc(fillP(next.title))}.` : 'This is the top!'}<br><br>${esc(kid())} gets +100 points and one lock opens on his treasure chest. Check with him first, so the next step isn't a surprise.</p>
      <div class="grid2"><button class="btn ghost" data-act="closeModal">Not yet</button><button class="btn primary" data-act="doClimb">Move up</button></div></div>`;
  }
  if (m.kind === 'paths') {
    const all = [...state.d.ladders].sort((a, b) => (a.archived - b.archived) || a.sort - b.sort || a.title.localeCompare(b.title));
    const active = all.filter(x => !x.archived);
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Manage paths"><div class="row between"><span class="h2">Manage paths</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
      <span class="small muted">The order here is the order ${esc(kid())} sees. Hiding keeps all history and can be undone. Deleting can't.</span>
      ${all.map(x => { const i = active.indexOf(x); return `<div class="card" style="padding:12px;gap:8px;${x.archived ? 'opacity:.75' : ''}">
        <div class="row"><input class="input grow" id="pn-${x.id}" value="${esc(x.title)}" aria-label="Path name">
          ${x.archived ? '' : `<button class="icon-btn" style="background:var(--soft)" data-act="movePath" data-l="${x.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${ic.up(16)}</button>
          <button class="icon-btn" style="background:var(--soft);transform:rotate(180deg)" data-act="movePath" data-l="${x.id}" data-d="1" ${i === active.length - 1 ? 'disabled' : ''} aria-label="Move down">${ic.up(16)}</button>`}</div>
        <div class="row wrap" style="gap:8px">
          ${x.archived ? `<span class="tag" style="background:var(--soft);color:var(--muted)">Hidden</span><button class="btn sm ghost" data-act="showPath" data-l="${x.id}">Show again</button>`
            : `<button class="btn sm ghost" data-act="hidePath" data-l="${x.id}" ${active.length <= 1 ? 'disabled' : ''}>Hide</button>`}
          <button class="btn sm danger" data-act="askDeletePath" data-l="${x.id}" ${active.length <= 1 && !x.archived ? 'disabled' : ''}>Delete</button></div></div>`; }).join('')}
      <button class="btn primary" data-act="savePathNames">Save names</button></div>`;
  }
  if (m.kind === 'delPath') {
    const x = state.d.ladders.find(l => l.id === m.l);
    const tries = state.d.attempts.filter(a => state.d.steps.some(s => s.ladder_id === x.id && s.id === a.step_id)).length;
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Delete path"><span class="h2">Delete "${esc(x.title)}" for good?</span>
      <p class="muted" style="margin:0">Its steps${tries ? ` and ${tries} brave step record${tries === 1 ? '' : 's'}` : ''} will be deleted, and its summit prize will lose its path. Points ${esc(kid())} already earned stay. This can't be undone.<br><br>If you might want it back, choose <b>Hide</b> instead: it keeps all history.</p>
      <div class="grid2"><button class="btn ghost" data-act="hidePath" data-l="${x.id}">Hide instead</button><button class="btn danger" data-act="doDeletePath" data-l="${x.id}">Delete forever</button></div></div>`;
  }
  if (m.kind === 'steps') {
    const l = m.newPath ? null : (ladder(ui().path) || paths()[0]); const steps = l ? stepsOf(l) : [];
    const rows = (m.draft || steps.map(s => ({ id: s.id, title: s.title })));
    const custom = true;
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="${m.newPath ? 'New path' : 'Edit steps'}"><div class="row between"><span class="h2">${m.newPath ? 'New path' : esc(l.title) + ' steps'}</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
      ${custom ? `<div class="field"><label for="path-title">Path name</label><input class="input" id="path-title" value="${esc(m.title ?? l?.title ?? '')}" placeholder="e.g. Health path"></div>` : ''}
      ${m.newPath ? `<div class="field"><label>Start from</label><div class="seg">${Object.entries(TEMPLATES).map(([k, t]) => `<button data-act="pathTemplate" data-v="${k}" class="${m.template === k ? 'on' : ''}">${t.label}</button>`).join('')}</div></div>` : ''}
      <span class="small muted">Steps from easiest to hardest. Write {P} where you want "${esc(P())}".</span>
      ${rows.map((r, i) => `<div class="row top" style="gap:8px"><span class="bold small" style="width:20px;padding-top:14px">${i + 1}</span>
        <textarea class="input grow step-text" data-step-input="${i}" rows="2" style="min-height:52px;resize:none;line-height:1.35" aria-label="Step ${i + 1}">${esc(r.title)}</textarea>
        <div class="col" style="gap:4px">
          <button class="icon-btn" style="background:var(--soft);width:36px;height:36px" data-act="stepMove" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move step ${i + 1} up">${ic.up(14)}</button>
          <button class="icon-btn" style="background:var(--soft);width:36px;height:36px;transform:rotate(180deg)" data-act="stepMove" data-i="${i}" data-d="1" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move step ${i + 1} down">${ic.up(14)}</button>
          ${rows.length > 1 ? `<button class="icon-btn" style="background:var(--soft);width:36px;height:36px" data-act="stepDel" data-i="${i}" aria-label="Remove step ${i + 1}">${ic.trash(14)}</button>` : ''}</div></div>`).join('')}
      ${!m.newPath && currentStep(l) ? `<span class="tiny muted">The current camp stays the same step when you reorder. Steps placed above it count as climbed.</span>` : ''}
      <button class="btn sm ghost" data-act="stepAdd">${ic.plus(16)} Add a step</button>
      <button class="btn primary" data-act="stepsSave">${m.newPath ? 'Create path' : 'Save steps'}</button>
      ${!m.newPath ? `<button class="btn ghost" data-act="managePaths">Rename, reorder, hide or delete paths</button>` : ''}</div>`;
  }
  return '';
}

const TEMPLATES = {
  health: { label: 'Health habits', title: 'Health path', steps: ['Drink water with every meal', 'A fruit or vegetable every day', 'Try one new food this week', 'Help cook a healthy dinner', 'Active play for 30 minutes a day'] },
  sleep: { label: 'Sleeping alone', title: 'Sleep path', steps: ['{P} sits on the bed until I fall asleep', '{P} sits on a chair next to the bed', '{P} sits on a chair by the door', '{P} stays in the doorway', '{P} checks on me every 5 minutes', '{P} checks on me every 15 minutes', '{P} says goodnight and leaves, I fall asleep on my own', 'I sleep in my own bed all night'] },
  blank: { label: 'Blank', title: '', steps: ['', '', ''] }
};

function draftFromInputs() {
  const t = document.getElementById('path-title'); if (t) state.modal.title = t.value;
  const rows = state.modal.draft || stepsOf(ladder(ui().path) || paths()[0]).map(s => ({ id: s.id, title: s.title }));
  document.querySelectorAll('[data-step-input]').forEach(inp => { rows[+inp.dataset.stepInput].title = inp.value.replace(/\s*\n\s*/g, ' '); });
  return rows;
}

// ───────── Actions ─────────
let recorder = null, chunks = [];
async function uploadMedia(file, prefix) {
  const ext = (file.name?.split('.').pop() || (file.type.includes('audio') ? 'webm' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${fam()}/${prefix}-${uid()}.${ext}`;
  await run(sb.storage.from('media').upload(path, file, { contentType: file.type || undefined, upsert: false }));
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export const parentActions = {
  parPath: el => { ui().path = el.dataset.v; render(); },
  parRange: el => { ui().range = el.dataset.v; render(); },
  async setResult(el) { await run(sb.from('brave_attempts').update({ result: el.dataset.v }).eq('id', el.dataset.att), el.dataset.v === 'not' ? 'Saved. Fresh start tomorrow.' : 'Points sent to ' + kid()); await reload(); },
  async recordStep(el) { await run(sb.from('brave_attempts').insert({ family_id: fam(), step_id: el.dataset.step, attempt_date: selDay(), result: el.dataset.v }), 'Saved'); await reload(); },
  pickDay: el => { ui().day = el.dataset.v; render(); window.scrollTo(0, 0); },
  async setSchool(el) { await run(sb.from('attendance').upsert({ family_id: fam(), day: selDay(), status: el.dataset.v }), 'Saved'); await reload(); },
  async cycleSlot(el) {
    const m = state.d.missions.find(x => x.id === el.dataset.m); const slot = +el.dataset.slot;
    const l = logsFor(m, selDay()).find(x => x.slot === slot);
    if (!l) await run(sb.from('mission_logs').insert({ family_id: fam(), mission_id: m.id, log_date: selDay(), slot, status: 'approved' }));
    else if (l.status === 'approved') await run(sb.from('mission_logs').update({ status: 'missed' }).eq('id', l.id));
    else await run(sb.from('mission_logs').delete().eq('id', l.id));
    await reload();
  },
  async routineMark(el) { await run(sb.from('mission_logs').insert({ family_id: fam(), mission_id: el.dataset.m, log_date: selDay(), slot: 1, status: 'approved' })); await reload(); },
  async approveLog(el) { await run(sb.from('mission_logs').update({ status: 'approved' }).eq('id', el.dataset.l)); await reload(); },
  async approveAll() {
    const ids = state.d.logs.filter(l => l.status === 'pending' && l.log_date === selDay()).map(l => l.id);
    if (ids.length) await run(sb.from('mission_logs').update({ status: 'approved' }).in('id', ids), 'All approved');
    await reload();
  },
  async bonus(el) { await run(sb.from('point_events').insert({ family_id: fam(), points: +el.dataset.p, reason: el.dataset.r, category: 'bonus', ...(selDay() !== today() ? { created_at: noonOf(selDay()) } : {}) }), `+${el.dataset.p} sent to ${kid()}`); await reload(); },
  async bonusCustom() {
    const r = val('bonus-reason'), p = parseInt(val('bonus-pts'), 10);
    if (!r || !(p > 0 && p <= 50)) return toast('Add a reason and 1–50 points');
    await run(sb.from('point_events').insert({ family_id: fam(), points: p, reason: r, category: 'bonus', ...(selDay() !== today() ? { created_at: noonOf(selDay()) } : {}) }), `+${p} sent to ${kid()}`); await reload();
  },
  async acceptPrize(el) { await run(sb.from('redemptions').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', el.dataset.r), `Accepted. It's in ${kid()}'s My prizes.`); await reload(); },
  async declinePrize(el) { await run(sb.rpc('decline_redemption', { p_id: el.dataset.r }), `Declined. ${kid()}'s points are back.`); await reload(); },
  async markUsed(el) { await run(sb.from('redemptions').update({ status: 'used' }).eq('id', el.dataset.r), 'Marked as used'); await reload(); },
  async sendHeart() { await run(sb.from('hearts').insert({ family_id: fam(), from_role: 'parent' }), `Heart sent to ${kid()}`); await reload(); },
  askClimb: () => openModal('climb'),
  async doClimb() { const l = ladder(ui().path) || paths()[0]; await run(sb.rpc('climb_camp', { p_ladder: l.id })); closeModal(); toast(`${kid()} moved up! +100 and a lock opened`); await reload(); },
  editSteps: () => openModal('steps'),
  managePaths: () => openModal('paths'),
  async movePath(el) {
    const order = paths().map(x => x.id);
    const i = order.indexOf(el.dataset.l), j = i + parseInt(el.dataset.d, 10);
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    for (let k = 0; k < order.length; k++) await run(sb.from('ladders').update({ sort: k }).eq('id', order[k]));
    await reload();
  },
  async hidePath(el) {
    if (paths().length <= 1 && !state.d.ladders.find(x => x.id === el.dataset.l)?.archived) return toast('Keep at least one path');
    await run(sb.from('ladders').update({ archived: true }).eq('id', el.dataset.l), 'Path hidden. History kept.');
    if (ui().path === el.dataset.l) ui().path = 'school';
    state.modal = { kind: 'paths' }; await reload();
  },
  async showPath(el) {
    const sort = Math.max(0, ...paths().map(x => x.sort)) + 1;
    await run(sb.from('ladders').update({ archived: false, sort }).eq('id', el.dataset.l), 'Path is back');
    await reload();
  },
  askDeletePath: el => openModal('delPath', { l: el.dataset.l }),
  async doDeletePath(el) {
    await run(sb.from('ladders').delete().eq('id', el.dataset.l), 'Path deleted');
    if (ui().path === el.dataset.l) ui().path = 'school';
    state.modal = { kind: 'paths' }; await reload();
  },
  async savePathNames() {
    for (const x of state.d.ladders) {
      const v = (document.getElementById('pn-' + x.id)?.value || '').trim();
      if (v && v !== x.title) await run(sb.from('ladders').update({ title: v }).eq('id', x.id));
    }
    closeModal(); toast('Saved'); await reload();
  },
  newPath: () => openModal('steps', { newPath: true, template: 'health', title: TEMPLATES.health.title, draft: TEMPLATES.health.steps.map(t => ({ id: null, title: t })) }),
  pathTemplate: el => { const t = TEMPLATES[el.dataset.v]; Object.assign(state.modal, { template: el.dataset.v, title: t.title, draft: t.steps.map(x => ({ id: null, title: x })) }); render(); },
  async archivePath() {
    const l = ladder(ui().path);
    if (!l || l.kind !== 'custom') return;
    await run(sb.from('ladders').update({ archived: true }).eq('id', l.id), 'Path hidden. Its history is kept.');
    ui().path = 'school'; closeModal(); await reload();
  },
  async addSummit() {
    const title = val('new-s-title'), lid = val('new-s-path');
    if (!title || !lid) return toast('Add a prize name and pick a path');
    await run(sb.from('gifts').insert({ family_id: fam(), kind: 'summit', title, ladder_id: lid }), 'Summit prize added'); await reload();
  },
  async addGrand() { const t = val('new-grand-title'); if (!t) return toast('Add a prize name'); await run(sb.from('gifts').insert({ family_id: fam(), kind: 'grand', title: t }), 'Grand summit added'); await reload(); },
  async saveGrand(el) { await run(sb.from('gifts').update({ title: val('grand-title') }).eq('id', el.dataset.g), 'Saved'); await reload(); },
  async summitGiven(el) { await run(sb.from('gifts').update({ status: 'given' }).eq('id', el.dataset.g), 'Marked as given'); await reload(); },
  stepAdd: () => { const d = draftFromInputs(); d.push({ id: null, title: '' }); state.modal.draft = d; render(); },
  stepMove: el => { const d = draftFromInputs(); const i = +el.dataset.i, j = i + parseInt(el.dataset.d, 10); if (j < 0 || j >= d.length) return; [d[i], d[j]] = [d[j], d[i]]; state.modal.draft = d; render(); },
  stepDel: el => { const d = draftFromInputs(); d.splice(+el.dataset.i, 1); state.modal.draft = d; render(); },
  async stepsSave() {
    const draft = draftFromInputs(); const rows = draft.filter(r => r.title.trim());
    if (!rows.length) return toast('Add at least one step');
    if (state.modal.newPath) {
      const title = (state.modal.title || '').trim();
      if (!title) return toast('Give the path a name');
      const sort = Math.max(0, ...state.d.ladders.map(x => x.sort)) + 1;
      const { data, error } = await sb.from('ladders').insert({ family_id: fam(), kind: 'custom', title, sort }).select().single();
      if (error) return toast(friendly(error.message));
      await run(sb.from('ladder_steps').insert(rows.map((r, i) => ({ family_id: fam(), ladder_id: data.id, position: i + 1, title: r.title.trim() }))));
      ui().path = data.id; closeModal(); toast(`${title} added`); await reload(); return;
    }
    const l = ladder(ui().path) || paths()[0];
    if (state.modal.title && state.modal.title.trim() && state.modal.title.trim() !== l.title)
      await run(sb.from('ladders').update({ title: state.modal.title.trim() }).eq('id', l.id));
    const old = stepsOf(l);
    const curId = currentStep(l)?.id;
    // move existing to temporary positions to avoid clashes, then write the final order
    for (const s of old) await run(sb.from('ladder_steps').update({ position: s.position + 1000 }).eq('id', s.id));
    const keep = new Set();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.id) { keep.add(r.id); await run(sb.from('ladder_steps').update({ position: i + 1, title: r.title.trim() }).eq('id', r.id)); }
      else await run(sb.from('ladder_steps').insert({ family_id: fam(), ladder_id: l.id, position: i + 1, title: r.title.trim() }));
    }
    for (const s of old) if (!keep.has(s.id)) await run(sb.from('ladder_steps').delete().eq('id', s.id));
    const newCur = curId ? rows.findIndex(r => r.id === curId) : -1;
    if (newCur >= 0 && newCur + 1 !== l.current_position) await run(sb.from('ladders').update({ current_position: newCur + 1 }).eq('id', l.id));
    else if (newCur < 0 && l.current_position > rows.length + 1) await run(sb.from('ladders').update({ current_position: rows.length + 1 }).eq('id', l.id));
    closeModal(); toast('Steps saved'); await reload();
  },
  async cycleAcc(el) { const a = state.d.accommodations.find(x => x.id === el.dataset.a); const next = { now: 'done', next: 'now', done: 'next' }[a.status]; await run(sb.from('accommodations').update({ status: next }).eq('id', a.id)); await reload(); },
  async delAcc(el) { await run(sb.from('accommodations').delete().eq('id', el.dataset.a)); await reload(); },
  async addAcc() { const t = val('acc-text'); if (!t) return; await run(sb.from('accommodations').insert({ family_id: fam(), text: t, status: 'next', sort: state.d.accommodations.length + 1 })); await reload(); },
  async setCheckins(el) { await run(sb.from('families').update({ checkins_per_day: +el.dataset.v }).eq('id', fam()), 'Saved'); await reload(); },
  async talkedWorry(el) { await run(sb.from('worries').update({ talked_about: true }).eq('id', el.dataset.w)); await reload(); },
  async shareReport() {
    const text = reportText();
    try { if (navigator.share) { await navigator.share({ title: `${kid()}'s report`, text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Report copied. Paste it in a message or email.'); } catch { openModal('none'); toast('Could not copy'); }
  },
  async saveSecret() {
    const g = mystery(); const t = val('g-secret');
    if (t) await run(sb.from('gift_secrets').upsert({ gift_id: g.id, family_id: fam(), secret_title: t }));
    toast('Saved'); await reload();
  },
  async pieces(el) { const g = mystery(); await run(sb.rpc('add_pieces', { p_gift: g.id, p_count: +el.dataset.n })); await reload(); },
  async newGift() {
    const g = mystery(); if (g) await run(sb.from('gifts').update({ status: 'given' }).eq('id', g.id));
    const { data, error } = await sb.from('gifts').insert({ family_id: fam(), kind: 'mystery', pieces_total: 12 }).select().single();
    if (error) return toast(friendly(error.message));
    await run(sb.from('gift_secrets').insert({ gift_id: data.id, family_id: fam(), secret_title: 'New mystery gift' }));
    toast('New treasure chest started. Add its name and photo.'); await reload();
  },
  async saveSummit(el) { const id = el.dataset.g; await run(sb.from('gifts').update({ title: val('s-title-' + id), ladder_id: val('s-path-' + id) || null }).eq('id', id), 'Saved'); await reload(); },
  async uploadGiftPhoto(el) { const file = el.files?.[0]; if (!file) return; toast('Uploading…'); const url = await uploadMedia(file, 'gift'); await run(sb.from('gifts').update({ photo_url: url }).eq('id', el.dataset.g), 'Photo saved'); await reload(); },
  async removePhoto(el) {
    const g = state.d.gifts.find(x => x.id === el.dataset.g);
    if (!g?.photo_url) return;
    await run(sb.from('gifts').update({ photo_url: null }).eq('id', g.id), 'Photo removed');
    // also delete the file itself (best effort)
    const m = g.photo_url.match(/\/object\/public\/media\/(.+)$/);
    if (m) { try { await sb.storage.from('media').remove([decodeURIComponent(m[1])]); } catch {} }
    await reload();
  },
  async uploadSummitPhoto(el) { return parentActions.uploadGiftPhoto(el); },
  async saveReward(el) {
    const id = el.dataset.r;
    const price = parseInt(val('rp-' + id), 10);
    if (!(price > 0)) return toast('Price must be more than 0');
    await run(sb.from('rewards').update({ name: val('rn-' + id).replace(/\s*\n\s*/g, ' '), price, tier: val('rt-' + id), active: document.getElementById('ra-' + id).checked }).eq('id', id), 'Saved'); await reload();
  },
  async delReward(el) { await run(sb.from('rewards').delete().eq('id', el.dataset.r)); await reload(); },
  async addReward() {
    const name = val('new-r-name'), price = parseInt(val('new-r-price'), 10), tier = val('new-r-tier');
    if (!name || !(price > 0)) return toast('Add a name and price');
    await run(sb.from('rewards').insert({ family_id: fam(), name, price, tier, sort: state.d.rewards.length + 1 }), 'Prize added'); await reload();
  },
  async createKid() {
    const user = val('kid-user').toLowerCase().replace(/[^a-z0-9._-]/g, ''); const pass = document.getElementById('kid-pass').value;
    if (!user || pass.length < 6) return toast('Username and a 6+ character password');
    const cfg = window.BRAVE_CONFIG;
    const temp = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'brave-temp' } });
    const { data, error } = await temp.auth.signUp({ email: `${user}@${KID_DOMAIN}`, password: pass });
    if (error) return toast(friendly(error.message));
    if (!data.user) return toast('Could not create the login');
    if (!data.session) return toast('Turn off "Confirm email" in Supabase first, then try again.');
    await run(sb.rpc('link_child', { p_user: data.user.id, p_username: user }), `${kid()}'s login is ready!`);
    await reload();
  },
  async setLabel(el) { await run(sb.from('families').update({ parent_label: el.dataset.v }).eq('id', fam()), 'Saved'); await reload(); },
  async saveFamily() {
    await run(sb.from('families').update({ child_name: val('f-child') || 'Taym', supportive_phrase: val('f-phrase'), brave_message: val('f-msg') || null, safety_plan: val('f-safety') }).eq('id', fam()), 'Saved');
    await reload();
  },
  async startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = []; recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.start(); state.ui.recording = true; render(); toast('Recording… speak your message');
    } catch { toast('Microphone not available'); }
  },
  async stopRec() {
    if (!recorder) return;
    const done = new Promise(r => recorder.onstop = r);
    recorder.stop(); recorder.stream.getTracks().forEach(t => t.stop()); await done;
    state.ui.recording = false;
    const type = recorder.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    const file = new File([blob], `voice.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type });
    toast('Saving…');
    const url = await uploadMedia(file, 'voice');
    await run(sb.from('families').update({ brave_audio_url: url }).eq('id', fam()), 'Voice message saved');
    await reload();
  },
  async saveMission(el) {
    const id = el.dataset.m; const m = state.d.missions.find(x => x.id === id);
    const patch = { title: val('mt-' + id).replace(/\s*\n\s*/g, ' '), points: parseInt(val('mp-' + id), 10) || 0 };
    if (m.kind === 'behaviour') patch.checkins = Math.min(5, Math.max(1, parseInt(val('mc-' + id), 10) || 1));
    await run(sb.from('missions').update(patch).eq('id', id), 'Saved'); await reload();
  },
  async delMission(el) { await run(sb.from('missions').update({ active: false }).eq('id', el.dataset.m), 'Removed'); await reload(); },
  async addMission(el) {
    const k = el.dataset.k;
    await run(sb.from('missions').insert({ family_id: fam(), kind: k, part: el.dataset.part || 'morning', title: k === 'routine' ? 'New step' : k === 'food' ? 'New food mission' : 'New rule', points: k === 'behaviour' ? 5 : 3, checkins: k === 'behaviour' ? 3 : 1, sort: state.d.missions.length + 1 }));
    await reload();
  },
  async makeInvite() { const { data, error } = await sb.rpc('make_invite'); if (error) return toast(friendly(error.message)); state.ui.invite = data; render(); },
  noop: () => {}
};
