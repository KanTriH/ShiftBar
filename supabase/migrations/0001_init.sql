-- Shift Scheduler 2.0 - 初始数据库结构
-- 使用方法：Supabase 控制台 > SQL Editor > New query > 粘贴全部内容 > Run
-- 可重复执行前请先执行 supabase/reset.sql（会清空全部数据）

-- ============================================================
-- 表
-- ============================================================

create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  -- 员工报班用的店铺码，出现在分享链接里
  code        text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  -- 长度为 7 的数组，下标 0 = 周一 ... 6 = 周日；元素 {"open":540,"close":1320}（分钟数），null = 休息
  hours       jsonb not null default '[
    {"open":540,"close":1320},{"open":540,"close":1320},{"open":540,"close":1320},
    {"open":540,"close":1320},{"open":540,"close":1320},{"open":540,"close":1320},
    {"open":540,"close":1320}]'::jsonb,
  created_at  timestamptz not null default now()
);
create index on public.shops (owner_id);

create table public.positions (
  id       uuid primary key default gen_random_uuid(),
  shop_id  uuid not null references public.shops(id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 30),
  color    text not null default '#3a64c8',
  sort     int  not null default 0
);
create index on public.positions (shop_id);

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  status      text not null default 'regular' check (status in ('trial', 'regular')),
  -- 员工注册并认领后写入；未注册的访客为 null
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index members_shop_name_uq on public.members (shop_id, lower(name));
create unique index members_shop_user_uq on public.members (shop_id, user_id) where user_id is not null;
create index on public.members (user_id);

create table public.availability (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  day        date not null,
  start_min  int  not null check (start_min >= 0 and start_min < 1440),
  end_min    int  not null check (end_min > 0 and end_min <= 1440),
  note       text not null default '',
  check (end_min > start_min)
);
create index on public.availability (shop_id, day);
create index on public.availability (member_id, day);

create table public.shifts (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  position_id  uuid references public.positions(id) on delete set null,
  day          date not null,
  start_min    int  not null check (start_min >= 0 and start_min < 1440),
  end_min      int  not null check (end_min > 0 and end_min <= 1440),
  note         text not null default '',
  check (end_min > start_min)
);
create index on public.shifts (shop_id, day);
create index on public.shifts (member_id, day);

-- 某个店铺的某一周（week_start = 周一）已发布，员工才能看到该周班表
create table public.publications (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  week_start  date not null,
  primary key (shop_id, week_start)
);

-- ============================================================
-- 权限辅助函数（security definer，避免 RLS 策略互相递归）
-- ============================================================

create function public.is_owner(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = s and owner_id = auth.uid())
$$;

create function public.is_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where shop_id = s and user_id = auth.uid())
$$;

create function public.can_read_shift(p_member uuid, p_shop uuid, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = p_member and user_id = auth.uid())
     and exists (select 1 from publications
                 where shop_id = p_shop and week_start = date_trunc('week', p_day)::date)
$$;

-- ============================================================
-- 行级安全 (RLS)
-- ============================================================

alter table public.shops         enable row level security;
alter table public.positions     enable row level security;
alter table public.members       enable row level security;
alter table public.availability  enable row level security;
alter table public.shifts        enable row level security;
alter table public.publications  enable row level security;

-- shops
create policy shops_owner_all   on public.shops for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy shops_member_read on public.shops for select
  using (public.is_member(id));

-- positions
create policy positions_owner_all   on public.positions for all
  using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));
create policy positions_member_read on public.positions for select
  using (public.is_member(shop_id));

-- members：店长全权；员工只能看到自己的那一行
create policy members_owner_all on public.members for all
  using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));
create policy members_self_read on public.members for select
  using (user_id = auth.uid());

-- availability：店长可读写；员工只读自己的（写入走 submit_availability）
create policy availability_owner_all on public.availability for all
  using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));
create policy availability_self_read on public.availability for select
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));

-- shifts：店长可读写；员工只能看到自己且已发布周的班次
create policy shifts_owner_all on public.shifts for all
  using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));
create policy shifts_self_read on public.shifts for select
  using (public.can_read_shift(member_id, shop_id, day));

