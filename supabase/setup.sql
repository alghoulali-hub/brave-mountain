-- Brave Mountain: paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Run it once, on a new empty project. Then add the push_config row and deploy the notify function.

-- Taym's Brave App: schema, security and point logic
-- Every row belongs to a family. Parents manage everything in their family;
-- Taym (role 'child') can read his family's data and do only the things the
-- app lets him do (rate fear, use calm tools, check routine steps, claim prizes).


-- ───────────────────────── Tables ─────────────────────────

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family',
  child_name text not null default 'Taym',
  parent_label text not null default 'Mom',
  checkins_per_day int not null default 3 check (checkins_per_day between 0 and 6),
  brave_message text,
  brave_audio_url text,
  supportive_phrase text not null default 'I know this feels really hard, and I know you can handle it.',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  display_name text not null,
  username text,
  created_at timestamptz not null default now()
);
create index on public.profiles(family_id);

create table public.ladders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('school','home')),
  title text not null,
  current_position int not null default 1,
  sort int not null default 0,
  unique (family_id, kind)
);

create table public.ladder_steps (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  ladder_id uuid not null references public.ladders(id) on delete cascade,
  position int not null,
  title text not null,
  unique (ladder_id, position) deferrable initially deferred
);

create table public.brave_attempts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  step_id uuid not null references public.ladder_steps(id) on delete cascade,
  attempt_date date not null default current_date,
  fear_before int check (fear_before between 0 and 10),
  fear_after int check (fear_after between 0 and 10),
  result text check (result in ('done','tried','not')),
  created_at timestamptz not null default now()
);
create index on public.brave_attempts(family_id, created_at desc);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('routine','behaviour')),
  title text not null,
  points int not null default 3 check (points between 0 and 100),
  checkins int not null default 1 check (checkins between 1 and 5),
  active boolean not null default true,
  sort int not null default 0
);

create table public.mission_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  log_date date not null default current_date,
  slot int not null default 1,
  status text not null check (status in ('pending','approved','missed')),
  created_at timestamptz not null default now(),
  unique (mission_id, log_date, slot)
);

create table public.attendance (
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  status text not null check (status in ('went','partly','no')),
  primary key (family_id, day)
);

create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  points int not null,
  reason text not null,
  category text not null default 'bonus',
  ref text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index on public.point_events(family_id, created_at desc);
create unique index point_events_ref_uniq on public.point_events(family_id, ref) where ref is not null;

create table public.calm_uses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  tool text not null,
  feeling text,
  created_at timestamptz not null default now()
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  price int not null check (price > 0),
  tier text not null check (tier in ('daily','weekly')),
  active boolean not null default true,
  sort int not null default 0
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  reward_id uuid references public.rewards(id) on delete set null,
  name text not null,
  price int not null,
  status text not null default 'claimed' check (status in ('claimed','given')),
  created_at timestamptz not null default now()
);

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('mystery','summit')),
  title text,                       -- summit prize name (Taym chooses it); null for mystery
  photo_url text,
  pieces_total int not null default 12 check (pieces_total between 4 and 24),
  pieces_unlocked int not null default 0,
  status text not null default 'active' check (status in ('active','won','given')),
  created_at timestamptz not null default now()
);

-- The mystery gift's name stays hidden from Taym until every piece is unlocked.
create table public.gift_secrets (
  gift_id uuid primary key references public.gifts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  secret_title text not null
);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  text text not null check (length(text) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.worries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  text text not null check (length(text) between 1 and 500),
  talked_about boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.hearts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_role text not null check (from_role in ('parent','child')),
  created_at timestamptz not null default now()
);

create table public.accommodations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  text text not null,
  status text not null default 'next' check (status in ('now','next','done')),
  sort int not null default 0
);

-- ───────────────────────── Helpers ─────────────────────────

create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'parent' from public.profiles where id = auth.uid()), false)
$$;

