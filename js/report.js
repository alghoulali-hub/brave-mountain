// Shareable progress report: narrative text, charts and "compared with before" numbers.
// The same self-contained HTML is shown in the app (iframe) and shared as a file / printed to PDF.
import { state, esc, kid, P, fillP, today, addDays, localDay, paths, stepsOf, currentStep, appliesOn, routineMissions, behaviourMissions, PARTS, isWeekend, render, toast } from './core.js';
import { foodMissions } from './food.js';
import { ic } from './icons.js';

const C = { ink: '#1B2559', muted: '#5B6585', line: '#E6E9F2', soft: '#F3F5FB', primary: '#3A4FD8', primarySoft: '#E4E8FB', sun: '#FFB020', sunSoft: '#FFE3A6', teal: '#0B7A70', tealSoft: '#D5EFEC', rose: '#B4366B', roseSoft: '#F8DCE8' };
const NOTE_KEY = 'brave-report-note';
const RW = 400; // chart drawing width: labels stay readable on a phone
const opts = () => (state.ui.report ||= { range: 'week', weights: false, detail: true });

const fmtD = (d, o = { day: 'numeric', month: 'short' }) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', o);
const dow = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' });
const daysBetween = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
const pct = (a, b) => b ? Math.round(100 * a / b) : null;
const avg = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
const r1 = x => x == null ? '–' : (Math.round(x * 10) / 10).toString();
const plural = (n, w, ws = w + 's') => `${n} ${n === 1 ? w : ws}`;
const balanced = g => (g.includes('veg') || g.includes('fruit')) && g.includes('protein');

function firstDay() {
  const ds = [...state.d.events.map(e => localDay(e.created_at)), ...state.d.attendance.map(a => a.day), ...state.d.logs.map(l => l.log_date), ...state.d.attempts.map(a => a.attempt_date)].filter(Boolean).sort();
  return ds[0] || today();
}

// ───────── numbers for one period ─────────
function stats(from, to) {
  const inR = d => d >= from && d <= to;
  const days = daysBetween(from, to);
  const ev = state.d.events.filter(e => inR(localDay(e.created_at)));
  const earned = ev.filter(e => e.points > 0);
  const att = state.d.attendance.filter(a => inR(a.day));
  const schoolDays = days.filter(d => !isWeekend(d) && d <= today());
  const attempts = state.d.attempts.filter(a => inR(a.attempt_date));
  const rated = attempts.filter(a => a.fear_before != null);
  const both = attempts.filter(a => a.fear_before != null && a.fear_after != null);
  const camps = ev.filter(e => e.category === 'camp').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const appr = state.d.logs.filter(l => inR(l.log_date) && l.status === 'approved');
  const routine = {};
  let rDone = 0, rExp = 0;
  PARTS.forEach(([part]) => {
    let done = 0, exp = 0;
    routineMissions(part).forEach(m => days.forEach(d => { if (d > today() || !appliesOn(m, d)) return; exp++; if (appr.some(l => l.mission_id === m.id && l.log_date === d)) done++; }));
    routine[part] = { done, exp, pct: pct(done, exp) };
    rDone += done; rExp += exp;
  });
  const sleepM = state.d.missions.filter(m => m.kind === 'routine' && /own bed/i.test(m.title));
  const asleep = sleepM.find(m => /fell asleep/i.test(m.title)), night = sleepM.find(m => /all night/i.test(m.title));
  const nights = m => m ? appr.filter(l => l.mission_id === m.id).length : null;
  const beh = behaviourMissions();
  const behDone = appr.filter(l => beh.some(m => m.id === l.mission_id)).length;
  const behExp = beh.reduce((s, m) => s + (m.checkins || 1), 0) * days.filter(d => d <= today()).length;
  const calm = state.d.calm.filter(c => inR(localDay(c.created_at)));
  const focus = (state.d.focus || []).filter(s => inR(localDay(s.started_at)));
  const meals = (state.d.meals || []).filter(m => inR(m.day));
  const fm = new Set(foodMissions().map(m => m.id));
  return {
    from, to, days, ev, earned, points: earned.reduce((s, e) => s + e.points, 0), spent: -ev.filter(e => e.points < 0).reduce((s, e) => s + e.points, 0),
    activeDays: new Set(earned.map(e => localDay(e.created_at))).size,
    att, schoolDays, full: att.filter(a => a.status === 'went').length, part: att.filter(a => a.status === 'partly').length, home: att.filter(a => a.status === 'no').length,
    attempts, done: attempts.filter(a => a.result === 'done').length, tried: attempts.filter(a => a.result === 'tried').length,
    fearBefore: avg(rated.map(a => a.fear_before)), fearDrop: avg(both.map(a => a.fear_before - a.fear_after)), camps,
    routine, routinePct: pct(rDone, rExp), rDone, rExp,
    asleep: nights(asleep), night: nights(night), hasSleep: !!(asleep || night), nightsCount: days.filter(d => d < today() || d === today()).length,
    behPct: pct(behDone, behExp), behDone, behExp,
    calm, focusDone: focus.filter(s => s.completed), focusMin: focus.filter(s => s.completed).reduce((s, x) => s + x.minutes, 0), focusStopped: focus.filter(s => !s.completed).length,
    meals, balancedMeals: meals.filter(m => balanced(m.groups)).length, foodDone: appr.filter(l => fm.has(l.mission_id)).length
  };
}

function periods() {
  const o = opts(); const t = today(); const start = firstDay();
  if (o.range === 'all') {
    // whole story since the start; "improvement" = latest days vs the first days
    const cur = stats(start, t);
    const n = cur.days.length;
    if (n < 6) return { cur, prev: null, q: cur, label: 'Since we started', cmpLabel: '', nowLabel: '' };
    const k = n >= 14 ? 7 : Math.floor(n / 2);
    return { cur, prev: stats(start, addDays(start, k - 1)), q: stats(addDays(t, -(k - 1)), t), label: 'Since we started',
      cmpLabel: k === 7 ? 'in the first week' : `in the first ${k} days`, nowLabel: k === 7 ? 'in the last week' : `in the last ${k} days` };
  }
  const n = o.range === 'week' ? 7 : 30;
  const from = addDays(t, -(n - 1)) < start ? start : addDays(t, -(n - 1)); // don't count days before the app was used
  let cmpTo = addDays(from, -1), cmpFrom = addDays(from, -n);
  let cmpLabel = o.range === 'week' ? 'the week before' : 'the 30 days before';
  if (cmpTo < start) cmpFrom = null;
  else if (cmpFrom < start) { cmpFrom = start; cmpLabel = 'the days before'; }
  const cur = stats(from, t);
  return { cur, prev: cmpFrom ? stats(cmpFrom, cmpTo) : null, q: cur, label: o.range === 'week' ? 'Last 7 days' : 'Last 30 days', cmpLabel, nowLabel: '' };
}
const perWeek = (x, st) => x / Math.max(1, st.days.length) * 7;

