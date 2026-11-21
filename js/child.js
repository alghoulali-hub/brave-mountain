import {
  sb, state, esc, APP_VERSION, paths, summitFor, P, fillP, kid, today, mondayOf, addDays, greeting, sum, render, toast, openModal, closeModal, run,
  ladder, stepsOf, currentStep, attemptsOf, todaysAttempt, mystery, summit, secretFor, eventsOn, earnedOn,
  attendanceOn, takenThisWeek, logsFor, routineMissions, PARTS, currentPart, stepWindow, appliesOn, isWeekend, behaviourMissions, heartsToday, schoolStreak, scheduleReload, loadAll
} from './core.js';
import { ic } from './icons.js';
import { pushCard } from './push.js';
import { childFoodView } from './food.js';
import { bellButton, feedModal } from './feed.js';

const ui = () => (state.ui.kid ||= { path: 'school', tier: 'daily', feeling: null });
const seenKey = g => `brave-seen-${g.id}`;
// How many pieces this phone has already shown. Never more than the pieces that are really open,
// so after a reset (or pieces taken away) the puzzle closes again.
const seen = g => {
  const stored = parseInt(localStorage.getItem(seenKey(g)) || '0', 10) || 0;
  if (stored > g.pieces_unlocked) { localStorage.setItem(seenKey(g), String(g.pieces_unlocked)); return g.pieces_unlocked; }
  return stored;
};

// ───────── shell ─────────
export function childView() {
  const tab = state.tab || 'mountain';
  const views = { mountain, calm, food: childFoodView, rewards, tonight };
  const body = (views[tab] || mountain)();
  const night = new Date().getHours() >= 19 || new Date().getHours() < 5;
  const tabs = [
    ['mountain', 'Mountain', ic.mountain(24)],
    ['calm', 'Calm', ic.heart(24)],
    ['food', 'Food', ic.apple(24)],
    ['rewards', 'Rewards', ic.gift(24)],
    ['tonight', night ? 'Tonight' : 'My day', ic.moon(24)]
  ];
  return body + `<nav class="tabbar" aria-label="Main"><div class="inner">${tabs.map(([k, l, i]) =>
    `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}" aria-current="${tab === k ? 'page' : 'false'}">${i}${l}</button>`).join('')}</div></nav>`;
}

function header() {
  return `<header class="row between">
    <div class="row"><div class="avatar">${esc(kid()[0] || 'T')}</div>
      <div class="col tight"><span class="small muted bold">${greeting()},</span><span class="display" style="font-size:26px">${esc(kid())}</span></div></div>
    <div class="row" style="gap:8px">${bellButton()}<div class="points-pill">${ic.star()}<span>${state.d.balance}</span><span class="small muted">pts</span></div></div>
  </header>`;
}

// ───────── Mountain ─────────
function heartCard() {
  const hs = heartsToday();
  const lastParent = [...hs].reverse().find(h => h.from_role === 'parent');
  if (!lastParent) return '';
  const replied = hs.some(h => h.from_role === 'child' && h.created_at > lastParent.created_at);
  return `<div class="card" style="flex-direction:row;align-items:center;gap:14px">
    ${ic.heartFill(34)}
    <div class="grow col tight"><span class="bold">${esc(P())} sent you a heart</span><span class="small muted">${replied ? 'You sent one back' : 'Send one back?'}</span></div>
    ${replied ? '' : `<button class="btn sm primary" data-act="heartBack">Send ${ic.heart(18)}</button>`}
  </div>`;
}

const LOCKS = 4;
const perLock = g => Math.max(1, Math.round(g.pieces_total / LOCKS));
const locksOf = (g, pieces = g.pieces_unlocked) => Math.min(LOCKS, Math.floor(pieces / perLock(g)));

function padlock(open, extra = '') {
  return `<span class="padlock ${open ? 'open' : ''} ${extra}" aria-hidden="true"><svg width="34" height="40" viewBox="0 0 34 40">
    <path class="shackle" d="M9 17V11a8 8 0 0 1 16 0v6" fill="none" stroke="${open ? '#5ED3C3' : '#FFD27A'}" stroke-width="4" stroke-linecap="round"/>
    <rect x="3" y="16" width="28" height="22" rx="5" fill="${open ? '#5ED3C3' : '#FFB020'}"/>
    <circle cx="17" cy="25" r="3" fill="#1B2559"/><rect x="15.5" y="26" width="3" height="6" rx="1.5" fill="#1B2559"/></svg></span>`;
}

