// Shared state, Supabase client, data loading and small helpers.
const cfg = window.BRAVE_CONFIG || {};
export const sb = window.supabase.createClient(cfg.url, cfg.key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'brave-auth' }
});
export const KID_DOMAIN = 'kids.brave-family.app';
export const APP_VERSION = '2.3 · 19 Nov';

export const state = {
  session: null,
  profile: null,
  family: null,
  d: null,           // loaded family data
  tab: null,
  ui: {},            // per-screen UI state (selected tabs, etc.)
  modal: null,       // { kind, ...props }
  toast: null
};

let renderFn = () => {};
export function setRenderer(fn) { renderFn = fn; }
export function render() { renderFn(); }

// ───────── helpers ─────────
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function P() { return state.family?.parent_label || 'Mom'; }
export function fillP(t) { return String(t ?? '').replaceAll('{P}', P()); }
export function kid() { return state.family?.child_name || 'Taym'; }
export function ymd(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function today() { return ymd(); }
export function addDays(dateStr, n) { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
export function mondayOf(dateStr = today()) {
  const d = new Date(dateStr + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return ymd(d);
}
export function localDay(ts) { return ymd(new Date(ts)); }
export function dayName(dateStr, style = 'short') { return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: style }); }
export function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
export function sum(arr, f = x => x) { return arr.reduce((a, x) => a + f(x), 0); }
export function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

export function toast(msg) {
  state.toast = msg; render();
  clearTimeout(toast._t); toast._t = setTimeout(() => { state.toast = null; render(); }, 2800);
}
export function openModal(kind, props = {}) { state.modal = { kind, ...props }; render(); }
export function closeModal() { state.modal = null; render(); }

export async function run(promise, okMsg) {
  const res = await promise;
  if (res && res.error) { toast(friendly(res.error.message)); throw res.error; }
  if (okMsg) toast(okMsg);
  return res;
}
export function friendly(m = '') {
  if (/Not enough points/i.test(m)) return 'Not enough points yet. Keep going!';
  if (/Invalid login/i.test(m)) return 'Wrong username/email or password.';
  if (/already registered|already used/i.test(m)) return 'That login already exists.';
  if (/Password should be/i.test(m)) return 'Password needs at least 6 characters.';
  if (/Email not confirmed/i.test(m)) return 'Email not confirmed yet. Check your inbox, or ask to switch off email confirmation in Supabase.';
  return m || 'Something went wrong. Try again.';
}

// ───────── data ─────────
export async function loadProfile() {
  const { data: { session } } = await sb.auth.getSession();
  state.session = session;
  if (!session) { state.profile = null; state.family = null; state.d = null; return; }
  const { data: prof } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  state.profile = prof || null;
  if (prof) {
    const { data: fam } = await sb.from('families').select('*').eq('id', prof.family_id).single();
    state.family = fam;
  }
}

export async function loadAll() {
  if (!state.profile) return;
  const parent = state.profile.role === 'parent';
  const since = addDays(today(), -62);
  const q = (t, f = x => x) => f(sb.from(t).select('*'));
  const jobs = {
    family: sb.from('families').select('*').eq('id', state.profile.family_id).single(),
    profiles: q('profiles'),
    ladders: q('ladders', x => x.order('sort')),
    steps: q('ladder_steps', x => x.order('position')),
    missions: q('missions', x => x.order('sort')),
    logs: q('mission_logs', x => x.gte('log_date', since)),
    attempts: q('brave_attempts', x => x.gte('attempt_date', since).order('created_at')),
    attendance: q('attendance', x => x.gte('day', since)),
    events: q('point_events', x => x.gte('created_at', since + 'T00:00:00').order('created_at', { ascending: false })),
    balance: q('points_balance'),
    calm: q('calm_uses', x => x.gte('created_at', since + 'T00:00:00')),
    rewards: q('rewards', x => x.order('sort')),
    redemptions: q('redemptions', x => x.order('created_at', { ascending: false }).limit(50)),
    gifts: q('gifts', x => x.order('created_at')),
    secrets: q('gift_secrets'),
    wishes: q('wishes', x => x.order('created_at')),
    hearts: q('hearts', x => x.gte('created_at', addDays(today(), -1) + 'T00:00:00').order('created_at')),
    meals: q('meals', x => x.gte('day', since))
  };
  if (parent) {
    jobs.accommodations = q('accommodations', x => x.order('sort'));
    jobs.worries = q('worries', x => x.order('created_at', { ascending: false }).limit(50));
    jobs.weights = q('weights', x => x.order('day'));
  }
  const keys = Object.keys(jobs);
  const results = await Promise.all(keys.map(k => jobs[k]));
  const d = {};
  keys.forEach((k, i) => { d[k] = results[i].data || (k === 'family' ? null : []); });
  state.family = d.family || state.family;
  d.balance = d.balance?.[0]?.balance ?? 0;
  d.accommodations = d.accommodations || [];
  d.worries = d.worries || [];
  d.weights = d.weights || [];
  d.meals = d.meals || [];
  state.d = d;
}

let reloadTimer = null;
export function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => { await loadAll(); render(); }, 400);
}
let channel = null;
export function subscribe() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('family-' + state.profile.family_id);
  ['point_events', 'brave_attempts', 'attendance', 'mission_logs', 'hearts', 'gifts', 'redemptions', 'calm_uses', 'wishes', 'ladders', 'meals']
    .forEach(t => channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, scheduleReload));
  channel.subscribe();
}
export function unsubscribe() { if (channel) { sb.removeChannel(channel); channel = null; } }

