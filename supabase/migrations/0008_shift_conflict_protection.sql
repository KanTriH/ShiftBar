-- Shift Scheduler 2.0 - 迁移 0008：多人同时排班时的冲突保护
--
-- 1. shifts.updated_at / updated_by：每次修改自动更新。前端更新班次时带上自己读到的 updated_at，
--    如果已经被别人改过（或删除），这次更新不会生效，界面提示并刷新，而不是悄悄覆盖对方的修改。
-- 2. 排除约束 shifts_no_overlap：同一个员工的两个班次在时间上不能重叠（不管在哪家门店、是否跨午夜）。
--    由数据库保证，两个人同时排同一个人的重叠班次时，后提交的会被拒绝。
--
-- 运行前请确认现有数据里没有重叠的班次；有的话下面的检查会中止并告诉你数量。
-- 查看具体是哪几对：supabase/checks/overlapping_shifts.sql

create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- 修改时间和修改人
-- ------------------------------------------------------------
alter table public.shifts add column if not exists updated_at timestamptz not null default now();
alter table public.shifts add column if not exists updated_by uuid;

create or replace function public.shifts_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists shifts_touch_trg on public.shifts;
create trigger shifts_touch_trg before insert or update on public.shifts
  for each row execute function public.shifts_touch();

-- ------------------------------------------------------------
-- 同一个员工的班次不能重叠
-- ------------------------------------------------------------

-- 先检查现有数据
do $$
declare n int;
begin
  select count(*) into n
  from public.shifts a
  join public.shifts b
    on a.member_id = b.member_id and a.id < b.id
   and (a.day - date '2000-01-01') * 1440 + a.start_min < (b.day - date '2000-01-01') * 1440 + b.end_min
   and (b.day - date '2000-01-01') * 1440 + b.start_min < (a.day - date '2000-01-01') * 1440 + a.end_min;
  if n > 0 then
    raise exception '现有数据里有 % 对重叠的班次，请先处理后再运行本迁移（查询见 supabase/checks/overlapping_shifts.sql）', n;
  end if;
end $$;

-- 把"日期 + 分钟"合成一条连续的时间轴，这样跨午夜的班次也能和第二天凌晨的班次正确比较
alter table public.shifts add column if not exists span int8range
  generated always as (
    int8range(
      ((day - date '2000-01-01') * 1440 + start_min)::int8,
      ((day - date '2000-01-01') * 1440 + end_min)::int8
    )
  ) stored;

alter table public.shifts drop constraint if exists shifts_no_overlap;
alter table public.shifts add constraint shifts_no_overlap
  exclude using gist (member_id with =, span with &&);

notify pgrst, 'reload schema';