function chestSvg(open, size = 200) {
  const h = Math.round(size * 0.8);
  return open ? `<svg width="${size}" height="${h}" viewBox="0 0 200 160" aria-hidden="true">
      <g opacity=".9">${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M100 70 L${30 + i * 23} 0" stroke="#FFD27A" stroke-width="5" stroke-linecap="round" opacity="${0.35 + (i % 2) * 0.3}"/>`).join('')}</g>
      <path d="M22 62 Q100 20 178 62 L178 72 L22 72 Z" fill="#6B3E12"/>
      <ellipse cx="100" cy="72" rx="78" ry="12" fill="#FFE6A3"/>
      <rect x="20" y="72" width="160" height="78" rx="10" fill="#9A5B1E"/>
      <rect x="20" y="72" width="160" height="12" fill="#7A4614"/>
      <rect x="44" y="72" width="12" height="78" fill="#FFB020"/><rect x="144" y="72" width="12" height="78" fill="#FFB020"/>
      <rect x="88" y="92" width="24" height="26" rx="5" fill="#FFB020"/></svg>`
    : `<svg width="${size}" height="${h}" viewBox="0 0 200 160" aria-hidden="true">
      <path d="M20 72 V52 Q20 28 52 28 H148 Q180 28 180 52 V72 Z" fill="#B7792B"/>
      <rect x="20" y="72" width="160" height="78" rx="10" fill="#9A5B1E"/>
      <rect x="20" y="66" width="160" height="12" fill="#7A4614"/>
      <rect x="44" y="28" width="12" height="122" fill="#FFB020"/><rect x="144" y="28" width="12" height="122" fill="#FFB020"/>
      <rect x="86" y="62" width="28" height="32" rx="6" fill="#FFB020"/><circle cx="100" cy="76" r="4" fill="#1B2559"/><rect x="98" y="77" width="4" height="9" rx="2" fill="#1B2559"/></svg>`;
}

function giftCard() {
  const g = mystery();
  if (!g) return '';
  const open = locksOf(g), fresh = locksOf(g) > locksOf(g, seen(g));
  const won = open >= LOCKS;
  return `<section class="card navy">
    <div class="row between">
      <div class="col tight">
        <span class="eyebrow" style="color:#C9D2FF">Treasure chest</span>
        <span class="display" style="font-size:24px">${won ? 'All locks open!' : `${open} of ${LOCKS} locks open`}</span>
        <span class="small" style="color:#DDE3FF">${won ? 'Open it to see your surprise' : 'Climb a camp to open the next lock'}</span>
      </div>
      <div style="flex-shrink:0">${chestSvg(false, 74)}</div>
    </div>
    <div class="row" style="gap:10px;justify-content:center">${Array.from({ length: LOCKS }, (_, i) => padlock(i < open)).join('')}</div>
    ${fresh || won ? `<button class="btn sun block" data-act="openReveal">${fresh ? (won ? 'The last lock is open! Open the chest' : 'A lock opened! Tap to see') : 'See my surprise'}</button>` : `<button class="btn outline-light sm" data-act="openReveal">Look at my chest</button>`}
  </section>`;
}

function braveStepBlock(l, cur, practice = false) {
  const att = todaysAttempt(cur);
  const done = attemptsOf(cur).filter(a => a.result === 'done').length;
  let action = '';
  if (l.kind === 'school' && isWeekend(today()) && !att) {
    action = `<div class="row" style="background:#fff;border-radius:14px;padding:10px 12px">${ic.sun(20, 'var(--sun-ink)')}<span class="small bold">It's the weekend! No school step today. Enjoy your rest.</span></div>`;
  } else if (!att) {
    action = `<button class="btn primary block" data-act="startBrave" data-step="${cur.id}">Start brave step</button>`;
  } else if (att.result == null && att.fear_after == null) {
    action = `<div class="small bold">Go be brave! You've got this.</div>
      <button class="btn primary block" data-act="afterBrave" data-att="${att.id}">I did it! How scary was it?</button>
      <button class="btn ghost sm" data-act="calmFromBrave">I need the Calm Corner</button>`;
  } else if (att.result == null) {
    action = `<div class="row" style="background:#fff;border-radius:14px;padding:10px 12px">${ic.check(20, 'var(--teal)')}<span class="small bold">Saved! Waiting for ${esc(P())} to confirm.</span></div>`;
  } else {
    const msg = { done: `Done today! +30 points`, tried: `You tried. That was brave! +10 points`, not: `Tomorrow is a fresh start.` }[att.result];
    action = `<div class="row" style="background:#fff;border-radius:14px;padding:10px 12px">${att.result === 'not' ? ic.sun(20, 'var(--sun-ink)') : ic.star(20)}<span class="small bold">${msg}</span></div>`;
  }
  const dots = Array.from({ length: Math.max(3, done) }, (_, i) => `<span style="width:26px;height:8px;border-radius:999px;background:${i < done ? 'var(--primary)' : '#C5CDF5'}"></span>`).join('');
  return `<div class="card tint" style="padding:16px;box-shadow:none">
    <div class="row"><div class="rung" style="padding:0"><div class="dot now">${l.kind === 'school' ? ic.car(22, '#fff') : ic.flag(22, '#fff')}</div></div>
      <div class="col tight"><span class="eyebrow" style="color:var(--primary)">${practice ? 'Keep it up' : "Today's brave step"}</span>
      <span class="display" style="font-size:19px">${practice ? 'Top' : 'Camp ' + cur.position} · ${esc(fillP(cur.title))}</span></div></div>
    <div class="row"><div class="row" style="gap:6px" aria-hidden="true">${dots}</div><span class="small muted bold">Done ${done} time${done === 1 ? '' : 's'}</span></div>
    ${action}
  </div>`;
}

