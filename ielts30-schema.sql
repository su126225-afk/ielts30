-- ═══════════ IELTS 30 KUN (alohida sayt) ═══════════
-- Supabase → SQL Editor → New query → hammasini qo'yib Run. Bir marta. Qayta ishga tushirsa ham xavfsiz.
-- Asosiy saytdagi marafon (ie_*) jadvallariga TEGMAYDI: bu yerda hammasi ie_* nomli.
-- Qoidalar: 1-kun hamma uchun bepul; 2-kundan boshlab login + parol kerak; kun tugamaguncha keyingisi ochilmaydi.
create extension if not exists pgcrypto with schema extensions;

-- Bepul (1-kun) o'quvchilar natijalari shu guruhga yoziladi; pullik o'quvchilar uchun IELTS30 guruhi
insert into groups (code, name) values ('IELTSFREE', 'IELTS 30 · bepul 1-kun'), ('IELTS30', 'IELTS 30 kun') on conflict (code) do nothing;

create or replace function ie_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Tashkent')::date $$;

create table if not exists ie_settings (
  id          int primary key default 1 check (id = 1),
  miss_limit  int not null default 2 check (miss_limit between 1 and 10),     -- shuncha kun qoldirsa → qulf
  window_days int not null default 10 check (window_days between 2 and 60)    -- oxirgi shuncha kun ichida
);
insert into ie_settings (id) values (1) on conflict do nothing;

create table if not exists ie_days (day int primary key check (day between 1 and 100), tasks text[] not null);

create table if not exists ie_students (
  id           uuid primary key default gen_random_uuid(),
  student_name text not null,
  group_code   text not null,
  start_day    date not null default ie_today(),
  open_upto    int  not null default 1,        -- shu kungacha (shu kun ham) ochiq
  reset_at     date not null default ie_today(),   -- shu sanagacha qoldirilgan kunlar hisobga olinmaydi
  locked       boolean not null default false,
  lock_reason  text not null default '',
  excused      date[] not null default '{}',   -- o'qituvchi kechirgan sanalar
  created_at   timestamptz not null default now()
);
create unique index if not exists ie_students_uq on ie_students (upper(group_code), lower(student_name));

create table if not exists ie_progress (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references ie_students(id) on delete cascade,
  day        int  not null,
  task       text not null,
  score      numeric,
  total      numeric,
  done_day   date not null default ie_today(),
  done_at    timestamptz not null default now(),
  unique (student_id, day, task)
);
create index if not exists ie_progress_day on ie_progress (student_id, done_day);

alter table ie_settings enable row level security;
alter table ie_days     enable row level security;
alter table ie_students enable row level security;
alter table ie_progress enable row level security;
do $$ declare t text; begin
  foreach t in array array['ie_settings','ie_days','ie_students','ie_progress'] loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('create policy %I on %I for all to authenticated using (true) with check (true)', t || '_all', t);
  end loop;
end $$;


-- IELTS 30: jarima (qoldirilgan kunlar uchun qulf) YO'Q — kunlar faqat ketma-ket ochiladi
create or replace function ie_missed(sid uuid) returns date[] language sql stable as $$ select '{}'::date[] $$;
create or replace function ie_eval(sid uuid) returns void language plpgsql as $$ begin end $$;