-- publications
create policy publications_owner_all   on public.publications for all
  using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));
create policy publications_member_read on public.publications for select
  using (public.is_member(shop_id));

-- ============================================================
-- RPC：访客（未登录）也能用的入口
-- ============================================================

-- 通过店铺码取得公开信息：店名、营业时间、已有员工名字（用于名字联想）
create function public.get_shop_public(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops;
begin
  select * into s from shops where code = p_code;
  if not found then return null; end if;
  return jsonb_build_object(
    'name', s.name,
    'hours', s.hours,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'claimed', m.user_id is not null) order by m.name)
      from members m where m.shop_id = s.id), '[]'::jsonb)
  );
end $$;

-- 访客回填自己某一周已提交的报班（已被注册员工占用的名字不返回，防止窥探）
create function public.get_guest_availability(p_code text, p_name text, p_week date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops; m members;
begin
  select * into s from shops where code = p_code;
  if not found then return '[]'::jsonb; end if;
  select * into m from members where shop_id = s.id and lower(name) = lower(btrim(p_name));
  if not found or m.user_id is not null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('day', a.day, 'start', a.start_min, 'end', a.end_min, 'note', a.note) order by a.day, a.start_min)
    from availability a where a.member_id = m.id and a.day >= p_week and a.day < p_week + 7), '[]'::jsonb);
end $$;

-- 提交一周的报班（整周覆盖）。
-- 已登录且已认领的员工：忽略 p_name，写入自己的记录。
-- 访客：按名字匹配/创建成员；名字已被注册员工占用时拒绝。
create function public.submit_availability(p_code text, p_name text, p_week date, p_entries jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s   shops;
  m   members;
  uid uuid := auth.uid();
  nm  text := btrim(coalesce(p_name, ''));
begin
  select * into s from shops where code = p_code;
  if not found then raise exception 'shop_not_found'; end if;

  if uid is not null then
    select * into m from members where shop_id = s.id and user_id = uid;
  end if;

  if m.id is null then
    if nm = '' then raise exception 'name_required'; end if;
    select * into m from members where shop_id = s.id and lower(name) = lower(nm);
    if found then
      if m.user_id is not null and (uid is null or m.user_id <> uid) then
        raise exception 'name_claimed';
      end if;
    else
      insert into members (shop_id, name) values (s.id, left(nm, 30)) returning * into m;
    end if;
  end if;

  delete from availability where member_id = m.id and day >= p_week and day < p_week + 7;

  insert into availability (shop_id, member_id, day, start_min, end_min, note)
  select s.id, m.id, (e->>'day')::date, (e->>'start')::int, (e->>'end')::int, left(coalesce(e->>'note', ''), 200)
  from jsonb_array_elements(p_entries) e
  where (e->>'day')::date >= p_week and (e->>'day')::date < p_week + 7
    and (e->>'end')::int > (e->>'start')::int;

  return m.id;
end $$;

-- 已登录用户凭店铺码 + 名字认领（或新建）自己的员工身份
create function public.claim_member(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s   shops;
  m   members;
  uid uuid := auth.uid();
  nm  text := btrim(coalesce(p_name, ''));
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into s from shops where code = p_code;
  if not found then raise exception 'shop_not_found'; end if;

  select * into m from members where shop_id = s.id and user_id = uid;
  if found then return to_jsonb(m); end if;

  if nm = '' then raise exception 'name_required'; end if;
  select * into m from members where shop_id = s.id and lower(name) = lower(nm);
  if found then
    if m.user_id is not null then raise exception 'name_claimed'; end if;
    update members set user_id = uid where id = m.id returning * into m;
  else
    insert into members (shop_id, name, user_id) values (s.id, left(nm, 30), uid) returning * into m;
  end if;
  return to_jsonb(m);
end $$;

grant execute on function public.get_shop_public(text)                        to anon, authenticated;
grant execute on function public.get_guest_availability(text, text, date)     to anon, authenticated;
grant execute on function public.submit_availability(text, text, date, jsonb) to anon, authenticated;
grant execute on function public.claim_member(text, text)                     to authenticated;