function mountainCard() {
  const u = ui();
  const l = ladder(u.path) || paths()[0];
  if (!l) return '';
  const steps = stepsOf(l);
  const cur = currentStep(l);
  const sm = summitFor(l);
  const rows = [...steps].reverse().map(s => {
    if (cur && s.id === cur.id) return braveStepBlock(l, cur);
    const done = s.position < l.current_position;
    return `<div class="rung ${done ? '' : 'locked'}">
      <div class="dot ${done ? 'done' : ''}">${done ? ic.check(18, 'var(--ink)') : ic.lock(16, 'var(--muted)')}</div>
      <div class="col tight"><span class="bold t" style="font-size:15px">Camp ${s.position} · ${esc(fillP(s.title))}</span>
      ${done ? '<span class="small muted">Climbed!</span>' : ''}</div></div>`;
  }).join('');
  const lastStep = steps[steps.length - 1];
  const top = (!cur && steps.length) ? `<div class="card" style="box-shadow:none;background:var(--sun-soft)"><span class="display" style="font-size:20px">You reached the top of the ${esc(l.title)}! 🏆</span><span class="small muted bold">That is huge. ${esc(P())} is so proud of you. Keep practicing the top step to keep earning points.</span></div>${braveStepBlock(l, lastStep, true)}` : '';
  const summitRow = sm ? `<div class="rung"><div class="dot" style="background:var(--sun-soft)">${ic.flag(18, 'var(--sun-ink)')}</div>
      <div class="col tight"><span class="bold" style="font-size:15px">Summit prize</span><span class="small muted">${esc(sm.title || 'Set it together')}</span></div></div>` : '';
  return `<section class="col" style="gap:12px">
    <div class="row between"><h2 class="h2">Brave Mountain</h2></div>
    <div class="row wrap" style="gap:8px">${paths().map(p => `<button class="pill ${p.id === l.id ? 'on' : ''}" data-act="kidPath" data-v="${p.id}" aria-pressed="${p.id === l.id}">${esc(p.title)}</button>`).join('')}</div>
    <div class="card" style="gap:4px">${summitRow}${top}${rows}</div>
  </section>`;
}

// Steps shown for a part today. "Next morning" steps (like "Stayed in my own bed all night")
// show in the morning, for last night, and also at bedtime as a reminder.
function partSteps(part) {
  const t = today();
  return state.d.missions.filter(m => m.kind === 'routine' && m.active && (
    m.timing === 'next_morning' ? (part === 'morning' || part === 'bedtime') : (m.part || 'morning') === part
  ) && appliesOn(m, m.timing === 'next_morning' && part === 'morning' ? addDays(t, -1) : t))
    .sort((a, b) => (a.timing === 'next_morning' && part === 'morning' ? -1 : 0) - (b.timing === 'next_morning' && part === 'morning' ? -1 : 0) || a.sort - b.sort);
}
function routineItems(part) {
  return partSteps(part).map(m => {
    if (m.timing === 'next_morning' && part === 'bedtime') {
      // at bedtime this is only a reminder; it is ticked the next morning
      return `<div class="list-item" style="opacity:.75"><span class="check">${ic.sun(18, 'var(--sun-ink)')}</span>
        <span class="grow col tight"><span class="bold">${esc(m.title)}</span><span class="small muted">Tick it tomorrow morning · +${m.points}</span></span></div>`;
    }
    const w = stepWindow(m);
    const log = logsFor(m, w.date)[0];
    const cls = !log ? '' : log.status === 'approved' ? 'ok' : log.status === 'pending' ? 'pending' : '';
    const locked = !log && !w.open;
    const title = m.timing === 'next_morning' && part === 'morning' ? `Last night: ${m.title}` : m.title;
    const sub = log ? (log.status === 'approved' ? `Approved · +${m.points}` : `Waiting for ${esc(P())}`) : locked ? `🔒 ${w.note}` : `+${m.points}${w.note ? ' · ' + w.note : ''}`;
    return `<button class="list-item" style="border:none;width:100%;text-align:left;${locked ? 'opacity:.6' : ''}" data-act="toggleRoutine" data-m="${m.id}" aria-pressed="${!!log}" ${locked ? 'aria-disabled="true"' : ''}>
      <span class="check ${cls}">${log ? ic.check(20, log.status === 'approved' ? 'var(--ink)' : 'var(--sun-ink)') : locked ? ic.lock(16, 'var(--muted)') : ''}</span>
      <span class="grow col tight"><span class="bold">${esc(title)}</span><span class="small muted">${sub}</span></span>
    </button>`;
  }).join('');
}

function missionsCard() {
  const t = today();
  const att = attendanceOn(t);
  const open = ui().openPart || currentPart();
  const sections = PARTS.map(([part, label]) => {
    const list = partSteps(part);
    if (!list.length) return '';
    const done = list.filter(m => !(m.timing === 'next_morning' && part === 'bedtime') && logsFor(m, stepWindow(m).date)[0]).length;
    const isOpen = part === open, now = part === currentPart();
    return `<button class="list-item" style="border:none;width:100%;text-align:left;background:${isOpen ? 'var(--primary-tint)' : '#fff'}" data-act="kidPart" data-v="${part}" aria-expanded="${isOpen}">
        <span class="ico" style="background:${part === 'bedtime' ? 'var(--primary-soft)' : 'var(--sun-soft)'}">${part === 'bedtime' ? ic.moon(20, 'var(--primary)') : ic.sun(20, 'var(--sun-ink)')}</span>
        <span class="grow col tight"><span class="bold">${label}${now ? ' <span class="tag primary" style="margin-left:4px;padding:2px 8px">Now</span>' : ''}</span><span class="small muted bold">${done} of ${list.length} done</span></span>
        <span class="small bold" style="color:var(--primary)">${isOpen ? 'Hide' : 'Show'}</span></button>
      ${isOpen ? routineItems(part) : ''}`;
  }).join('');
  const beh = behaviourMissions().map(m => {
    const logs = logsFor(m);
    const ok = logs.filter(l => l.status === 'approved').length;
    return `<div class="list-item"><span class="ico" style="background:var(--teal-soft)">${ic.heart(20, 'var(--teal)')}</span>
      <span class="grow col tight"><span class="bold">${esc(m.title)}</span><span class="small muted">${ok} of ${m.checkins} check-ins · +${m.points} each</span></span></div>`;
  }).join('');
  const school = isWeekend(t) ? '' : `<div class="list-item"><span class="ico" style="background:var(--primary-soft)">${ic.school(20, 'var(--primary)')}</span>
    <span class="grow col tight"><span class="bold">Made it to school</span><span class="small muted">${att ? (att.status === 'went' ? 'Yes! +20' : att.status === 'partly' ? 'Part of the day +10' : 'Fresh start tomorrow') : `${esc(P())} confirms · +20`}</span></span></div>`;
  return `<section class="col" style="gap:10px">
    <h2 class="h2">Today's missions</h2>
    ${sections || '<div class="empty">No routine steps yet</div>'}
    ${school}${beh}
  </section>`;
}