create table if not exists ie_accounts (
  id           uuid primary key default gen_random_uuid(),
  login        text not null unique,
  pass_hash    text not null,
  student_name text not null,
  group_code   text not null default '',
  expires_on   date not null,
  active       boolean not null default true,
  fails        int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now(),
  last_login   timestamptz
);
create table if not exists ie_sessions (
  token      uuid primary key default gen_random_uuid(),
  account_id uuid not null references ie_accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table ie_students add column if not exists account_id uuid unique references ie_accounts(id) on delete cascade;
alter table ie_settings add column if not exists promo_on boolean not null default true;

alter table ie_accounts enable row level security;
alter table ie_sessions enable row level security;
drop policy if exists ie_accounts_all on ie_accounts;
create policy ie_accounts_all on ie_accounts for all to authenticated using (true) with check (true);
-- ie_sessions: hech kimga to'g'ridan-to'g'ri ruxsat yo'q (faqat funksiyalar orqali)

create or replace function ie_acc(tok uuid) returns ie_accounts
language sql security definer set search_path = public stable as $$
  select a.* from ie_sessions s join ie_accounts a on a.id = s.account_id where s.token = tok
$$;

-- Holat (umumiy yadro)
create or replace function ie_status_core(sid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s ie_students; st ie_settings;
begin
  perform ie_eval(sid);
  select * into s from ie_students where id = sid;
  select * into st from ie_settings where id = 1;
  return jsonb_build_object('enabled', true, 'id', s.id, 'name', s.student_name, 'open_upto', s.open_upto, 'locked', s.locked,
    'lock_reason', s.lock_reason, 'start_day', s.start_day, 'today', ie_today(), 'miss_limit', st.miss_limit, 'window_days', st.window_days,
    'missed', to_jsonb(ie_missed(s.id)),
    'progress', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'task', task, 'score', score, 'total', total, 'done_day', done_day)) from ie_progress where student_id = s.id), '[]'::jsonb),
    'days', coalesce((select jsonb_object_agg(day::text, to_jsonb(tasks)) from ie_days), '{}'::jsonb));
end $$;