// trend words and badges
function change(now, before, { better = 'up', unit = '', dec = 0, pctPoints = false } = {}) {
  if (now == null || before == null) return null;
  const d = now - before; const f = x => (dec ? r1(Math.abs(x)) : Math.round(Math.abs(x))) + unit;
  if (Math.abs(d) < (dec ? 0.25 : 1)) return { dir: 'same', good: null, text: 'about the same', badge: '= same' };
  const up = d > 0; const good = better === 'up' ? up : better === 'down' ? !up : null;
  return { dir: up ? 'up' : 'down', good, text: `${up ? 'up' : 'down'} ${pctPoints ? f(d).replace('%', ' points') : 'from ' + (dec ? r1(before) : Math.round(before)) + unit}`, badge: `${up ? '▲' : '▼'} ${f(d)}${pctPoints ? '' : ''}` };
}
const badge = c => !c ? '' : `<span class="rp-badge ${c.good === true ? 'good' : c.good === false ? 'warn' : ''}">${c.badge}</span>`;

// ───────── SVG charts ─────────
function barChart(days, values, { color = C.primary, unit = '', h = 150, label = '', avgLine = true } = {}) {
  const W = RW, top = 18, bottom = 26, n = days.length, max = Math.max(1, ...values);
  const bw = (W - 20) / n, ih = h - top - bottom;
  const a = avg(values.filter((_, i) => days[i] <= today()));
  const showLabels = n <= 14 ? days.map((_, i) => true) : days.map((_, i) => i % 5 === 0 || i === n - 1);
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">
    <line x1="10" x2="${W - 10}" y1="${top + ih}" y2="${top + ih}" stroke="${C.line}"/>
    ${values.map((v, i) => { const bh = v ? Math.max(3, ih * v / max) : 0; const x = 10 + i * bw + bw * 0.15; return `${bh ? `<rect x="${x.toFixed(1)}" y="${(top + ih - bh).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(6, bw * 0.25).toFixed(1)}" fill="${color}"/>` : ''}
      ${v && n <= 14 ? `<text x="${(x + bw * 0.35).toFixed(1)}" y="${(top + ih - bh - 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.ink}">${v}</text>` : ''}
      ${showLabels[i] ? `<text x="${(x + bw * 0.35).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="11" fill="${C.muted}">${n <= 8 ? fmtD(days[i], { weekday: 'short' }) : fmtD(days[i], { day: 'numeric' })}</text>` : ''}`; }).join('')}
    ${avgLine && a ? `<line x1="10" x2="${W - 10}" y1="${(top + ih - ih * a / max).toFixed(1)}" y2="${(top + ih - ih * a / max).toFixed(1)}" stroke="${C.sun}" stroke-width="2" stroke-dasharray="5 4"/><text x="${W - 12}" y="${(top + ih - ih * a / max - 5).toFixed(1)}" text-anchor="end" font-size="11" font-weight="800" fill="#9A6400" stroke="#fff" stroke-width="3" paint-order="stroke">average ${Math.round(a)}${unit}</text>` : ''}
  </svg>`;
}

function schoolStrip(s) {
  const days = s.days.filter(d => !isWeekend(d));
  if (!days.length) return '';
  const cell = 32, gap = 6, perRow = Math.min(days.length, 10), rows = Math.ceil(days.length / perRow);
  const W = perRow * (cell + gap), H = rows * (cell + gap + 14);
  return `<svg class="rp-svg" viewBox="0 0 ${Math.max(W, 200)} ${H}" style="max-width:${Math.max(W, 200) * 1.1}px" role="img" aria-label="School days">
    ${days.map((d, i) => { const a = s.att.find(x => x.day === d); const x = (i % perRow) * (cell + gap), y = Math.floor(i / perRow) * (cell + gap + 14);
      const fill = a?.status === 'went' ? C.sun : a?.status === 'partly' ? C.sunSoft : a?.status === 'no' ? C.line : '#fff';
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="8" fill="${fill}" stroke="${a ? fill : C.line}" stroke-width="1.5" ${!a && d <= today() ? 'stroke-dasharray="3 3"' : ''}/>
        <text x="${x + cell / 2}" y="${y + cell / 2 + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="${a?.status === 'no' || !a ? C.muted : C.ink}">${fmtD(d, { day: 'numeric' })}</text>
        <text x="${x + cell / 2}" y="${y + cell + 12}" text-anchor="middle" font-size="10" fill="${C.muted}">${dow(d)}</text>`; }).join('')}
  </svg>${legend([[C.sun, 'Full day'], [C.sunSoft, 'Part of day'], [C.line, 'At home'], ['#fff', 'Not recorded']])}`;
}
const legend = items => `<div class="rp-legend">${items.map(([c, t]) => `<span><i style="background:${c};${c === '#fff' ? `border:1.5px dashed ${C.line}` : ''}"></i>${t}</span>`).join('')}</div>`;

function fearChart(path, from) {
  const ids = new Set(stepsOf(path).map(s => s.id));
  let series = state.d.attempts.filter(a => ids.has(a.step_id) && a.fear_before != null && a.attempt_date >= from);
  if (!series.length) return '';
  series = series.slice(-20);
  const W = RW, H = 200, x0 = 30, x1 = W - 16, yv = v => 20 + (10 - v) * 14;
  const xs = i => series.length <= 1 ? (x0 + x1) / 2 : x0 + i * (x1 - x0) / (series.length - 1);
  let out = '', segs = [[]], last = null;
  series.forEach((a, i) => {
    if (last && a.step_id !== last) { segs.push([]); const pos = state.d.steps.find(s => s.id === a.step_id)?.position; out += `<line x1="${xs(i) - 10}" x2="${xs(i) - 10}" y1="16" y2="${yv(0)}" stroke="${C.primarySoft}" stroke-width="2" stroke-dasharray="4 4"/><text x="${Math.min(xs(i) - 6, W - 4)}" y="14" text-anchor="${xs(i) > W - 50 ? 'end' : 'start'}" font-size="11" font-weight="800" fill="${C.primary}">Camp ${pos}</text>`; }
    segs[segs.length - 1].push(`${xs(i).toFixed(1)},${yv(a.fear_before)}`); last = a.step_id;
  });
  const first = state.d.steps.find(s => s.id === series[0].step_id)?.position;
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fear ratings on the ${esc(path.title)}">
    ${[0, 5, 10].map(v => `<line x1="${x0 - 6}" x2="${W - 8}" y1="${yv(v)}" y2="${yv(v)}" stroke="${C.line}"/><text x="${x0 - 12}" y="${yv(v) + 4}" text-anchor="end" font-size="11" fill="${C.muted}">${v}</text>`).join('')}
    <rect x="${x0 - 6}" y="${yv(3)}" width="${W - x0 - 2}" height="${yv(0) - yv(3)}" fill="${C.tealSoft}" opacity=".55"/>
    <text x="${W - 10}" y="${yv(0) - 6}" text-anchor="end" font-size="11" font-weight="800" fill="${C.teal}" stroke="#fff" stroke-width="3" paint-order="stroke">calm zone (0–3)</text>
    <text x="${x0}" y="14" font-size="11" font-weight="800" fill="${C.primary}">Camp ${first}</text>
    ${out}
    ${segs.map(sg => sg.length > 1 ? `<polyline points="${sg.join(' ')}" fill="none" stroke="${C.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : '').join('')}
    ${series.map((a, i) => `${a.fear_after != null ? `<line x1="${xs(i).toFixed(1)}" x2="${xs(i).toFixed(1)}" y1="${yv(a.fear_before)}" y2="${yv(a.fear_after)}" stroke="${C.teal}" stroke-width="2"/><circle cx="${xs(i).toFixed(1)}" cy="${yv(a.fear_after)}" r="5" fill="#fff" stroke="${C.teal}" stroke-width="2.5"/>` : ''}
      <circle cx="${xs(i).toFixed(1)}" cy="${yv(a.fear_before)}" r="5.5" fill="${a.result === 'done' ? C.primary : a.result === 'tried' ? C.sun : '#9AA3C0'}"/>`).join('')}
    <text x="${x0}" y="${H - 6}" font-size="11" fill="${C.muted}">${fmtD(series[0].attempt_date)}</text><text x="${x1}" y="${H - 6}" text-anchor="end" font-size="11" fill="${C.muted}">${fmtD(series[series.length - 1].attempt_date)}</text>
  </svg>${legend([[C.primary, 'Fear before (done)'], [C.sun, 'Fear before (tried)'], [C.teal, 'Fear during / after']])}`;
}

function pathBars(s) {
  return paths().map(l => {
    const steps = stepsOf(l), cur = l.current_position, n = steps.length;
    const climbed = s.camps.filter(e => (e.ref || '').startsWith('camp:' + l.id + ':')).length;
    const step = currentStep(l);
    return `<div class="rp-path"><div class="rp-row"><b>${esc(l.title)}</b><span class="rp-muted">${step ? `Camp ${cur} of ${n}` : 'Top reached'}${climbed ? ` · <b style="color:${C.teal}">+${climbed} this period</b>` : ''}</span></div>
      <div class="rp-camps">${steps.map(st => `<span class="${st.position < cur ? 'done' : st.position === cur ? 'now' : ''}" title="${esc(fillP(st.title))}"></span>`).join('')}</div>
      ${step ? `<div class="rp-small">Working on: ${esc(fillP(step.title))}</div>` : ''}</div>`;
  }).join('');
}

function heatmap(s) {
  const rows = [];
  PARTS.forEach(([part, name]) => { const ms = routineMissions(part); if (ms.length) rows.push([name.replace(' routine', ''), d => { const ex = ms.filter(m => appliesOn(m, d)); if (!ex.length) return null; return ex.filter(m => state.d.logs.some(l => l.mission_id === m.id && l.log_date === d && l.status === 'approved')).length / ex.length; }]); });
  const beh = behaviourMissions(); if (beh.length) rows.push(['Behaviour', d => { const exp = beh.reduce((a, m) => a + (m.checkins || 1), 0); return state.d.logs.filter(l => l.log_date === d && l.status === 'approved' && beh.some(m => m.id === l.mission_id)).length / exp; }]);
  const fm = foodMissions(); if (fm.length) rows.push(['Food', d => Math.min(1, state.d.logs.filter(l => l.log_date === d && l.status === 'approved' && fm.some(m => m.id === l.mission_id)).length / Math.min(3, fm.length))]);
  const days = s.days.filter(d => d <= today());
  const lw = 74, cw = Math.max(12, Math.min(40, (RW - lw) / days.length)), ch = 26, W = lw + days.length * cw, H = rows.length * (ch + 6) + 22;
  const col = v => v == null ? C.soft : v === 0 ? '#EEF0F6' : v < 0.34 ? '#C9D0F7' : v < 0.67 ? '#8C9BEE' : v < 1 ? '#5A6DE2' : C.primary;
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily routines and missions">
    ${rows.map(([name, f], r) => `<text x="0" y="${r * (ch + 6) + ch / 2 + 5}" font-size="12" font-weight="800" fill="${C.ink}">${name}</text>
      ${days.map((d, i) => { const v = f(d); return `<rect x="${lw + i * cw + 1}" y="${r * (ch + 6)}" width="${cw - 3}" height="${ch}" rx="5" fill="${col(v)}"><title>${fmtD(d)}: ${v == null ? 'not scheduled' : Math.round(v * 100) + '%'}</title></rect>`; }).join('')}`).join('')}
    ${days.map((d, i) => (days.length <= 14 || i % 5 === 0 || i === days.length - 1) ? `<text x="${lw + i * cw + cw / 2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="${C.muted}">${days.length <= 8 ? fmtD(d, { weekday: 'short' }) : fmtD(d, { day: 'numeric' })}</text>` : '').join('')}
  </svg>${legend([['#EEF0F6', 'None'], ['#C9D0F7', 'Some'], ['#8C9BEE', 'Half'], ['#5A6DE2', 'Most'], [C.primary, 'All'], [C.soft, 'Not scheduled']])}`;
}

function sleepDots(s) {
  const ms = state.d.missions.filter(m => m.kind === 'routine' && /own bed/i.test(m.title));
  if (!ms.length) return '';
  const days = s.days.filter(d => d <= today());
  const lw = 112, cw = Math.max(12, Math.min(40, (RW - lw) / days.length)), W = lw + days.length * cw, H = ms.length * 34 + 18;
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nights in his own bed">
    ${ms.map((m, r) => `<text x="0" y="${r * 34 + 18}" font-size="12" font-weight="800" fill="${C.ink}">${esc(m.title.replace(/^Stayed in my own bed all night$/i, 'All night').replace(/^Fell asleep in my own bed$/i, 'Fell asleep'))}</text>
      ${days.map((d, i) => { const ok = state.d.logs.some(l => l.mission_id === m.id && l.log_date === d && l.status === 'approved'); const cx = lw + i * cw + cw / 2; return ok ? `<text x="${cx}" y="${r * 34 + 20}" text-anchor="middle" font-size="${Math.min(18, cw)}">🌙</text>` : `<circle cx="${cx}" cy="${r * 34 + 14}" r="${Math.min(6, cw / 3)}" fill="none" stroke="${C.line}" stroke-width="2"/>`; }).join('')}`).join('')}
    ${days.map((d, i) => (days.length <= 14 || i % 5 === 0 || i === days.length - 1) ? `<text x="${lw + i * cw + cw / 2}" y="${H - 2}" text-anchor="middle" font-size="10" fill="${C.muted}">${days.length <= 8 ? fmtD(d, { weekday: 'short' }) : fmtD(d, { day: 'numeric' })}</text>` : '').join('')}
  </svg>`;
}

function hbars(entries, color) {
  const max = Math.max(1, ...entries.map(e => e[1]));
  return `<div class="rp-hbars">${entries.map(([k, v]) => `<div class="rp-hbar"><span>${esc(k)}</span><div><i style="width:${Math.round(100 * v / max)}%;background:${color}"></i></div><b>${v}</b></div>`).join('')}</div>`;
}

function donut(p, color, label) {
  const r = 34, c = 2 * Math.PI * r, v = p == null ? 0 : p;
  return `<div class="rp-donut"><svg viewBox="0 0 90 90" width="90" height="90" aria-hidden="true"><circle cx="45" cy="45" r="${r}" fill="none" stroke="${C.line}" stroke-width="11"/>
    <circle cx="45" cy="45" r="${r}" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 45 45)"/>
    <text x="45" y="51" text-anchor="middle" font-size="18" font-weight="800" fill="${C.ink}">${p == null ? '–' : p + '%'}</text></svg><span>${label}</span></div>`;
}

// ───────── narrative ─────────
function narrative(P0) {
  const { cur: s, prev: p, q, cmpLabel, nowLabel } = P0;
  const k = kid(), he = 'he';
  const out = [];
  // "down from 6 the week before" / "down from 6 in the first week to 4 in the last week"
  const vs = (c, before, now, f = x => x) => `${c.dir} from ${f(before)} ${cmpLabel} to ${f(now)}${nowLabel ? ' ' + nowLabel : ''}`;
  const range = `${fmtD(s.from, { day: 'numeric', month: 'long' })} to ${fmtD(s.to, { day: 'numeric', month: 'long' })}`;
  const ppd = st => st.points / Math.max(1, st.days.length);
  let t0 = `From ${range}, ${k} earned <b>${s.points} points</b> on ${plural(s.activeDays, 'day')} out of ${s.days.length}.`;
  const cPts = p && change(ppd(q), ppd(p), { dec: 1 });
  if (cPts && cPts.dir !== 'same') t0 += ` Points per day went ${vs(cPts, ppd(p), ppd(q), r1)}, a simple sign of how much of his plan he is managing.`;
  out.push(t0);

  // courage
  if (s.attempts.length || s.camps.length) {
    let t = `<b>Courage.</b> ${k} practised ${plural(s.done + s.tried, 'brave step')} (${s.done} done, ${s.tried} tried)`;
    t += s.camps.length ? ` and climbed <b>${plural(s.camps.length, 'camp')}</b>: ${s.camps.slice(-4).map(e => esc(fillP(e.reason.replace(/^Climbed a camp: /, '')))).join('; ')}${s.camps.length > 4 ? `, plus ${s.camps.length - 4} more` : ''}.` : '.';
    if (s.fearBefore != null) {
      t += ` Fear before a step averaged ${r1(s.fearBefore)}/10`;
      const c = p && p.fearBefore != null && q.fearBefore != null && change(q.fearBefore, p.fearBefore, { better: 'down', dec: 1 });
      if (c && c.dir !== 'same') t += `, ${vs(c, p.fearBefore, q.fearBefore, r1)}`;
      t += '.';
      if (s.camps.length && c && c.dir === 'up') t += ` A rise is expected after moving up: each new camp starts harder, then fear comes down with practice.`;
    }
    if (s.fearDrop != null && s.fearDrop > 0.4) t += ` During the steps his fear dropped by about <b>${r1(s.fearDrop)} points</b> on average, which shows ${he} is learning that the worry fades when ${he} stays with it.`;
    out.push(t);
  } else out.push(`<b>Courage.</b> No brave steps were recorded in this period.`);

  // school
  if (s.schoolDays.length) {
    const sp = st => pct(st.full + st.part, st.schoolDays.length);
    let t = `<b>School.</b> Out of ${plural(s.schoolDays.length, 'school day')}, ${k} went for ${plural(s.full, 'full day')}${s.part ? ` and ${plural(s.part, 'part day')}` : ''}.`;
    if (p && p.schoolDays.length && q.schoolDays.length) { const c = change(sp(q), sp(p), { pctPoints: true, unit: '%' }); if (c && c.dir !== 'same') t += ` The share of school days he attended went ${vs(c, sp(p), sp(q), x => x + '%')}.`; }
    const unrec = s.schoolDays.length - s.att.filter(a => !isWeekend(a.day)).length; if (unrec > 0) t += ` (${plural(unrec, 'day')} not recorded.)`;
    out.push(t);
  }

  // routines
  if (s.routinePct != null) {
    const parts = PARTS.filter(([pt]) => s.routine[pt].exp).map(([pt, n]) => `${n.replace(' routine', '').toLowerCase()} ${s.routine[pt].pct}%`);
    let t = `<b>Daily routines.</b> ${k} completed <b>${s.routinePct}%</b> of his routine steps (${parts.join(', ')}).`;
    const c = p && p.routinePct != null && q.routinePct != null && change(q.routinePct, p.routinePct, { pctPoints: true, unit: '%' });
    if (c && c.dir !== 'same') t += ` That went ${vs(c, p.routinePct, q.routinePct, x => x + '%')}.`;
    const best = PARTS.filter(([pt]) => s.routine[pt].exp).sort((a, b) => s.routine[b[0]].pct - s.routine[a[0]].pct)[0];
    if (best && s.routine[best[0]].pct >= 60) t += ` The ${best[1].toLowerCase()} is the strongest.`;
    if (s.behPct != null && s.behExp) t += ` Behaviour check-ins ("${esc(behaviourMissions()[0]?.title || '')}") were met ${s.behPct}% of the time.`;
    out.push(t);
  }

  // sleep
  if (s.hasSleep) {
    let t = `<b>Sleep.</b>`;
    if (s.asleep != null) t += ` ${k} fell asleep in his own bed on <b>${plural(s.asleep, 'night')}</b>`;
    if (s.night != null) t += `${s.asleep != null ? ' and' : ''} stayed there all night on ${plural(s.night, 'night')}`;
    t += ` out of ${s.days.length}.`;
    const sp = paths().find(l => /sleep/i.test(l.title)); const st = sp && currentStep(sp);
    if (st) t += ` On the Sleep path he is at Camp ${sp.current_position}: ${esc(fillP(st.title))}.`;
    if (p && p.asleep != null && q.asleep != null) { const c = change(perWeek(q.asleep, q), perWeek(p.asleep, p), { dec: 1 }); if (c && c.dir !== 'same') t += ` Nights a week falling asleep in his own bed went ${vs(c, perWeek(p.asleep, p), perWeek(q.asleep, q), r1)}.`; }
    out.push(t);
  }

  // calm
  if (s.calm.length) {
    const tools = Object.entries(s.calm.reduce((o, c) => (o[c.tool] = (o[c.tool] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]);
    const b = { morning: 0, afternoon: 0, evening: 0 }; s.calm.forEach(c => { const h = new Date(c.created_at).getHours(); b[h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening']++; });
    const peak = Object.entries(b).sort((x, y) => y[1] - x[1])[0][0];
    out.push(`<b>Calming down.</b> ${k} used the Calm Corner ${plural(s.calm.length, 'time')}, most often in the ${peak}. His favourite tool is ${esc(tools[0][0])}${tools[1] ? `, then ${esc(tools[1][0])}` : ''}. Reaching for a calm tool on his own is a skill we are building, so more use is a good sign, not a worse week.`);
  }

  // focus + food
  if (s.focusDone.length || s.focusStopped) out.push(`<b>Homework focus.</b> ${k} finished ${plural(s.focusDone.length, 'focus sprint')} (${s.focusMin} minutes of focused work)${s.focusStopped ? ` and stopped ${plural(s.focusStopped, 'sprint')} early` : ''}. Sprints are ${state.family?.focus_minutes || 10} minutes with ${state.family?.break_minutes || 3}-minute movement breaks.`);
  if (s.meals.length || s.foodDone) out.push(`<b>Healthy eating.</b> ${plural(s.meals.length, 'plate')} logged, ${s.balancedMeals} of them balanced (fruit or vegetable + protein), and ${plural(s.foodDone, 'food mission')} completed. We praise habits, not weight.`);

  // close
  const wins = [];
  if (s.camps.length) wins.push('moving up on his paths');
  if (s.routinePct >= 70) wins.push('keeping his routines');
  if (s.asleep) wins.push('sleeping in his own bed');
  if (s.calm.length >= 3) wins.push('using calm tools');
  if (s.full + s.part) wins.push('going to school');
  out.push(wins.length ? `Overall, the clearest progress this period is in ${wins.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : `This was a quieter period; small steps still count, and the plan stays the same.`);
  return out;
}

function highlights(s) {
  const h = [];
  s.camps.forEach(e => h.push(['🏔️', `Climbed a camp: ${fillP(e.reason.replace(/^Climbed a camp: /, ''))}`, localDay(e.created_at)]));
  const firstFull = s.att.filter(a => a.status === 'went').sort((a, b) => a.day.localeCompare(b.day))[0]; if (firstFull) h.push(['🎒', 'Full day at school', firstFull.day]);
  const lowest = s.attempts.filter(a => a.fear_after != null).sort((a, b) => (b.fear_before - b.fear_after) - (a.fear_before - a.fear_after))[0];
  if (lowest && lowest.fear_before - lowest.fear_after >= 2) { const st = state.d.steps.find(x => x.id === lowest.step_id); h.push(['📉', `Fear went from ${lowest.fear_before} to ${lowest.fear_after} during "${fillP(st?.title || 'a brave step')}"`, lowest.attempt_date]); }
  s.ev.filter(e => e.category === 'streak').forEach(e => h.push(['🔥', fillP(e.reason), localDay(e.created_at)]));
  return h.sort((a, b) => a[2].localeCompare(b[2])).slice(-8);
}

// ───────── full document ─────────
export function buildReport() {
  const o = opts(); const P0 = periods(); const { cur: s, prev: p, cmpLabel } = P0;
  const note = (localStorage.getItem(NOTE_KEY) || '').trim();
  const went = s.full + s.part;
  const q = P0.q;
  const sp = st => pct(st.full + st.part, st.schoolDays.length);
  const tiles = [
    ['Points earned', s.points, p && change(perWeek(q.points, q), perWeek(p.points, p)), `${r1(s.points / s.days.length)} a day`],
    ['School days', `${went}/${s.schoolDays.length}`, p && p.schoolDays.length && q.schoolDays.length && change(sp(q), sp(p), { unit: '%', pctPoints: true }), `${s.full} full · ${s.part} part`],
    ['Brave steps', s.done + s.tried, p && change(perWeek(q.done + q.tried, q), perWeek(p.done + p.tried, p), { dec: 1 }), `${plural(s.camps.length, 'camp')} climbed`],
    ['Fear before', s.fearBefore == null ? '–' : r1(s.fearBefore), p && change(q.fearBefore, p.fearBefore, { better: 'down', dec: 1 }), 'average, out of 10'],
    ['Routines', s.routinePct == null ? '–' : s.routinePct + '%', p && change(q.routinePct, p.routinePct, { unit: '%', pctPoints: true }), `${s.rDone} of ${s.rExp} steps`],
    ['Calm Corner', s.calm.length, null, 'times used']
  ];
  if (s.hasSleep) tiles.splice(5, 0, ['Own bed', s.asleep ?? s.night ?? 0, p && change(perWeek(q.asleep ?? 0, q), perWeek(p.asleep ?? 0, p), { dec: 1 }), `nights of ${s.days.length}`]);
  if (s.focusDone.length) tiles.push(['Focus', s.focusMin + ' min', null, plural(s.focusDone.length, 'sprint')]);
  const ptsByDay = s.days.map(d => s.earned.filter(e => localDay(e.created_at) === d).reduce((a, e) => a + e.points, 0));
  const fearCharts = paths().map(l => { const c = fearChart(l, s.from); return c ? `<div class="rp-sub">${esc(l.title)}</div>${c}` : ''; }).join('');
  const calmTools = Object.entries(s.calm.reduce((a, c) => (a[c.tool] = (a[c.tool] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]);
  const calmTime = { Morning: 0, Afternoon: 0, Evening: 0 }; s.calm.forEach(c => { const h = new Date(c.created_at).getHours(); calmTime[h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening']++; });
  const hl = highlights(s);
  const story = narrative(P0);
  const detail = o.detail && s.attempts.length ? `<section class="rp-card rp-break"><h2>Brave steps in detail</h2><table class="rp-table"><thead><tr><th>Date</th><th>Path · camp</th><th>Fear before → during</th><th>Result</th></tr></thead><tbody>
    ${s.attempts.map(a => { const st = state.d.steps.find(x => x.id === a.step_id); const l = st && state.d.ladders.find(x => x.id === st.ladder_id); return `<tr><td>${fmtD(a.attempt_date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>${esc(l?.title || '')} · Camp ${st?.position ?? '?'}<br><span class="rp-muted">${esc(fillP(st?.title || ''))}</span></td><td>${a.fear_before ?? '–'} → ${a.fear_after ?? '–'}</td><td>${{ done: '✅ Done', tried: '🟡 Tried', not: 'Not today' }[a.result] || 'Waiting'}</td></tr>`; }).join('')}</tbody></table></section>` : '';
  const w = [...(state.d.weights || [])].sort((a, b) => a.day.localeCompare(b.day));
  const weights = o.weights && w.length ? `<section class="rp-card"><h2>Growth log (private)</h2><table class="rp-table"><thead><tr><th>Date</th><th>Weight</th><th>Height</th></tr></thead><tbody>${w.slice(-8).map(x => `<tr><td>${fmtD(x.day, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${x.kg} kg</td><td>${x.height_cm ? x.height_cm + ' cm' : '–'}</td></tr>`).join('')}</tbody></table><p class="rp-small">Recorded every few weeks. ${esc(kid())} does not see this and it is never linked to points.</p></section>` : '';
  const acc = state.d.accommodations || [];
  const nextSteps = paths().map(l => { const st = currentStep(l); const nx = stepsOf(l).find(x => x.position === l.current_position + 1); return st ? `<li><b>${esc(l.title)}:</b> keep practising "${esc(fillP(st.title))}"${nx ? `, then "${esc(fillP(nx.title))}"` : ' (last camp: keep it up)'}.</li>` : ''; }).join('');

  const body = `<div class="rp">
  <header class="rp-hero">
    <div class="rp-mtn" aria-hidden="true"><svg viewBox="0 0 640 120" preserveAspectRatio="none"><path d="M0 120 L120 46 L190 86 L300 14 L410 80 L480 50 L640 120Z" fill="rgba(255,255,255,.10)"/><path d="M0 120 L90 80 L170 104 L260 60 L350 98 L450 70 L560 100 L640 84 L640 120Z" fill="rgba(255,255,255,.10)"/></svg></div>
    <div class="rp-eyebrow">Brave Mountain · progress report</div>
    <h1>${esc(kid())}'s progress</h1>
    <div class="rp-period">${esc(P0.label)} · ${fmtD(s.from, { day: 'numeric', month: 'long' })} – ${fmtD(s.to, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    <div class="rp-period" style="opacity:.75">Prepared by ${esc(P())} on ${fmtD(today(), { weekday: 'long', day: 'numeric', month: 'long' })}${p ? ` · ▲▼ compare ${P0.nowLabel ? esc(P0.nowLabel.replace(/^in /, '')) + ' with ' + esc(cmpLabel.replace(/^in /, '')) : 'with ' + esc(cmpLabel)}` : ''}</div>
  </header>

  <section class="rp-tiles">${tiles.map(([l, v, c, sub]) => `<div class="rp-tile"><span class="rp-tl">${l}</span><span class="rp-tv">${v}</span><span class="rp-ts">${sub}</span>${badge(c)}</div>`).join('')}</section>

  <section class="rp-card rp-story"><h2>How it went</h2>${story.map(t => `<p>${t}</p>`).join('')}</section>

  ${hl.length ? `<section class="rp-card"><h2>Highlights</h2><ul class="rp-hl">${hl.map(([e, t, d]) => `<li><span class="rp-emoji">${e}</span><span>${esc(t)}</span><span class="rp-muted">${fmtD(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span></li>`).join('')}</ul></section>` : ''}

  <section class="rp-card"><h2>Brave paths</h2><p class="rp-small">Each path is a ladder of small brave steps (camps). Filled = climbed, ring = current camp.</p>${pathBars(s)}</section>

  ${fearCharts ? `<section class="rp-card rp-break"><h2>Fear during brave steps</h2><p class="rp-small">Each dot is one try. Fear usually rises at a new camp and falls with practice; ${esc(P())} suggests moving up when it stays in the calm zone for 2–3 tries.</p>${fearCharts}</section>` : ''}

  <section class="rp-card"><h2>Points earned each day</h2><p class="rp-small">Points come from brave steps, school, routines, behaviour, calm tools, focus and food. ${s.spent ? `${s.spent} points were spent on prizes.` : ''}</p>${barChart(s.days, ptsByDay, { label: 'Points per day' })}</section>

  ${s.schoolDays.length ? `<section class="rp-card"><h2>School attendance</h2>${schoolStrip(s)}</section>` : ''}

  <section class="rp-card rp-break"><h2>Routines and daily missions</h2>
    <div class="rp-donuts">${PARTS.filter(([pt]) => s.routine[pt].exp).map(([pt, n]) => donut(s.routine[pt].pct, pt === 'bedtime' ? '#1B2559' : pt === 'evening' ? C.rose : C.sun, n.replace(' routine', ''))).join('')}${s.behPct != null && s.behExp ? donut(s.behPct, C.teal, 'Behaviour') : ''}</div>
    ${heatmap(s)}</section>

  ${s.hasSleep ? `<section class="rp-card"><h2>Sleeping in his own bed</h2>${sleepDots(s)}</section>` : ''}

  ${s.calm.length ? `<section class="rp-card"><h2>Calm Corner</h2><div class="rp-two"><div><div class="rp-sub">Tools used</div>${hbars(calmTools, C.teal)}</div><div><div class="rp-sub">Time of day</div>${hbars(Object.entries(calmTime), C.primary)}</div></div></section>` : ''}

  ${s.focusDone.length || s.focusStopped ? `<section class="rp-card"><h2>Homework focus</h2>${barChart(s.days, s.days.map(d => s.focusDone.filter(x => localDay(x.started_at) === d).reduce((a, x) => a + x.minutes, 0)), { color: C.primary, unit: ' min', label: 'Focus minutes per day' })}</section>` : ''}

  ${s.meals.length ? `<section class="rp-card"><h2>Healthy plates</h2>${barChart(s.days, s.days.map(d => s.meals.filter(m => m.day === d && balanced(m.groups)).length), { color: C.teal, label: 'Balanced plates per day', avgLine: false })}<p class="rp-small">${s.balancedMeals} of ${s.meals.length} plates were balanced.</p></section>` : ''}

  <section class="rp-card"><h2>Next steps</h2><ul class="rp-list">${nextSteps}${acc.filter(a => a.status !== 'done').length ? `<li><b>Support being reduced:</b> ${acc.filter(a => a.status !== 'done').map(a => esc(fillP(a.text))).join('; ')}.</li>` : ''}</ul>
    ${note ? `<div class="rp-note"><div class="rp-sub">A note from ${esc(P())}</div><p>${esc(note).replace(/\n/g, '<br>')}</p></div>` : ''}</section>

  ${detail}
  ${weights}
  <footer class="rp-foot">Made with Brave Mountain, ${esc(kid())}'s reward plan. Points are earned for effort; climbed camps never go down. Questions or ideas for the plan are welcome.</footer>
</div>`;
  return { body, html: wrap(body), text: textVersion(P0, story, hl) };
}

function textVersion(P0, story, hl) {
  const s = P0.cur;
  const strip = h => h.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const lines = [`${kid()}'s Brave Mountain report · ${P0.label} (${fmtD(s.from)} – ${fmtD(s.to)})`, '', ...story.map(strip).flatMap(t => [t, ''])];
  if (hl.length) lines.push('Highlights:', ...hl.map(([e, t, d]) => `${e} ${fmtD(d)}: ${t}`), '');
  lines.push('Paths now:', ...paths().map(l => { const st = currentStep(l); return `- ${l.title}: ${st ? `Camp ${l.current_position} of ${stepsOf(l).length} – ${fillP(st.title)}` : 'top reached'}`; }));
  const note = (localStorage.getItem(NOTE_KEY) || '').trim(); if (note) lines.push('', `Note from ${P()}: ${note}`);
  return lines.join('\n');
}

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#F3F5FB;color:${C.ink};font-family:Nunito,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
.rp{max-width:760px;margin:0 auto;padding:14px 12px 28px;display:flex;flex-direction:column;gap:14px}
.rp h1,.rp h2{font-family:"Baloo 2",Nunito,system-ui,sans-serif;font-weight:800;margin:0;line-height:1.15}
.rp h1{font-size:32px}.rp h2{font-size:20px;margin-bottom:6px}
.rp-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#2A3BB8,#3A4FD8 55%,#5B6FE6);color:#fff;border-radius:22px;padding:22px 20px 26px}
.rp-mtn{position:absolute;left:0;right:0;bottom:0;height:70%}.rp-mtn svg{width:100%;height:100%}
.rp-hero>*{position:relative}.rp-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:4px}
.rp-period{font-weight:700;font-size:14px;margin-top:4px}
.rp-tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:560px){.rp-tiles{grid-template-columns:repeat(4,1fr)}}
.rp-tile{background:#fff;border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:1px;box-shadow:0 1px 6px rgba(27,37,89,.05)}
.rp-tl{font-size:12px;font-weight:800;color:${C.muted}}.rp-tv{font-family:"Baloo 2",Nunito,sans-serif;font-weight:800;font-size:28px;line-height:1.1}.rp-ts{font-size:12px;font-weight:700;color:${C.muted}}
.rp-badge{align-self:flex-start;margin-top:6px;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:${C.soft};color:${C.muted}}
.rp-badge.good{background:${C.tealSoft};color:${C.teal}}.rp-badge.warn{background:${C.roseSoft};color:${C.rose}}
.rp-card{background:#fff;border-radius:20px;padding:16px 16px 18px;box-shadow:0 1px 6px rgba(27,37,89,.05)}
.rp-story p{margin:0 0 10px;font-size:15.5px;line-height:1.6}.rp-story p:last-child{margin:0}.rp-story b{color:${C.ink}}
.rp-small{font-size:13px;color:${C.muted};margin:0 0 10px;line-height:1.45}.rp-muted{color:${C.muted};font-size:13px}
.rp-sub{font-size:13px;font-weight:800;color:${C.primary};margin:10px 0 4px;text-transform:uppercase;letter-spacing:.04em}
.rp-svg{width:100%;max-width:620px;height:auto;display:block;margin:0 auto}
.rp-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;font-weight:700;color:${C.muted};margin-top:6px}.rp-legend span{display:flex;align-items:center;gap:6px}.rp-legend i{width:12px;height:12px;border-radius:4px;display:inline-block}
.rp-path{padding:10px 0;border-top:1px solid ${C.line}}.rp-path:first-of-type{border-top:none}
.rp-row{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}
.rp-camps{display:flex;gap:6px;margin:8px 0 6px}.rp-camps span{flex:1;height:14px;border-radius:7px;background:${C.line}}.rp-camps span.done{background:${C.primary}}.rp-camps span.now{background:#fff;box-shadow:inset 0 0 0 3px ${C.sun}}
.rp-hl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.rp-hl li{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start;font-weight:700;font-size:14.5px}.rp-emoji{font-size:20px;line-height:1}
.rp-donuts{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:space-around;margin-bottom:12px}.rp-donut{display:flex;flex-direction:column;align-items:center;font-size:13px;font-weight:800}
.rp-two{display:grid;grid-template-columns:1fr;gap:6px}@media(min-width:560px){.rp-two{grid-template-columns:1fr 1fr;gap:18px}}
.rp-hbars{display:flex;flex-direction:column;gap:7px}.rp-hbar{display:grid;grid-template-columns:118px 1fr 28px;gap:8px;align-items:center;font-size:13px;font-weight:700}.rp-hbar div{background:${C.soft};height:12px;border-radius:6px;overflow:hidden}.rp-hbar i{display:block;height:100%;border-radius:6px}.rp-hbar b{text-align:right}
.rp-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:14.5px;line-height:1.5}
.rp-note{margin-top:12px;background:#FFF6E3;border-radius:14px;padding:10px 14px}.rp-note p{margin:4px 0 0;font-size:14.5px;line-height:1.55}
.rp-table{width:100%;border-collapse:collapse;font-size:13px}.rp-table th{text-align:left;color:${C.muted};font-size:12px;padding:6px 4px;border-bottom:2px solid ${C.line}}.rp-table td{padding:8px 4px;border-bottom:1px solid ${C.line};vertical-align:top}
.rp-foot{text-align:center;font-size:12px;color:${C.muted};padding:4px 12px}
.rp *{overflow-wrap:anywhere}
@media print{body{background:#fff}.rp{max-width:none;padding:0}.rp-card,.rp-tile{box-shadow:none;border:1px solid ${C.line}}.rp-card,.rp-tile,.rp-hl li,.rp-path{break-inside:avoid}.rp-break{break-before:auto}.rp-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:12mm}}
`;
const wrap = body => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(kid())}'s progress report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;600;700;800&display=swap">
<style>${CSS}</style></head><body>${body}</body></html>`;

// ───────── in-app screen ─────────
export function reportView(head) {
  const o = opts();
  const r = buildReport();
  state.ui.reportCache = r;
  return `${head('Progress report', 'Ready to share with his psychologist, ABA team or family')}
    <button class="btn ghost sm" style="align-self:flex-start" data-act="tab" data-tab="progress">${ic.back(16)} Back to Progress</button>
    <section class="card" style="gap:12px">
      <div class="seg">${[['week', '7 days'], ['month', '30 days'], ['all', 'Since start']].map(([k, l]) => `<button data-act="reportRange" data-v="${k}" class="${o.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="row small bold" style="gap:10px"><input type="checkbox" data-change="reportOpt" data-k="detail" ${o.detail ? 'checked' : ''} style="width:22px;height:22px"> Include the table of every brave step</label>
      <label class="row small bold" style="gap:10px"><input type="checkbox" data-change="reportOpt" data-k="weights" ${o.weights ? 'checked' : ''} style="width:22px;height:22px"> Include the private weight log</label>
      <label class="col tight small bold">Your note (optional, shown at the end)
        <textarea class="input" id="report-note" rows="3" data-change="reportNote" placeholder="e.g. This week he asked to try the car step himself.">${esc(localStorage.getItem(NOTE_KEY) || '')}</textarea></label>
      <span class="tiny muted">Worry box texts and the wish list are never included.</span>
    </section>
    <div class="col" style="gap:10px">
      <button class="btn primary block" data-act="reportShare">${ic.share(18, '#fff')} Share report</button>
      <div class="row" style="gap:10px"><button class="btn ghost grow" data-act="reportPrint">Save as PDF</button><button class="btn ghost grow" data-act="reportCopy">Copy as text</button></div>
    </div>
    <iframe id="report-frame" title="Report preview" style="width:100%;border:none;border-radius:18px;background:#F3F5FB;min-height:600px" srcdoc="${esc(r.html)}" onload="try{this.style.height=(this.contentDocument.documentElement.scrollHeight+8)+'px'}catch(e){}"></iframe>`;
}

const fileName = () => `${kid().replace(/[^\w-]+/g, '-')}-progress-${today()}.html`;
export const reportActions = {
  openReport: () => { state.tab = 'report'; render(); window.scrollTo(0, 0); },
  reportRange: el => { opts().range = el.dataset.v; render(); },
  reportOpt: el => { opts()[el.dataset.k] = el.checked; render(); },
  reportNote: el => { localStorage.setItem(NOTE_KEY, el.value); render(); },
  async reportShare() {
    const r = state.ui.reportCache || buildReport();
    const file = new File([r.html], fileName(), { type: 'text/html' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `${kid()}'s progress report`, text: `${kid()}'s Brave Mountain progress report. Open the attached file to see it.` }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
    toast('Report saved as a file. Attach it to a message or email.');
  },
  reportPrint() {
    const f = document.getElementById('report-frame');
    try { f.contentWindow.focus(); f.contentWindow.print(); return; } catch {}
    const r = state.ui.reportCache || buildReport();
    const w = window.open(URL.createObjectURL(new Blob([r.html], { type: 'text/html' })), '_blank');
    if (!w) toast('Use Share report instead');
  },
  async reportCopy() {
    const r = state.ui.reportCache || buildReport();
    try { await navigator.clipboard.writeText(r.text); toast('Report text copied. Paste it in a message or email.'); } catch { toast('Could not copy'); }
  }
};