function mountain() {
  return `<div class="screen">${header()}${pushCard('child')}${heartCard()}${giftCard()}${mountainCard()}${missionsCard()}</div>`;
}

// ───────── Calm Corner ─────────
function calm() {
  const u = ui();
  const feelings = ['Scared', 'Worried', 'Angry', 'Sad', 'Frustrated'];
  const tool = (act, title, sub, icon, bg) => `<button class="card" style="border:none;text-align:left;gap:6px;padding:14px" data-act="${act}">
      <span class="ico" style="width:40px;height:40px;border-radius:12px;background:${bg};display:flex;align-items:center;justify-content:center">${icon}</span>
      <span class="bold">${title}</span><span class="small muted">${sub}</span></button>`;
  return `<div class="screen calm">
    <header class="col tight"><span class="h1">Calm Corner</span><span class="small muted bold">Feelings are OK. Let's help your body feel safe.</span></header>
    <div class="col"><span class="bold">How do you feel?</span>
      <div class="row wrap" style="gap:8px">${feelings.map(f => `<button class="pill teal ${u.feeling === f ? 'on' : ''}" data-act="feel" data-v="${f}" aria-pressed="${u.feeling === f}">${f}</button>`).join('')}</div></div>
    <section class="card" style="flex-direction:row;align-items:center;gap:16px">
      <div style="width:110px;height:110px;border-radius:999px;background:var(--teal-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0" aria-hidden="true">
        <div class="breathe-ball" style="width:100px;height:100px;font-size:16px">Breathe</div></div>
      <div class="col"><span class="display" style="font-size:19px">Balloon breathing</span><span class="small muted">Breathe in as it grows, out as it shrinks. 1 minute.</span>
        <button class="btn teal sm" style="align-self:flex-start" data-act="openBreathe">Start</button></div>
    </section>
    <div class="grid2">
      ${tool('openGround', '5 · 4 · 3 · 2 · 1', 'Notice things around you', ic.eye(20, 'var(--primary)'), 'var(--primary-soft)')}
      ${tool('openWorry', 'Worry box', 'Lock a worry until worry time', ic.box(20, 'var(--sun-ink)'), 'var(--sun-soft)')}
      ${tool('openVoice', 'Brave voice', `A message from ${esc(P())}`, ic.play(20, 'var(--teal)'), 'var(--teal-soft)')}
      ${tool('openSafety', 'My safety plan', 'Who takes care of me', ic.shield(20, 'var(--rose)'), 'var(--rose-soft)')}
    </div>
    <div class="row" style="justify-content:center;background:#fff;border-radius:999px;padding:12px 16px">${ic.star(18)}<span class="small bold">+5 Calm points each time you use a tool (up to 3 a day)</span></div>
  </div>`;
}