create or replace function ie_complete_core(sid uuid, d int, t text, sc numeric, tot numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s ie_students; tasks_ text[]; last_day int; all_done boolean;
begin
  perform ie_eval(sid);
  select * into s from ie_students where id = sid;
  if s.locked then return jsonb_build_object('ok', false, 'reason', 'locked'); end if;
  if d < 1 or d > s.open_upto then return jsonb_build_object('ok', false, 'reason', 'day_locked'); end if;
  select tasks into tasks_ from ie_days where day = d;
  if tasks_ is null or not (t = any (tasks_)) then return jsonb_build_object('ok', false, 'reason', 'unknown_task'); end if;
  insert into ie_progress (student_id, day, task, score, total) values (s.id, d, t, sc, tot)
  on conflict (student_id, day, task) do update
    set score = greatest(coalesce(ie_progress.score, 0), coalesce(excluded.score, 0)), total = coalesce(excluded.total, ie_progress.total), done_at = now();
  select not exists (select 1 from unnest(tasks_) x where not exists (select 1 from ie_progress p where p.student_id = s.id and p.day = d and p.task = x)) into all_done;
  select max(day) into last_day from ie_days;
  if all_done and d = s.open_upto and d <= last_day then update ie_students set open_upto = d + 1 where id = s.id; end if;
  return jsonb_build_object('ok', true, 'day_done', all_done);
end $$;

-- Login tekshiruvi → har doim ie_students qatori (birinchi kirishda yaratiladi)
create or replace function ie_student_of(tok uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a ie_accounts; sid uuid;
begin
  a := ie_acc(tok);
  if a.id is null then return jsonb_build_object('error', 'auth'); end if;
  if not a.active then return jsonb_build_object('error', 'inactive'); end if;
  if a.expires_on < ie_today() then return jsonb_build_object('error', 'expired', 'expires', a.expires_on); end if;
  select id into sid from ie_students where account_id = a.id;
  if sid is null then
    insert into ie_students (student_name, group_code, account_id) values (a.student_name || ' #' || a.login, a.group_code, a.id) returning id into sid;
  end if;
  return jsonb_build_object('sid', sid, 'expires', a.expires_on);
end $$;

-- Kirish
create or replace function ie_login(l text, p text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a ie_accounts; tok uuid;
begin
  select * into a from ie_accounts where lower(login) = lower(trim(l));
  if not found then perform pg_sleep(0.5); return jsonb_build_object('error', 'bad'); end if;
  if a.locked_until is not null and a.locked_until > now() then return jsonb_build_object('error', 'wait'); end if;
  if a.pass_hash <> crypt(trim(p), a.pass_hash) then
    update ie_accounts set fails = fails + 1, locked_until = case when fails + 1 >= 5 then now() + interval '10 minutes' else null end
      where id = a.id;
    return jsonb_build_object('error', 'bad');
  end if;
  if not a.active then return jsonb_build_object('error', 'inactive'); end if;
  if a.expires_on < ie_today() then return jsonb_build_object('error', 'expired', 'expires', a.expires_on); end if;
  update ie_accounts set fails = 0, locked_until = null, last_login = now() where id = a.id;
  delete from ie_sessions where account_id = a.id and created_at < now() - interval '60 days';
  insert into ie_sessions (account_id) values (a.id) returning token into tok;
  return jsonb_build_object('token', tok, 'login', a.login, 'name', a.student_name, 'group', a.group_code, 'expires', a.expires_on);
end $$;

create or replace function ie_logout(tok uuid) returns void
language sql security definer set search_path = public as $$ delete from ie_sessions where token = tok $$;

create or replace function ie_status_t(tok uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := ie_student_of(tok);
  if r ? 'error' then return r; end if;
  return ie_status_core((r->>'sid')::uuid) || jsonb_build_object('expires', r->'expires');
end $$;

create or replace function ie_complete_t(tok uuid, d int, t text, sc numeric, tot numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := ie_student_of(tok);
  if r ? 'error' then return jsonb_build_object('ok', false, 'reason', r->>'error'); end if;
  return ie_complete_core((r->>'sid')::uuid, d, t, sc, tot);
end $$;

-- Hamma ko'ra oladigan: reklama pop-up yoqilganmi
create or replace function ie_public() returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object('promo', coalesce((select promo_on from ie_settings where id = 1), true))
$$;

-- ───── O'qituvchi ─────
create or replace function ie_admin_create(n text, g text, days int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare base text; lg text; pw text; i int := 1; aid uuid;
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'not allowed'; end if;
  base := left(regexp_replace(lower(split_part(trim(n), ' ', 1)), '[^a-z0-9]', '', 'g'), 10);
  if length(base) < 3 then base := 'student'; end if;
  loop
    lg := base || lpad(i::text, 2, '0');
    exit when not exists (select 1 from ie_accounts where login = lg);
    i := i + 1;
  end loop;
  pw := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into ie_accounts (login, pass_hash, student_name, group_code, expires_on)
  values (lg, crypt(pw, gen_salt('bf')), regexp_replace(trim(n), '\s+', ' ', 'g'), upper(trim(coalesce(g, ''))), ie_today() + greatest(1, coalesce(days, 30)))
  returning id into aid;
  return jsonb_build_object('id', aid, 'login', lg, 'password', pw);
end $$;

create or replace function ie_admin_reset(aid uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare pw text; lg text;
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'not allowed'; end if;
  pw := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update ie_accounts set pass_hash = crypt(pw, gen_salt('bf')), fails = 0, locked_until = null where id = aid returning login into lg;
  delete from ie_sessions where account_id = aid;     -- eski qurilmalardan chiqarib yuboriladi
  return jsonb_build_object('login', lg, 'password', pw);
end $$;

create or replace function ie_admin_unlock(sid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'not allowed'; end if;
  update ie_students set locked = false, lock_reason = '', reset_at = ie_today() where id = sid;
end $$;

revoke all on function ie_acc(uuid), ie_status_core(uuid), ie_complete_core(uuid, int, text, numeric, numeric), ie_student_of(uuid) from public, anon, authenticated;
grant execute on function ie_login(text, text), ie_logout(uuid), ie_status_t(uuid), ie_complete_t(uuid, int, text, numeric, numeric), ie_public() to anon, authenticated;
revoke all on function ie_admin_create(text, text, int), ie_admin_reset(uuid), ie_admin_unlock(uuid) from public, anon;
grant execute on function ie_admin_create(text, text, int), ie_admin_reset(uuid), ie_admin_unlock(uuid) to authenticated;
