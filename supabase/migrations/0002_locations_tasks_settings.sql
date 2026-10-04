-- Shift Scheduler 2.0 - 迁移 0002
-- 新增：多门店（locations）、当日任务（daily_tasks）、店铺设置（一周起始日 / 法定假日地区 / PDF 样式）
-- 在已经执行过 0001_init.sql 的数据库上运行即可，不会删除任何已有数据。
-- 建议顺序：先运行本迁移，再部署新版前端。

-- ============================================================
-- 店铺设置
-- ============================================================
alter table public.shops
  add column if not exists week_start smallint not null default 1 check (week_start in (0, 1)),  -- 1 = 周一开始, 0 = 周日开始
  add column if not exists region     text     not null default 'CA',                            -- 法定假日地区：CA / ON / BC / AB / SK / QC / NONE
  add column if not exists pdf_style  text     not null default 'table' check (pdf_style in ('table', 'timeline'));

-- ============================================================
-- 门店（同一批员工可在多家门店之间排班）
-- ============================================================
create table if not exists public.locations (
  id       uuid primary key default gen_random_uuid(),
  shop_id  uuid not null references public.shops(id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 60),
  sort     int  not null default 0
);
create index if not exists locations_shop_idx on public.locations (shop_id);

-- 每个已有店铺补一个默认门店（名字沿用店名）
insert into public.locations (shop_id, name, sort)
select s.id, s.name, 0 from public.shops s
where not exists (select 1 from public.locations l where l.shop_id = s.id);

-- 新建店铺时自动创建第一个门店
create or replace function public.shops_create_default_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into locations (shop_id, name, sort) values (new.id, new.name, 0);
  return new;
end $$;
drop trigger if exists shops_default_location on public.shops;
create trigger shops_default_location after insert on public.shops
  for each row execute function public.shops_create_default_location();

-- 班次属于某个门店
alter table public.shifts add column if not exists location_id uuid references public.locations(id) on delete cascade;
update public.shifts sh set location_id = (
  select l.id from public.locations l where l.shop_id = sh.shop_id order by l.sort, l.id limit 1
) where sh.location_id is null;
alter table public.shifts alter column location_id set not null;
create index if not exists shifts_location_idx on public.shifts (location_id, day);

-- 没有指定门店时自动落到该店铺的第一个门店（让迁移后、前端更新前的旧版页面也能继续排班）
create or replace function public.shifts_default_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.location_id is null then
    select l.id into new.location_id from locations l where l.shop_id = new.shop_id order by l.sort, l.id limit 1;
  end if;
  return new;
end $$;
drop trigger if exists shifts_set_default_location on public.shifts;
create trigger shifts_set_default_location before insert on public.shifts
  for each row execute function public.shifts_default_location();

-- 员工报班时可选可上班的门店；空数组 = 任意门店
alter table public.availability add column if not exists location_ids uuid[] not null default '{}';

-- ============================================================
-- 当日任务（DAILY TASK）：每个门店每天一条文本
-- ============================================================
create table if not exists public.daily_tasks (
  shop_id      uuid not null references public.shops(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete cascade,
  day          date not null,
  text         text not null default '' check (char_length(text) <= 2000),
  primary key (location_id, day)
);
create index if not exists daily_tasks_shop_idx on public.daily_tasks (shop_id, day);

-- ============================================================
-- 一周起始日：发布判断改为按店铺设置计算该周的起始日期
-- 修改起始日后，之前发布的周会失效（日期对不上），所以同时清空发布记录，需要重新发布
-- ============================================================
create or replace function public.week_start_of(p_shop uuid, p_day date) returns date
language sql stable security definer set search_path = public as $$
  select p_day - ((extract(dow from p_day)::int - s.week_start + 7) % 7)
  from shops s where s.id = p_shop
$$;

create or replace function public.can_read_shift(p_member uuid, p_shop uuid, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = p_member and user_id = auth.uid())
     and exists (select 1 from publications where shop_id = p_shop and week_start = public.week_start_of(p_shop, p_day))
$$;

create or replace function public.can_read_task(p_shop uuid, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(p_shop)
     and exists (select 1 from publications where shop_id = p_shop and week_start = public.week_start_of(p_shop, p_day))
$$;

create or replace function public.shops_reset_publications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from publications where shop_id = new.id;
  return new;
end $$;
drop trigger if exists shops_week_start_changed on public.shops;
create trigger shops_week_start_changed after update of week_start on public.shops
  for each row when (old.week_start is distinct from new.week_start)
  execute function public.shops_reset_publications();

-- ============================================================
-- RLS
-- ============================================================
alter table public.locations   enable row level security;
alter table public.daily_tasks enable row level security;

drop policy if exists locations_owner_all   on public.locations;
drop policy if exists locations_member_read on public.locations;
create policy locations_owner_all   on public.locations for all
  using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));
create policy locations_member_read on public.locations for select
  using (public.is_member(shop_id));

drop policy if exists daily_tasks_owner_all   on public.daily_tasks;
drop policy if exists daily_tasks_member_read on public.daily_tasks;
create policy daily_tasks_owner_all   on public.daily_tasks for all
  using (public.is_owner(shop_id)) with check (public.is_owner(shop_id));
create policy daily_tasks_member_read on public.daily_tasks for select
  using (public.can_read_task(shop_id, day));

-- ============================================================
-- 访客 RPC 更新：返回门店 / 起始日 / 地区；报班支持选择门店
-- ============================================================
create or replace function public.get_shop_public(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops;
begin
  select * into s from shops where code = p_code;
  if not found then return null; end if;
  return jsonb_build_object(
    'name', s.name,
    'hours', s.hours,
    'week_start', s.week_start,
    'region', s.region,
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.sort, l.name)
      from locations l where l.shop_id = s.id), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'claimed', m.user_id is not null) order by m.name)
      from members m where m.shop_id = s.id), '[]'::jsonb)
  );
end $$;

create or replace function public.get_guest_availability(p_code text, p_name text, p_week date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s shops; m members;
begin
  select * into s from shops where code = p_code;
  if not found then return '[]'::jsonb; end if;
  select * into m from members where shop_id = s.id and lower(name) = lower(btrim(p_name));
  if not found or m.user_id is not null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('day', a.day, 'start', a.start_min, 'end', a.end_min, 'note', a.note, 'locations', to_jsonb(a.location_ids)) order by a.day, a.start_min)
    from availability a where a.member_id = m.id and a.day >= p_week and a.day < p_week + 7), '[]'::jsonb);
end $$;

create or replace function public.submit_availability(p_code text, p_name text, p_week date, p_entries jsonb) returns uuid
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

  insert into availability (shop_id, member_id, day, start_min, end_min, note, location_ids)
  select s.id, m.id, (e->>'day')::date, (e->>'start')::int, (e->>'end')::int, left(coalesce(e->>'note', ''), 200),
         coalesce((select array_agg(l.id) from locations l
                   where l.shop_id = s.id
                     and l.id::text in (select jsonb_array_elements_text(coalesce(e->'locations', '[]'::jsonb)))), '{}')
  from jsonb_array_elements(p_entries) e
  where (e->>'day')::date >= p_week and (e->>'day')::date < p_week + 7
    and (e->>'end')::int > (e->>'start')::int;

  return m.id;
end $$;