// ───────── Rewards ─────────
function rewards() {
  const u = ui();
  const sch = ladder('school');
  const summits = state.d.gifts.filter(g => g.kind === 'summit' && g.status !== 'given');
  const grand = state.d.gifts.filter(g => g.kind === 'grand' && g.status !== 'given').slice(-1)[0];
  const list = state.d.rewards.filter(r => r.active && r.tier === u.tier);
  const bal = state.d.balance;
  const ready = state.d.redemptions.filter(r => r.status === 'approved');
  const waiting = state.d.redemptions.filter(r => r.status === 'claimed');
  const ps = paths();
  const topped = ps.filter(l => !currentStep(l) && stepsOf(l).length).length;
  const bigCard = (eyebrow, title, photo, sub, won) => `<section class="card sun" style="flex-direction:row;align-items:center;gap:14px;padding:14px">
      <div style="width:76px;height:76px;border-radius:16px;flex-shrink:0;${photo ? `background:url('${esc(photo)}') center/cover` : 'background:repeating-linear-gradient(45deg,#FFF1D6 0 10px,#FFE6B3 10px 20px)'};display:flex;align-items:center;justify-content:center">${photo ? '' : ic.flag(28, 'var(--sun-ink)')}</div>
      <div class="col tight"><span class="eyebrow" style="color:var(--sun-ink)">${eyebrow}</span><span class="display" style="font-size:19px">${esc(title)}</span>
      <span class="small ${won ? 'bold' : 'muted'}" style="${won ? 'color:var(--teal)' : ''}">${sub}</span></div></section>`;
  return `<div class="screen">
    <header class="row between"><span class="h1">Rewards</span><div class="points-pill">${ic.star()}<span>${bal}</span><span class="small muted">pts</span></div></header>

    ${ready.length || waiting.length ? `<section class="col" style="gap:10px"><h2 class="h2">My prizes</h2>
      ${ready.map(r => `<div class="list-item" style="border:2px dashed var(--teal);background:var(--teal-soft)">
        <span style="font-size:28px" aria-hidden="true">🎟️</span>
        <span class="grow col tight"><span class="bold">${esc(fillP(r.name))}</span><span class="small bold" style="color:var(--teal)">Ready to use! Tell ${esc(P())} when you want it.</span></span></div>`).join('')}
      ${waiting.map(r => `<div class="list-item">
        <span style="font-size:24px" aria-hidden="true">⏳</span>
        <span class="grow col tight"><span class="bold">${esc(fillP(r.name))}</span><span class="small muted bold">Waiting for ${esc(P())} to say yes</span></span></div>`).join('')}
    </section>` : ''}

    <section class="col" style="gap:10px"><h2 class="h2">Prize shop</h2>
      <span class="small muted bold">Spend your points. You have ${bal}.${u.tier === 'weekly' ? ' Each weekly prize once a week.' : ''}</span>
      <div class="seg" role="tablist"><button data-act="kidTier" data-v="daily" class="${u.tier === 'daily' ? 'on' : ''}">Daily prizes</button><button data-act="kidTier" data-v="weekly" class="${u.tier === 'weekly' ? 'on' : ''}">Weekly prizes</button></div>
      ${list.map(r => `<div class="list-item">
        <span class="grow col tight"><span class="bold">${esc(fillP(r.name))}</span><span class="small muted bold">${r.price} pts</span></span>
        ${takenThisWeek(r) ? `<span class="small bold" style="color:var(--teal);text-align:right;max-width:110px">Got it this week ✓<br><span class="tiny muted">Back on Monday</span></span>` : bal >= r.price ? `<button class="btn sm primary" data-act="askRedeem" data-r="${r.id}">Get it</button>` : `<span class="small bold muted" style="text-align:right;max-width:100px">${r.price - bal} more to go</span>`}
      </div>`).join('') || '<div class="empty">No prizes here yet</div>'}
    </section>

    ${summits.length || grand ? `<section class="col" style="gap:10px"><h2 class="h2">Big prizes</h2>
      <span class="small muted bold">You win these by climbing your mountain, not with points. Your climbing is always safe.</span>
      ${summits.map(sm => { const pl = state.d.ladders.find(x => x.id === sm.ladder_id) || sch;
        return bigCard('Summit prize · ' + esc(pl?.title || ''), sm.title || 'Set it with ' + P(), sm.photo_url,
          sm.status === 'won' ? `You won it! 🏆` : `Reach the top of the ${esc(pl?.title || 'path')}`, sm.status === 'won'); }).join('')}
      ${grand ? bigCard('Grand summit', grand.title || 'Grand prize', grand.photo_url,
          grand.status === 'won' ? 'You climbed every path! 🏔️🏆' : `Reach the top of every path · ${topped} of ${ps.length} done`, grand.status === 'won') : ''}
    </section>` : ''}
    <section class="col">
      <div class="row between"><h2 class="h2">My wish list</h2></div>
      <div class="row"><input class="input grow" id="wish-text" maxlength="120" placeholder="Something I'd love…" aria-label="New wish"><button class="btn sm primary" data-act="addWish">Add</button></div>
      ${state.d.wishes.map(w => `<div class="list-item">${ic.heartFill(18)}<span class="grow bold">${esc(w.text)}</span><button class="icon-btn" style="background:var(--soft)" data-act="delWish" data-w="${w.id}" aria-label="Remove wish">${ic.close(18)}</button></div>`).join('')}
      <span class="small muted">${esc(P())} sees your wishes and might hide one in your treasure chest.</span>
    </section>
  </div>`;
}

// ───────── Tonight ─────────
function tonight() {
  const t = today();
  const ev = eventsOn(t).filter(e => e.points > 0).reverse();
  const total = sum(ev, e => e.points);
  const mon = mondayOf(t);
  const week = [0, 1, 2, 3, 4].map(i => { const d = addDays(mon, i); return { d, a: attendanceOn(d) }; });
  const proudKey = 'brave-proud-' + t;
  const proud = localStorage.getItem(proudKey);
  const streak = schoolStreak();
  return `<div class="screen night">
    <header class="row between top"><div class="col tight"><span class="small bold" style="color:#C9D2FF">${new Date().toLocaleDateString('en-GB', { weekday: 'long' })}</span><span class="h1">Today's wins, ${esc(kid())}</span></div>${ic.moon(34, '#FFD27A')}</header>
    ${partSteps('bedtime').length ? `<section class="col" style="gap:8px"><span class="bold">Bedtime routine · ${partSteps('bedtime').filter(m => logsFor(m, stepWindow(m).date)[0]).length} of ${partSteps('bedtime').length}</span>
      <div class="col night-list" style="gap:8px">${routineItems('bedtime')}</div></section>` : ''}
    <section class="card glass" style="gap:8px">
      <div class="row between"><span class="small bold" style="color:#C9D2FF">Points today</span><span class="display" style="font-size:30px;color:var(--sun)">+${total}</span></div>
      ${ev.length ? ev.map(e => `<div class="row between small"><span class="${e.category === 'improve' ? 'bold' : ''}" style="${e.category === 'improve' ? 'color:var(--mint)' : ''}">${esc(fillP(e.reason))}</span><span class="bold">+${e.points}</span></div>`).join('') : '<span class="small" style="color:#DDE3FF">No points yet today. Every day is a new chance.</span>'}
    </section>
    <section class="card glass" style="flex-direction:row;align-items:center">
      <div class="col grow"><span class="small bold">School streak: ${streak} day${streak === 1 ? '' : 's'}</span>
        <div class="row" style="gap:6px">${week.map(({ d, a }) => `<span style="width:40px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;${a?.status === 'went' ? 'background:var(--sun);color:var(--ink)' : a?.status === 'partly' ? 'background:#FFD27A;color:var(--ink)' : 'background:rgba(255,255,255,.14);color:#C9D2FF'}">${new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}</span>`).join('')}</div></div>
      <span class="tiny bold" style="color:#C9D2FF;max-width:84px;text-align:right">Full week = +50 bonus</span>
    </section>
    <div class="col"><span class="bold">What are you most proud of today?</span>
      <div class="row wrap" style="gap:8px">${['Going to school', 'Being brave', 'Calming down', 'Being kind', 'Something else'].map(p =>
        `<button class="pill" style="${proud === p ? 'background:var(--mint);border-color:var(--mint);color:var(--ink)' : 'background:transparent;color:#fff;border-color:rgba(255,255,255,.35)'}" data-act="proud" data-v="${p}" aria-pressed="${proud === p}">${p}</button>`).join('')}</div></div>
    <div class="col"><span class="bold">You have ${state.d.balance} points. Spend or save?</span>
      <div class="grid2"><button class="btn outline-light" data-act="tab" data-tab="rewards">Spend now</button><button class="btn outline-light" data-act="saveNight">Save them</button></div></div>
    <div class="col" style="align-items:center;margin-top:8px"><span class="bold center" style="color:#DDE3FF">Goodnight, brave climber. Tomorrow is a fresh start.</span></div>
    <button class="btn outline-light sm" style="align-self:center;opacity:.7;margin-top:24px" data-act="signOut">Not ${esc(kid())}? Sign out</button>
    <span class="tiny center" style="color:#8C98D9">Version ${APP_VERSION}</span>
  </div>`;
}