// ───────── derived data ─────────
export function ladder(key) { return state.d.ladders.find(l => l.id === key) || state.d.ladders.find(l => l.kind === key && !l.archived); }
export function paths() { return state.d.ladders.filter(l => !l.archived).sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title)); }
export function summitFor(l) {
  if (!l) return null;
  return state.d.gifts.filter(g => g.kind === 'summit' && g.status !== 'given' && (g.ladder_id === l.id || (!g.ladder_id && l.kind === 'school'))).slice(-1)[0] || null;
}
export function stepsOf(l) { return l ? state.d.steps.filter(s => s.ladder_id === l.id).sort((a, b) => a.position - b.position) : []; }
export function currentStep(l) { return stepsOf(l).find(s => s.position === l.current_position) || null; }
export function attemptsOf(step) { return step ? state.d.attempts.filter(a => a.step_id === step.id) : []; }
export function todaysAttempt(step) {
  const t = today();
  const list = attemptsOf(step).filter(a => a.attempt_date === t);
  return list[list.length - 1] || null;
}
export function readiness(step) {
  const rated = attemptsOf(step).filter(a => a.fear_before != null && a.result !== 'not');
  const last = rated.slice(-3).map(a => a.fear_before);
  const lowDays = last.filter(f => f <= 3).length;
  return { last, ready: last.length >= 2 && lowDays >= 2 && last[last.length - 1] <= 3, doneCount: attemptsOf(step).filter(a => a.result === 'done').length };
}
export function mystery() { return state.d.gifts.filter(g => g.kind === 'mystery' && g.status !== 'given').slice(-1)[0] || null; }
export function summit() { const s = state.d.gifts.filter(g => g.kind === 'summit'); return s.filter(g => g.status !== 'given').slice(-1)[0] || s.slice(-1)[0] || null; }
export function secretFor(g) { return g ? state.d.secrets.find(s => s.gift_id === g.id) : null; }
export function eventsOn(dateStr) { return state.d.events.filter(e => localDay(e.created_at) === dateStr); }
export function earnedOn(dateStr) { return sum(eventsOn(dateStr).filter(e => e.points > 0), e => e.points); }
export function attendanceOn(dateStr) { return state.d.attendance.find(a => a.day === dateStr) || null; }
export function logsFor(mission, dateStr = today()) { return state.d.logs.filter(l => l.mission_id === mission.id && l.log_date === dateStr); }
export function routineMissions(part) { return state.d.missions.filter(m => m.kind === 'routine' && m.active && (!part || (m.part || 'morning') === part)); }
export const PARTS = [['morning', 'Morning routine'], ['evening', 'Evening routine'], ['bedtime', 'Bedtime routine']];
export function currentPart() { const h = new Date().getHours(); return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 19 ? 'evening' : 'bedtime'; }
export function behaviourMissions() { return state.d.missions.filter(m => m.kind === 'behaviour' && m.active); }
export function childProfile() { return state.d.profiles.find(p => p.role === 'child') || null; }
export function heartsToday() { const t = today(); return state.d.hearts.filter(h => localDay(h.created_at) === t); }
export function schoolStreak() {
  // consecutive weekdays (latest first) marked 'went'
  const days = state.d.attendance.filter(a => new Date(a.day + 'T12:00:00').getDay() % 6 !== 0).sort((a, b) => b.day.localeCompare(a.day));
  let n = 0; for (const a of days) { if (a.status === 'went') n++; else break; } return n;
}