-- Award (or replace) points tied to one thing, so changing an answer never double-counts.
create or replace function public.award(p_family uuid, p_ref text, p_points int, p_reason text, p_category text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.point_events where family_id = p_family and ref = p_ref;
  if p_points <> 0 then
    insert into public.point_events(family_id, points, reason, category, ref)
    values (p_family, p_points, p_reason, p_category, p_ref);
  end if;
end $$;
revoke execute on function public.award(uuid, text, int, text, text) from public, anon, authenticated;

-- ───────────────────────── Point rules (triggers) ─────────────────────────

-- Brave step: done +30, tried +10; fear lower than the last try on this step +5.
create or replace function public.trg_brave_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_prev int;
  v_pts int;
begin
  select title into v_title from public.ladder_steps where id = new.step_id;
  v_pts := case new.result when 'done' then 30 when 'tried' then 10 else 0 end;
  perform public.award(new.family_id, 'brave:' || new.id, v_pts,
    case new.result when 'done' then 'Brave step: ' || v_title
                    when 'tried' then 'Tried a brave step: ' || v_title
                    else 'Brave step' end, 'brave');

  select fear_before into v_prev from public.brave_attempts
   where step_id = new.step_id and id <> new.id and fear_before is not null
     and created_at < new.created_at
   order by created_at desc limit 1;
  if new.result in ('done','tried') and v_prev is not null and new.fear_before is not null and new.fear_before < v_prev then
    perform public.award(new.family_id, 'better:' || new.id, 5,
      'Better than last time: fear ' || v_prev || ' → ' || new.fear_before, 'improve');
  else
    perform public.award(new.family_id, 'better:' || new.id, 0, '', 'improve');
  end if;
  return new;
end $$;
create trigger brave_points after insert or update of result, fear_before on public.brave_attempts
  for each row when (new.result is not null) execute function public.trg_brave_points();

-- School: went +20, part of the day +10; 3 school days in a row +15; Mon–Fri all went +50.
create or replace function public.trg_attendance_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_streak int;
  v_monday date;
  v_week int;
begin
  perform public.award(new.family_id, 'school:' || new.day,
    case new.status when 'went' then 20 when 'partly' then 10 else 0 end,
    case new.status when 'went' then 'Made it to school' else 'Went to school for part of the day' end, 'school');

  -- streak of the last 3 recorded school days (weekdays) ending today
  select count(*) into v_streak from (
    select status from public.attendance
     where family_id = new.family_id and day <= new.day and extract(isodow from day) < 6
     order by day desc limit 3) s where s.status = 'went';
  perform public.award(new.family_id, 'streak3:' || new.day, case when v_streak = 3 and new.status = 'went' then 15 else 0 end,
    'School streak: 3 days in a row', 'streak');

  v_monday := new.day - (extract(isodow from new.day)::int - 1);
  select count(*) into v_week from public.attendance
   where family_id = new.family_id and day between v_monday and v_monday + 4 and status = 'went';
  perform public.award(new.family_id, 'week:' || v_monday, case when v_week = 5 then 50 else 0 end,
    'Full school week!', 'streak');
  return new;
end $$;
create trigger attendance_points after insert or update on public.attendance
  for each row execute function public.trg_attendance_points();

-- Missions: approved check = mission points.
create or replace function public.trg_mission_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from public.missions where id = new.mission_id;
  perform public.award(new.family_id, 'mission:' || new.id,
    case when new.status = 'approved' then m.points else 0 end, m.title, m.kind);
  return new;
end $$;
create trigger mission_points after insert or update of status on public.mission_logs
  for each row execute function public.trg_mission_points();

create or replace function public.trg_mission_logs_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.point_events where family_id = old.family_id and ref = 'mission:' || old.id;
  return old;
end $$;
create trigger mission_logs_cleanup after delete on public.mission_logs
  for each row execute function public.trg_mission_logs_cleanup();

-- Calm Corner: +5 per tool, up to 3 times a day.
create or replace function public.trg_calm_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_today int;
begin
  select count(*) into v_today from public.point_events
   where family_id = new.family_id and category = 'calm'
     and (created_at at time zone 'Asia/Beirut')::date = (now() at time zone 'Asia/Beirut')::date;
  if v_today < 3 then
    insert into public.point_events(family_id, points, reason, category, ref)
    values (new.family_id, 5, 'Used a calm tool: ' || new.tool, 'calm', 'calm:' || new.id);
  end if;
  return new;
end $$;
create trigger calm_points after insert on public.calm_uses
  for each row execute function public.trg_calm_points();

-- ───────────────────────── Actions (RPC) ─────────────────────────

create or replace view public.points_balance with (security_invoker = true) as
  select family_id, coalesce(sum(points), 0)::int as balance
  from public.point_events group by family_id;

-- Taym claims a prize: checks he has enough points, then spends them.
create or replace function public.redeem_reward(p_reward uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_balance int;
  v_id uuid;
begin
  select * into r from public.rewards where id = p_reward and family_id = public.my_family() and active;
  if not found then raise exception 'Prize not found'; end if;
  select coalesce(sum(points),0) into v_balance from public.point_events where family_id = r.family_id;
  if v_balance < r.price then raise exception 'Not enough points yet'; end if;
  insert into public.redemptions(family_id, reward_id, name, price) values (r.family_id, r.id, r.name, r.price)
    returning id into v_id;
  insert into public.point_events(family_id, points, reason, category, ref)
    values (r.family_id, -r.price, 'Prize: ' || r.name, 'spend', 'redeem:' || v_id);
  return json_build_object('id', v_id, 'balance', v_balance - r.price);
end $$;

-- Parent moves Taym up a camp: +100 points and 3 puzzle pieces on the active mystery gift.
create or replace function public.climb_camp(p_ladder uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_max int;
  v_step text;
  g record;
begin
  if not public.is_parent() then raise exception 'Only a parent can do this'; end if;
  select * into l from public.ladders where id = p_ladder and family_id = public.my_family();
  if not found then raise exception 'Ladder not found'; end if;
  select max(position) into v_max from public.ladder_steps where ladder_id = l.id;
  if l.current_position > v_max then raise exception 'Already at the top'; end if;
  select title into v_step from public.ladder_steps where ladder_id = l.id and position = l.current_position;

  update public.ladders set current_position = current_position + 1 where id = l.id;
  insert into public.point_events(family_id, points, reason, category, ref)
    values (l.family_id, 100, 'Climbed a camp: ' || v_step, 'camp', 'camp:' || l.id || ':' || l.current_position);

  select * into g from public.gifts where family_id = l.family_id and kind = 'mystery' and status = 'active'
   order by created_at limit 1;
  if found then
    update public.gifts set pieces_unlocked = least(pieces_total, pieces_unlocked + 3),
      status = case when pieces_unlocked + 3 >= pieces_total then 'won' else status end
     where id = g.id;
  end if;

  if l.current_position + 1 > v_max then
    update public.gifts set status = 'won' where family_id = l.family_id and kind = 'summit' and status = 'active'
      and l.kind = 'school';
  end if;
  return json_build_object('position', l.current_position + 1, 'top', l.current_position + 1 > v_max);
end $$;

-- Parent unlocks puzzle pieces by hand (e.g. a big brave day at home).
create or replace function public.add_pieces(p_gift uuid, p_count int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent() then raise exception 'Only a parent can do this'; end if;
  update public.gifts set pieces_unlocked = greatest(0, least(pieces_total, pieces_unlocked + p_count)),
    status = case when pieces_unlocked + p_count >= pieces_total then 'won' else 'active' end
   where id = p_gift and family_id = public.my_family() and kind = 'mystery';
end $$;

-- First sign-in of a parent: create the family with sensible starting content.
create or replace function public.create_family(p_parent_name text, p_parent_label text, p_child_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  f uuid;
  sch uuid;
  hom uuid;
  g uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    return (select family_id from public.profiles where id = auth.uid());
  end if;

  insert into public.families(name, child_name, parent_label)
    values (coalesce(nullif(p_child_name,''),'Taym') || '''s family', coalesce(nullif(p_child_name,''),'Taym'),
            coalesce(nullif(p_parent_label,''),'Mom'))
    returning id into f;
  insert into public.profiles(id, family_id, role, display_name) values (auth.uid(), f, 'parent', coalesce(nullif(p_parent_name,''),'Parent'));

  insert into public.ladders(family_id, kind, title, sort) values (f, 'school', 'School path', 0) returning id into sch;
  insert into public.ladders(family_id, kind, title, sort) values (f, 'home', 'Home path', 1) returning id into hom;
  insert into public.ladder_steps(family_id, ladder_id, position, title) values
    (f, sch, 1, '{P} stays at the gate all day'),
    (f, sch, 2, '{P} waits in the car'),
    (f, sch, 3, '{P} waits at a café, back at break'),
    (f, sch, 4, '{P} leaves after 1st class'),
    (f, sch, 5, 'Drop-off at the gate, pick-up at the end'),
    (f, hom, 1, '{P} in another room for 10 minutes'),
    (f, hom, 2, '{P} outside the front door for 5 minutes'),
    (f, hom, 3, '{P} goes to a neighbor or the shop for 10 minutes'),
    (f, hom, 4, '{P} goes out 30 minutes, another adult at home'),
    (f, hom, 5, '{P} goes out for an hour or more');

  insert into public.missions(family_id, kind, title, points, checkins, sort) values
    (f, 'routine', 'Wake up and get up', 3, 1, 1),
    (f, 'routine', 'Get dressed', 3, 1, 2),
    (f, 'routine', 'Eat breakfast', 3, 1, 3),
    (f, 'routine', 'Brush teeth', 3, 1, 4),
    (f, 'routine', 'School bag ready', 3, 1, 5),
    (f, 'behaviour', 'Kind words and hands', 5, 3, 10);

  insert into public.rewards(family_id, name, price, tier, sort) values
    (f, '15 minutes extra game time', 40, 'daily', 1),
    (f, 'Pick tonight''s dinner', 30, 'daily', 2),
    (f, 'Stay up 15 minutes later', 40, 'daily', 3),
    (f, 'Be the car DJ', 30, 'daily', 4),
    (f, '{P} does one of my chores', 50, 'daily', 5),
    (f, 'Movie night: I pick the film and snacks', 250, 'weekly', 10),
    (f, 'A friend comes over', 250, 'weekly', 11),
    (f, 'Bowling or trampoline park', 300, 'weekly', 12),
    (f, 'Small Lego set', 350, 'weekly', 13),
    (f, 'Yes hour', 200, 'weekly', 14);

  insert into public.accommodations(family_id, text, status, sort) values
    (f, 'Stay at the school gate all day', 'now', 1),
    (f, 'Reply to his messages straight away', 'next', 2),
    (f, 'Never leave the house without him', 'next', 3);

  insert into public.gifts(family_id, kind, pieces_total) values (f, 'mystery', 12) returning id into g;
  insert into public.gift_secrets(gift_id, family_id, secret_title) values (g, f, 'Set the mystery gift in Rewards & gifts');
  insert into public.gifts(family_id, kind, title, pieces_total) values (f, 'summit', 'Taym''s big prize (set it together)', 12);
  return f;
end $$;

-- Parent links Taym's login to the family (the app creates the login first).
create or replace function public.link_child(p_user uuid, p_username text) returns void
language plpgsql security definer set search_path = public as $$
declare f uuid := public.my_family();
begin
  if not public.is_parent() then raise exception 'Only a parent can do this'; end if;
  if exists (select 1 from public.profiles where id = p_user) then raise exception 'That login is already used'; end if;
  insert into public.profiles(id, family_id, role, display_name, username)
    values (p_user, f, 'child', (select child_name from public.families where id = f), p_username);
end $$;

-- Second parent joins with a code the first parent shares.
create table public.invites (
  code text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.make_invite() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_parent() then raise exception 'Only a parent can do this'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.invites(code, family_id) values (c, public.my_family());
  return c;
end $$;
create or replace function public.join_family(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into i from public.invites where code = upper(trim(p_code)) and created_at > now() - interval '2 days';
  if not found then raise exception 'That code is not valid'; end if;
  insert into public.profiles(id, family_id, role, display_name) values (auth.uid(), i.family_id, 'parent', coalesce(nullif(p_name,''),'Parent'));
  delete from public.invites where code = i.code;
  return i.family_id;
end $$;

-- ───────────────────────── Row level security ─────────────────────────

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.ladders enable row level security;
alter table public.ladder_steps enable row level security;
alter table public.brave_attempts enable row level security;
alter table public.missions enable row level security;
alter table public.mission_logs enable row level security;
alter table public.attendance enable row level security;
alter table public.point_events enable row level security;
alter table public.calm_uses enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.gifts enable row level security;
alter table public.gift_secrets enable row level security;
alter table public.wishes enable row level security;
alter table public.worries enable row level security;
alter table public.hearts enable row level security;
alter table public.accommodations enable row level security;
alter table public.invites enable row level security;

-- Everyone in the family can read; parents can change.
create policy fam_read on public.families for select to authenticated using (id = (select public.my_family()));
create policy fam_update on public.families for update to authenticated using (id = (select public.my_family()) and (select public.is_parent()));

create policy prof_read on public.profiles for select to authenticated using (family_id = (select public.my_family()));
create policy prof_update on public.profiles for update to authenticated using (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['ladders','ladder_steps','missions','rewards','accommodations','attendance','redemptions','point_events','mission_logs','brave_attempts','calm_uses','wishes','worries','hearts']
  loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (family_id = (select public.my_family()))', t);
    execute format('create policy %1$s_parent_all on public.%1$s for all to authenticated using (family_id = (select public.my_family()) and (select public.is_parent())) with check (family_id = (select public.my_family()) and (select public.is_parent()))', t);
  end loop;
end $$;

-- Accommodations are a parent's private list.
drop policy accommodations_read on public.accommodations;

-- Worries: Taym writes them, only parents read them back (in the worry-time list).
drop policy worries_read on public.worries;
create policy worries_child_insert on public.worries for insert to authenticated with check (family_id = (select public.my_family()));

-- Things Taym can do himself
create policy attempts_child_insert on public.brave_attempts for insert to authenticated
  with check (family_id = (select public.my_family()) and result is null);
create policy attempts_child_update on public.brave_attempts for update to authenticated
  using (family_id = (select public.my_family()) and result is null)
  with check (family_id = (select public.my_family()) and result is null);
create policy calm_child_insert on public.calm_uses for insert to authenticated with check (family_id = (select public.my_family()));
create policy wishes_child_insert on public.wishes for insert to authenticated with check (family_id = (select public.my_family()));
create policy wishes_child_delete on public.wishes for delete to authenticated using (family_id = (select public.my_family()));
create policy hearts_child_insert on public.hearts for insert to authenticated with check (family_id = (select public.my_family()) and from_role = (select public.my_role()));
create policy logs_child_insert on public.mission_logs for insert to authenticated
  with check (family_id = (select public.my_family()) and status = 'pending'
              and exists (select 1 from public.missions m where m.id = mission_id and m.kind = 'routine'));
create policy logs_child_delete on public.mission_logs for delete to authenticated
  using (family_id = (select public.my_family()) and status = 'pending');

-- Gifts: everyone reads; parents change. Secret name: parents, or Taym once the puzzle is complete.
create policy gifts_read on public.gifts for select to authenticated using (family_id = (select public.my_family()));
create policy gifts_parent_all on public.gifts for all to authenticated
  using (family_id = (select public.my_family()) and (select public.is_parent()))
  with check (family_id = (select public.my_family()) and (select public.is_parent()));
create policy secrets_parent_all on public.gift_secrets for all to authenticated
  using (family_id = (select public.my_family()) and (select public.is_parent()))
  with check (family_id = (select public.my_family()) and (select public.is_parent()));
create policy secrets_child_when_won on public.gift_secrets for select to authenticated
  using (family_id = (select public.my_family())
         and exists (select 1 from public.gifts g where g.id = gift_id and g.pieces_unlocked >= g.pieces_total));

-- Table access for signed-in users (row level security above decides which rows)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.points_balance to authenticated;
revoke all on all tables in schema public from anon;

-- Function permissions
revoke execute on function public.redeem_reward(uuid) from public, anon;
revoke execute on function public.climb_camp(uuid) from public, anon;
revoke execute on function public.add_pieces(uuid, int) from public, anon;
revoke execute on function public.create_family(text, text, text) from public, anon;
revoke execute on function public.link_child(uuid, text) from public, anon;
revoke execute on function public.make_invite() from public, anon;
revoke execute on function public.join_family(text, text) from public, anon;
grant execute on function public.redeem_reward(uuid), public.climb_camp(uuid), public.add_pieces(uuid, int),
  public.create_family(text, text, text), public.link_child(uuid, text), public.make_invite(), public.join_family(text, text)
  to authenticated;
revoke execute on function public.trg_brave_points(), public.trg_attendance_points(), public.trg_mission_points(),
  public.trg_mission_logs_cleanup(), public.trg_calm_points() from public, anon, authenticated;

-- ───────────────────────── Storage for photos and voice messages ─────────────────────────
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;

create policy media_parent_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_family())::text and (select public.is_parent()));
create policy media_parent_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_family())::text and (select public.is_parent()));
create policy media_parent_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select public.my_family())::text and (select public.is_parent()));

-- Safety plan text shown in Taym's Calm Corner, and live updates between the two phones.
alter table public.families
  add column if not exists safety_plan text not null default
  'If something happens while we are apart:
1. The school keeps you safe. Your teacher knows what to do.
2. {P} will come to get you as fast as possible.
3. If {P} can''t come, [name of trusted adult] will come.
4. You can always ask the teacher to call {P}.
You are safe, and you are never alone.';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.point_events, public.brave_attempts, public.attendance, public.mission_logs,
      public.hearts, public.gifts, public.redemptions, public.calm_uses, public.wishes, public.ladders;
  end if;
end $$;

-- Helper functions are only for signed-in users
revoke execute on function public.my_family(), public.my_role(), public.is_parent() from public, anon;
grant execute on function public.my_family(), public.my_role(), public.is_parent() to authenticated;

-- Phone notifications: who gets told what, and how the database asks the "notify" function to send it.
create extension if not exists pg_net with schema extensions;

-- Each phone that turned notifications on
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_own_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and family_id = (select public.my_family()) and role = (select public.my_role()));
create policy push_own_update on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and family_id = (select public.my_family()) and role = (select public.my_role()));
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Keys for signing notifications. Only the server (service role) can read this table.
create table if not exists public.push_config (
  id int primary key check (id = 1),
  vapid_public text not null,
  vapid_private text not null,
  vapid_subject text not null,
  notify_secret text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
grant select on public.push_config to service_role;

-- Ask the notify function to send a message to the family's parents or to Taym.
create or replace function public.push_notify(p_family uuid, p_role text, p_title text, p_body text, p_tab text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_secret text;
begin
  select notify_secret into v_secret from public.push_config where id = 1;
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://rgqjkhhtxlnevkbipdcm.supabase.co/functions/v1/notify',
    body := jsonb_build_object('family_id', p_family, 'role', p_role, 'title', p_title, 'body', p_body, 'tab', p_tab),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  -- a notification problem must never block the real action
  null;
end $$;
revoke execute on function public.push_notify(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.fam_names(p_family uuid, out kid text, out par text)
language sql stable security definer set search_path = public as $$
  select child_name, parent_label from public.families where id = p_family
$$;
revoke execute on function public.fam_names(uuid) from public, anon, authenticated;

-- Hearts go to the other side
create or replace function public.trg_notify_heart() returns trigger
language plpgsql security definer set search_path = public as $$
declare n record;
begin
  select * into n from public.fam_names(new.family_id);
  if new.from_role = 'parent' then
    perform public.push_notify(new.family_id, 'child', n.par || ' sent you a heart ❤️', 'Send one back?', 'mountain');
  else
    perform public.push_notify(new.family_id, 'parent', n.kid || ' sent you a heart back ❤️', 'He''s doing OK.', 'today');
  end if;
  return new;
end $$;
create trigger notify_heart after insert on public.hearts for each row execute function public.trg_notify_heart();

-- Fear ratings go to parents
create or replace function public.trg_notify_attempt() returns trigger
language plpgsql security definer set search_path = public as $$
declare n record; s record;
begin
  select * into n from public.fam_names(new.family_id);
  select position, replace(title, '{P}', n.par) as title into s from public.ladder_steps where id = new.step_id;
  if tg_op = 'INSERT' and new.result is null and new.fear_before is not null then
    perform public.push_notify(new.family_id, 'parent', n.kid || ' is starting a brave step',
      'Camp ' || s.position || ': ' || s.title || ' · fear ' || new.fear_before || '/10', 'today');
  elsif tg_op = 'UPDATE' and old.fear_after is null and new.fear_after is not null and new.result is null then
    perform public.push_notify(new.family_id, 'parent', n.kid || ' did his brave step! 🏔️',
      'Fear during it: ' || new.fear_after || '/10. Tap to confirm his points.', 'today');
  end if;
  return new;
end $$;
create trigger notify_attempt after insert or update of fear_after on public.brave_attempts
  for each row execute function public.trg_notify_attempt();

-- Points earned go to Taym (not his own calm points, not each routine step)
create or replace function public.trg_notify_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare n record; v_title text;
begin
  if new.points <= 0 or new.category not in ('brave','bonus','camp','school','streak','improve','behaviour') then return new; end if;
  select * into n from public.fam_names(new.family_id);
  v_title := case new.category
    when 'camp' then 'You climbed a camp! +' || new.points || ' 🎉'
    when 'streak' then 'Streak bonus! +' || new.points || ' ⭐'
    when 'improve' then 'Better than last time! +' || new.points
    else '+' || new.points || ' points! ⭐' end;
  perform public.push_notify(new.family_id, 'child', v_title,
    case when new.category = 'camp' then '3 new puzzle pieces are waiting for you!' else replace(new.reason, '{P}', n.par) end,
    'mountain');
  return new;
end $$;
create trigger notify_points after insert on public.point_events for each row execute function public.trg_notify_points();

-- Puzzle complete / summit reached go to Taym
create or replace function public.trg_notify_gift() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'won' and old.status <> 'won' then
    if new.kind = 'mystery' then
      perform public.push_notify(new.family_id, 'child', 'Your mystery puzzle is complete! 🎁', 'Open it to see your gift!', 'mountain');
    else
      perform public.push_notify(new.family_id, 'child', 'You reached the summit! 🏆', 'You won your summit prize!', 'rewards');
    end if;
  end if;
  return new;
end $$;
create trigger notify_gift after update of status on public.gifts for each row execute function public.trg_notify_gift();

-- Prize claims, worries and Calm Corner use go to parents
create or replace function public.trg_notify_parent_info() returns trigger
language plpgsql security definer set search_path = public as $$
declare n record;
begin
  select * into n from public.fam_names(new.family_id);
  if tg_table_name = 'redemptions' then
    perform public.push_notify(new.family_id, 'parent', n.kid || ' claimed a prize 🎁', replace(new.name, '{P}', n.par), 'today');
  elsif tg_table_name = 'worries' then
    perform public.push_notify(new.family_id, 'parent', n.kid || ' put a worry in the worry box', 'Go through it together at worry time.', 'plan');
  elsif tg_table_name = 'calm_uses' then
    perform public.push_notify(new.family_id, 'parent', n.kid || ' used the Calm Corner',
      new.tool || coalesce(' · feeling ' || lower(new.feeling), ''), 'progress');
  end if;
  return new;
end $$;
create trigger notify_redemption after insert on public.redemptions for each row execute function public.trg_notify_parent_info();
create trigger notify_worry after insert on public.worries for each row execute function public.trg_notify_parent_info();
create trigger notify_calm after insert on public.calm_uses for each row execute function public.trg_notify_parent_info();

revoke execute on function public.trg_notify_heart(), public.trg_notify_attempt(), public.trg_notify_points(),
  public.trg_notify_gift(), public.trg_notify_parent_info() from public, anon, authenticated;

-- Healthy eating: food-habit missions, a "healthy plate" log for Taym, and a private weight log for parents.

-- Food missions use the same check-and-approve flow as the morning routine
alter table public.missions drop constraint missions_kind_check;
alter table public.missions add constraint missions_kind_check check (kind in ('routine','behaviour','food'));

drop policy if exists logs_child_insert on public.mission_logs;
create policy logs_child_insert on public.mission_logs for insert to authenticated
  with check (family_id = (select public.my_family()) and status = 'pending'
              and exists (select 1 from public.missions m where m.id = mission_id and m.kind in ('routine','food')));

-- Healthy plate: Taym taps the food groups on his plate
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  groups text[] not null check (cardinality(groups) between 1 and 8
    and groups <@ array['veg','fruit','protein','grains','dairy','water','treat']::text[]),
  created_at timestamptz not null default now()
);
create index on public.meals(family_id, day);
alter table public.meals enable row level security;
create policy meals_read on public.meals for select to authenticated using (family_id = (select public.my_family()));
create policy meals_insert on public.meals for insert to authenticated with check (family_id = (select public.my_family()));
create policy meals_delete on public.meals for delete to authenticated using (family_id = (select public.my_family()));
grant select, insert, delete on public.meals to authenticated;

-- +3 for a balanced plate (a fruit or vegetable AND a protein), up to 3 plates a day
create or replace function public.trg_meal_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_today int;
begin
  if not (new.groups && array['veg','fruit']::text[] and 'protein' = any(new.groups)) then return new; end if;
  select count(*) into v_today from public.point_events
   where family_id = new.family_id and ref like 'plate:%'
     and (created_at at time zone 'Asia/Beirut')::date = new.day;
  if v_today < 3 then
    insert into public.point_events(family_id, points, reason, category, ref)
    values (new.family_id, 3, 'Healthy plate: ' || new.meal, 'food', 'plate:' || new.id);
  end if;
  return new;
end $$;
create trigger meal_points after insert on public.meals for each row execute function public.trg_meal_points();

create or replace function public.trg_meal_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.point_events where family_id = old.family_id and ref = 'plate:' || old.id;
  return old;
end $$;
create trigger meal_cleanup after delete on public.meals for each row execute function public.trg_meal_cleanup();
revoke execute on function public.trg_meal_points(), public.trg_meal_cleanup() from public, anon, authenticated;

-- Private weight log: parents only. Never shown to Taym, never worth points.
create table public.weights (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  kg numeric(5,2) not null check (kg between 10 and 200),
  height_cm numeric(5,1) check (height_cm between 80 and 220),
  note text,
  created_at timestamptz not null default now()
);
alter table public.weights enable row level security;
create policy weights_parent_all on public.weights for all to authenticated
  using (family_id = (select public.my_family()) and (select public.is_parent()))
  with check (family_id = (select public.my_family()) and (select public.is_parent()));
grant select, insert, update, delete on public.weights to authenticated;

-- Starting food missions, for existing families and every new one
create or replace function public.seed_food_missions(p_family uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.missions(family_id, kind, title, points, checkins, sort) values
    (p_family, 'food', 'Fruit or vegetable with lunch', 3, 1, 20),
    (p_family, 'food', 'Vegetable with dinner', 3, 1, 21),
    (p_family, 'food', 'Water instead of soda or juice', 3, 1, 22),
    (p_family, 'food', 'Tried a new food (one brave bite counts!)', 5, 1, 23),
    (p_family, 'food', 'Helped cook or prepare food', 5, 1, 24),
    (p_family, 'food', 'Ate dinner with the family', 3, 1, 25);
$$;
revoke execute on function public.seed_food_missions(uuid) from public, anon, authenticated;

create or replace function public.trg_family_food() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_food_missions(new.id);
  return new;
end $$;
create trigger family_food after insert on public.families for each row execute function public.trg_family_food();
revoke execute on function public.trg_family_food() from public, anon, authenticated;

select public.seed_food_missions(id) from public.families f
 where not exists (select 1 from public.missions m where m.family_id = f.id and m.kind = 'food');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.meals;
  end if;
end $$;

-- Parents can add their own paths (e.g. a Health path). Each path can have its own summit prize.
alter table public.ladders drop constraint ladders_kind_check;
alter table public.ladders add constraint ladders_kind_check check (kind in ('school','home','custom'));
alter table public.ladders drop constraint ladders_family_id_kind_key;
create unique index ladders_one_builtin_per_family on public.ladders(family_id, kind) where kind <> 'custom';
alter table public.ladders add column if not exists archived boolean not null default false;

alter table public.gifts add column if not exists ladder_id uuid references public.ladders(id) on delete set null;
update public.gifts g set ladder_id = l.id
  from public.ladders l
 where g.kind = 'summit' and g.ladder_id is null and l.family_id = g.family_id and l.kind = 'school';

-- Summit prize is won at the top of the path it belongs to
create or replace function public.climb_camp(p_ladder uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_max int;
  v_step text;
  g record;
begin
  if not public.is_parent() then raise exception 'Only a parent can do this'; end if;
  select * into l from public.ladders where id = p_ladder and family_id = public.my_family();
  if not found then raise exception 'Ladder not found'; end if;
  select max(position) into v_max from public.ladder_steps where ladder_id = l.id;
  if l.current_position > v_max then raise exception 'Already at the top'; end if;
  select title into v_step from public.ladder_steps where ladder_id = l.id and position = l.current_position;

  update public.ladders set current_position = current_position + 1 where id = l.id;
  insert into public.point_events(family_id, points, reason, category, ref)
    values (l.family_id, 100, 'Climbed a camp: ' || v_step, 'camp', 'camp:' || l.id || ':' || l.current_position);

  select * into g from public.gifts where family_id = l.family_id and kind = 'mystery' and status = 'active'
   order by created_at limit 1;
  if found then
    update public.gifts set pieces_unlocked = least(pieces_total, pieces_unlocked + 3),
      status = case when pieces_unlocked + 3 >= pieces_total then 'won' else status end
     where id = g.id;
  end if;

  if l.current_position + 1 > v_max then
    update public.gifts set status = 'won'
     where family_id = l.family_id and kind = 'summit' and status = 'active' and ladder_id = l.id;
  end if;
  return json_build_object('position', l.current_position + 1, 'top', l.current_position + 1 > v_max);
end $$;

-- Grand summit (top of every active path) and a prize wallet (claimed → accepted → used, or declined with points back).

alter table public.gifts drop constraint gifts_kind_check;
alter table public.gifts add constraint gifts_kind_check check (kind in ('mystery','summit','grand'));

alter table public.redemptions drop constraint redemptions_status_check;
update public.redemptions set status = 'used' where status = 'given';
alter table public.redemptions add constraint redemptions_status_check check (status in ('claimed','approved','used','declined'));
alter table public.redemptions add column if not exists decided_at timestamptz;

-- Is every active path at the top?
create or replace function public.all_paths_topped(p_family uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) > 0 and bool_and(l.current_position > coalesce((select max(position) from public.ladder_steps s where s.ladder_id = l.id), 0))
  from public.ladders l where l.family_id = p_family and not l.archived
$$;
revoke execute on function public.all_paths_topped(uuid) from public, anon;
grant execute on function public.all_paths_topped(uuid) to authenticated;

create or replace function public.climb_camp(p_ladder uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  l record;
  v_max int;
  v_step text;
  g record;
begin
  if not public.is_parent() then raise exception 'Only a parent can do this'; end if;
  select * into l from public.ladders where id = p_ladder and family_id = public.my_family();
  if not found then raise exception 'Ladder not found'; end if;
  select max(position) into v_max from public.ladder_steps where ladder_id = l.id;
  if l.current_position > v_max then raise exception 'Already at the top'; end if;
  select title into v_step from public.ladder_steps where ladder_id = l.id and position = l.current_position;

  update public.ladders set current_position = current_position + 1 where id = l.id;
  insert into public.point_events(family_id, points, reason, category, ref)
    values (l.family_id, 100, 'Climbed a camp: ' || v_step, 'camp', 'camp:' || l.id || ':' || l.current_position)
    on conflict (family_id, ref) where ref is not null do nothing;

  select * into g from public.gifts where family_id = l.family_id and kind = 'mystery' and status = 'active'
   order by created_at limit 1;
  if found then
    update public.gifts set pieces_unlocked = least(pieces_total, pieces_unlocked + 3),
      status = case when pieces_unlocked + 3 >= pieces_total then 'won' else status end
     where id = g.id;
  end if;

  if l.current_position + 1 > v_max then
    update public.gifts set status = 'won'
     where family_id = l.family_id and kind = 'summit' and status = 'active'
       and (ladder_id = l.id or (ladder_id is null and l.kind = 'school'));
  end if;

  if public.all_paths_topped(l.family_id) then
    update public.gifts set status = 'won' where family_id = l.family_id and kind = 'grand' and status = 'active';
  end if;
  return json_build_object('position', l.current_position + 1, 'top', l.current_position + 1 > v_max);
end $$;

-- Parent declines a claimed prize: points go back to Taym.
create or replace function public.decline_redemption(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_parent() then raise exception 'Only a parent can do this'; end if;
  select * into r from public.redemptions where id = p_id and family_id = public.my_family() and status = 'claimed';
  if not found then raise exception 'Prize request not found'; end if;
  update public.redemptions set status = 'declined', decided_at = now() where id = p_id;
  delete from public.point_events where family_id = r.family_id and ref = 'redeem:' || r.id;
end $$;
revoke execute on function public.decline_redemption(uuid) from public, anon;
grant execute on function public.decline_redemption(uuid) to authenticated;

-- Tell Taym when a prize is accepted or declined, and when the grand summit is won.
create or replace function public.trg_notify_redemption_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare n record;
begin
  if new.status = old.status then return new; end if;
  select * into n from public.fam_names(new.family_id);
  if new.status = 'approved' then
    perform public.push_notify(new.family_id, 'child', 'Your prize is ready! 🎟️', replace(new.name, '{P}', n.par) || ' is waiting in My prizes.', 'rewards');
  elsif new.status = 'declined' then
    perform public.push_notify(new.family_id, 'child', 'Prize not this time', replace(new.name, '{P}', n.par) || ': your ' || new.price || ' points are back.', 'rewards');
  end if;
  return new;
end $$;
create trigger notify_redemption_status after update of status on public.redemptions
  for each row execute function public.trg_notify_redemption_status();
revoke execute on function public.trg_notify_redemption_status() from public, anon, authenticated;

create or replace function public.trg_notify_gift() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'won' and old.status <> 'won' then
    if new.kind = 'mystery' then
      perform public.push_notify(new.family_id, 'child', 'Your mystery puzzle is complete! 🎁', 'Open it to see your gift!', 'mountain');
    elsif new.kind = 'grand' then
      perform public.push_notify(new.family_id, 'child', 'GRAND SUMMIT! 🏔️🏆', 'You climbed every path. You won the grand prize!', 'rewards');
    else
      perform public.push_notify(new.family_id, 'child', 'You reached the summit! 🏆', 'You won your summit prize!', 'rewards');
    end if;
  end if;
  return new;
end $$;