// ───────── Modals ─────────
export function childModal(m) {
  if (m.kind === 'feed') return feedModal(m);
  if (m.kind === 'fear') return fearModal(m);
  if (m.kind === 'breathe') return `<div class="modal calm" role="dialog" aria-modal="true" aria-label="Balloon breathing">
    <div class="row between"><span class="h2">Balloon breathing</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
    <div class="breathe-wrap"><div class="breathe-ball">Breathe</div></div>
    <p class="center bold" style="margin:0">Breathe in slowly as the balloon grows.<br>Breathe out as it shrinks.</p>
    <p class="center muted small" style="margin:0" id="breathe-timer">1:00</p>
    <button class="btn teal block" data-act="calmDone" data-tool="Balloon breathing">I feel calmer</button></div>`;
  if (m.kind === 'ground') {
    const steps = [['5', 'things you can SEE'], ['4', 'things you can TOUCH'], ['3', 'things you can HEAR'], ['2', 'things you can SMELL'], ['1', 'thing you can TASTE']];
    const i = m.i || 0; const [n, txt] = steps[i];
    return `<div class="modal calm" role="dialog" aria-modal="true" aria-label="5 4 3 2 1">
      <div class="row between"><span class="h2">5 · 4 · 3 · 2 · 1</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
      <div class="card center" style="align-items:center;padding:28px"><span class="display" style="font-size:72px;color:var(--teal)">${n}</span><span class="h2">${txt}</span><span class="small muted">Look around slowly. Say them out loud or in your head.</span></div>
      ${i < 4 ? `<button class="btn teal block" data-act="groundNext">Next</button>` : `<button class="btn teal block" data-act="calmDone" data-tool="5-4-3-2-1">I'm back. All done!</button>`}
    </div>`;
  }
  if (m.kind === 'worry') return `<div class="modal calm" role="dialog" aria-modal="true" aria-label="Worry box">
    <div class="row between"><span class="h2">Worry box</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
    <p style="margin:0" class="bold">Write or say your worry. We'll lock it in the box until worry time with ${esc(P())} tonight.</p>
    <textarea class="input" id="worry-text" maxlength="500" placeholder="I'm worried that…" aria-label="Your worry"></textarea>
    <button class="btn teal block" data-act="saveWorry">${ic.lock(18, '#fff')} Lock it in the box</button></div>`;
  if (m.kind === 'voice') {
    const f = state.family;
    return `<div class="modal calm" role="dialog" aria-modal="true" aria-label="Brave voice">
      <div class="row between"><span class="h2">A message from ${esc(P())}</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
      ${f.brave_audio_url ? `<audio controls src="${esc(f.brave_audio_url)}" style="width:100%"></audio>` : ''}
      <div class="card"><span class="display" style="font-size:20px;line-height:1.35">${esc(fillP(f.brave_message || `You are safe. You are brave. I love you, and I'll see you soon.`))}</span><span class="small muted">— ${esc(P())}</span></div>
      <button class="btn teal block" data-act="calmDone" data-tool="Brave voice">Thanks, I feel braver</button></div>`;
  }
  if (m.kind === 'safety') return `<div class="modal calm" role="dialog" aria-modal="true" aria-label="My safety plan">
    <div class="row between"><span class="h2">My safety plan</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
    <div class="card"><span style="white-space:pre-line;font-size:17px;line-height:1.5">${esc(fillP(state.family.safety_plan || ''))}</span></div>
    <button class="btn teal block" data-act="calmDone" data-tool="Safety plan">I feel safer</button></div>`;
  if (m.kind === 'redeem') {
    const r = state.d.rewards.find(x => x.id === m.r);
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Get prize">
      <span class="h2">Get "${esc(fillP(r.name))}"?</span>
      <p class="muted" style="margin:0">It costs ${r.price} points. You'll have ${state.d.balance - r.price} left. ${esc(P())} will say yes, then it waits in My prizes until you use it.</p>
      <div class="grid2"><button class="btn ghost" data-act="closeModal">Not now</button><button class="btn primary" data-act="doRedeem" data-r="${r.id}">Yes, get it!</button></div></div>`;
  }
  if (m.kind === 'reveal') return revealModal(m);
  return '';
}

function fearModal(m) {
  const f = m.fear ?? 5;
  const tone = f <= 3 ? '#0B7A70' : f <= 6 ? '#A85A00' : '#B4366B';
  const msg = f <= 3 ? 'Feeling pretty calm. Nice!' : f <= 6 ? 'A bit scared, and that is OK.' : 'Really scared. Try the Calm Corner first, then decide together.';
  const before = m.phase === 'before';
  const step = state.d.steps.find(s => s.id === m.stepId);
  const prev = attemptsOf(step).filter(a => a.fear_before != null).slice(-3);
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="Fear thermometer">
    <div class="row between"><span class="tag primary">Camp ${step?.position} · ${esc(fillP(step?.title || ''))}</span><button class="icon-btn" data-act="closeModal" aria-label="Close">${ic.close()}</button></div>
    <span class="h1">${before ? 'How scared do you feel right now?' : 'How scary was it while you did it?'}</span>
    <div class="row top" style="gap:18px">
      <div class="col" style="align-items:center;gap:0;width:56px" role="img" aria-label="Fear ${f} out of 10">
        <div class="tube"><div style="height:${f * 19}px;background:${tone}"></div></div><div class="bulb" style="background:${tone}">${f}</div></div>
      <div class="col grow"><div class="fear-grid">${Array.from({ length: 11 }, (_, i) => `<button data-act="fearPick" data-v="${i}" aria-pressed="${i === f}" aria-label="${i} out of 10" style="${i === f ? `background:${tone};border-color:${tone};color:#fff` : ''}">${i}</button>`).join('')}</div>
        <div class="row between tiny bold muted"><span>0 = calm</span><span>10 = super scared</span></div></div>
    </div>
    <div class="card" style="gap:4px"><span class="bold">${msg}</span><span class="small muted">Brave means doing it even when you feel scared.</span></div>
    ${prev.length ? `<div class="small muted bold">Last times on this step: ${prev.map(a => a.fear_before).join(' → ')}</div>` : ''}
    <button class="btn primary block" data-act="fearSave">${before ? "I'm ready, let's go!" : 'Save'}</button>
    ${before && f >= 7 ? `<button class="btn ghost-teal block" data-act="calmFromBrave">Open the Calm Corner first</button>` : ''}
  </div>`;
}

function revealModal(m) {
  const g = mystery();
  if (!g) return '';
  const fromLocks = locksOf(g, m.from ?? seen(g));
  const nowLocks = locksOf(g);
  const fresh = nowLocks - fromLocks;
  const opened = m.opened;
  const won = nowLocks >= LOCKS;
  const showGift = won && (opened || fresh <= 0);
  const sec = secretFor(g);
  const locks = Array.from({ length: LOCKS }, (_, i) => {
    if (i < fromLocks) return padlock(true);
    if (i < nowLocks) return opened ? padlock(true, 'just-opened') : padlock(false, 'glowing');
    return padlock(false, 'dim');
  }).join('');
  const confetti = showGift ? ['#FFB020', '#7C8CFF', '#5ED3C3', '#F28DB2', '#FFB020', '#7C8CFF', '#5ED3C3', '#F28DB2'].map((c, i) =>
    `<span class="confetti" aria-hidden="true" style="background:${c};width:${8 + (i % 3) * 3}px;height:${6 + (i % 2) * 6}px;left:${[8, 88, 78, 14, 92, 4, 50, 66][i]}%;top:${[4, 3, 14, 18, 26, 32, 6, 22][i]}%;transform:rotate(${i * 37}deg)"></span>`).join('') : '';
  const title = showGift ? `You did it, ${esc(kid())}!` : fresh > 0 ? (opened ? 'Click! A lock opened!' : 'You climbed higher!') : 'Your treasure chest';
  return `<div class="modal night" role="dialog" aria-modal="true" aria-label="Treasure chest" style="position:relative;align-items:center;text-align:center">
    ${confetti}
    <div class="row" style="width:100%;justify-content:flex-end"><button class="icon-btn" style="background:rgba(255,255,255,.12);color:#fff" data-act="closeReveal" aria-label="Close">${ic.close()}</button></div>
    ${fresh > 0 && !showGift ? `<span class="tag mint">${fresh} new lock${fresh === 1 ? '' : 's'}!</span>` : ''}
    <span class="h1" style="font-size:30px">${title}</span>
    <div class="${showGift ? 'chest-open' : opened && fresh > 0 ? 'chest-wiggle' : ''}">${chestSvg(showGift, 210)}</div>
    ${showGift ? `
      ${g.photo_url ? `<div style="width:100%;aspect-ratio:4/3;border-radius:18px;background:url('${esc(g.photo_url)}') center/cover;box-shadow:0 0 0 4px #FFB020" role="img" aria-label="${esc(sec?.secret_title || 'Your surprise')}"></div>` : ''}
      <span class="display" style="font-size:26px;color:var(--sun)">${sec ? `It's: ${esc(sec.secret_title)}!` : 'Your surprise is ready!'}</span>
      <span class="small" style="color:#DDE3FF">Show ${esc(P())} to get it.</span>`
    : `<div class="row" style="gap:12px;justify-content:center" role="img" aria-label="${nowLocks} of ${LOCKS} locks open">${locks}</div>
      <span class="bold" style="color:#DDE3FF">${nowLocks} of ${LOCKS} locks open${won ? '' : ` · ${LOCKS - nowLocks} to go`}</span>
      <span class="small" style="color:#C9D2FF">What's inside is a secret until the last lock opens.</span>`}
    ${fresh > 0 && !opened ? `<button class="btn sun block" data-act="revealPieces">${won ? 'Open the last lock!' : `Open the new lock${fresh === 1 ? '' : 's'}`}</button>` : `<button class="btn outline-light block" data-act="closeReveal">Back to my mountain</button>`}
  </div>`;
}

// ───────── Actions ─────────
async function logCalm(tool) {
  const t = today();
  const calmToday = eventsOn(t).filter(e => e.category === 'calm').length;
  await run(sb.from('calm_uses').insert({ family_id: state.profile.family_id, tool, feeling: ui().feeling }));
  closeModal();
  toast(calmToday < 3 ? '+5 Calm points. Great job!' : 'Great job using your calm tools!');
  scheduleReload();
}

let breatheTimer = null;
export const childActions = {
  kidPart: el => { const u = ui(); const cur = u.openPart || currentPart(); u.openPart = cur === el.dataset.v ? 'none' : el.dataset.v; render(); },
  kidPath: el => { ui().path = el.dataset.v; render(); },
  kidTier: el => { ui().tier = el.dataset.v; render(); },
  feel: el => { ui().feeling = el.dataset.v; render(); },
  async heartBack() {
    await run(sb.from('hearts').insert({ family_id: state.profile.family_id, from_role: 'child' }), `Heart sent to ${P()}!`);
    scheduleReload();
  },
  startBrave: el => openModal('fear', { phase: 'before', stepId: el.dataset.step, fear: 5 }),
  afterBrave: el => {
    const a = state.d.attempts.find(x => x.id === el.dataset.att);
    openModal('fear', { phase: 'after', stepId: a.step_id, attemptId: a.id, fear: a.fear_before ?? 5 });
  },
  calmFromBrave: () => { state.modal = null; state.tab = 'calm'; render(); },
  fearPick: el => { state.modal.fear = parseInt(el.dataset.v, 10); render(); },
  async fearSave() {
    const m = state.modal;
    if (m.phase === 'before') {
      await run(sb.from('brave_attempts').insert({ family_id: state.profile.family_id, step_id: m.stepId, fear_before: m.fear, attempt_date: today() }));
      closeModal(); toast('Go be brave! Come back after and tap "I did it".');
    } else {
      await run(sb.from('brave_attempts').update({ fear_after: m.fear }).eq('id', m.attemptId));
      closeModal(); toast(`Saved! ${P()} will confirm your points.`);
    }
    await loadAll(); render();
  },
  async toggleRoutine(el) {
    const m = state.d.missions.find(x => x.id === el.dataset.m);
    const w = m.kind === 'routine' ? stepWindow(m) : { open: true, date: today() };
    const log = logsFor(m, w.date)[0];
    if (log && log.status !== 'pending') return toast(log.status === 'approved' ? 'Already approved!' : `Ask ${P()} about this one`);
    if (!log && !w.open) return toast(`Not yet! ${w.note}. Tick it after you've done it.`);
    if (log) await run(sb.from('mission_logs').delete().eq('id', log.id));
    else await run(sb.from('mission_logs').insert({ family_id: state.profile.family_id, mission_id: m.id, log_date: w.date, slot: 1, status: 'pending' }));
    await loadAll(); render();
  },
  openBreathe: () => {
    openModal('breathe');
    clearInterval(breatheTimer);
    let left = 60;
    breatheTimer = setInterval(() => {
      left--; const el = document.getElementById('breathe-timer');
      if (!el || !state.modal || state.modal.kind !== 'breathe') return clearInterval(breatheTimer);
      el.textContent = left > 0 ? `0:${String(left).padStart(2, '0')}` : 'Well done!';
      if (left <= 0) clearInterval(breatheTimer);
    }, 1000);
  },
  openGround: () => openModal('ground', { i: 0 }),
  groundNext: () => { state.modal.i = (state.modal.i || 0) + 1; render(); },
  openWorry: () => openModal('worry'),
  openVoice: () => openModal('voice'),
  openSafety: () => openModal('safety'),
  calmDone: el => logCalm(el.dataset.tool),
  async saveWorry() {
    const text = (document.getElementById('worry-text')?.value || '').trim();
    if (!text) return toast('Write your worry first');
    await run(sb.from('worries').insert({ family_id: state.profile.family_id, text }));
    await logCalm('Worry box');
    toast('Locked in the box. +5 Calm points');
  },
  askRedeem: el => openModal('redeem', { r: el.dataset.r }),
  async doRedeem(el) {
    const r = state.d.rewards.find(x => x.id === el.dataset.r);
    await run(sb.rpc('redeem_reward', { p_reward: r.id }));
    closeModal(); toast(`Sent to ${P()}! When ${P()} says yes, it goes to My prizes.`);
    await loadAll(); render();
  },
  async addWish() {
    const text = (document.getElementById('wish-text')?.value || '').trim();
    if (!text) return;
    await run(sb.from('wishes').insert({ family_id: state.profile.family_id, text }), 'Added to your wish list');
    await loadAll(); render();
  },
  async delWish(el) { await run(sb.from('wishes').delete().eq('id', el.dataset.w)); await loadAll(); render(); },
  proud: el => { localStorage.setItem('brave-proud-' + today(), el.dataset.v); render(); },
  saveNight: () => toast('Saved! Your points are waiting for a bigger prize.'),
  openReveal: () => { const g = mystery(); openModal('reveal', { from: seen(g), opened: false }); },
  revealPieces: () => { const g = mystery(); state.modal.opened = true; localStorage.setItem(seenKey(g), String(g.pieces_unlocked)); render(); },
  closeReveal: () => closeModal()
};
