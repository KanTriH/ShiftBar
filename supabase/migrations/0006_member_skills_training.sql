-- Shift Scheduler 2.0 - 迁移 0006：员工会什么岗位（技能矩阵）+ 培训班次
--
-- member_positions：店长为每个员工勾选"会的岗位"。员工只能读到自己的那几行。
-- shifts.training：这个班次是培训。把员工排进他"不会"的岗位时，前端会自动打上这个标记；
--                  存下来是为了让已经排过、已经导出过的班表不会因为之后给员工补勾了技能而改变。

create table if not exists public.member_positions (
  member_id    uuid not null references public.members(id)   on delete cascade,
  position_id  uuid not null references public.positions(id) on delete cascade,
  shop_id      uuid not null references public.shops(id)     on delete cascade,
  primary key (member_id, position_id)
);
create index if not exists member_positions_shop_idx on public.member_positions (shop_id);

alter table public.member_positions enable row level security;

drop policy if exists member_positions_owner_all on public.member_positions;
drop policy if exists member_positions_self_read on public.member_positions;

-- 店长可读写；写入时要求员工和岗位都属于这家店，防止拿别家店的岗位 id 乱写
create policy member_positions_owner_all on public.member_positions for all
  using (public.is_owner(shop_id))
  with check (
    public.is_owner(shop_id)
    and exists (select 1 from public.members   m where m.id = member_id   and m.shop_id = member_positions.shop_id)
    and exists (select 1 from public.positions p where p.id = position_id and p.shop_id = member_positions.shop_id)
  );

-- 员工只读自己的
create policy member_positions_self_read on public.member_positions for select
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = auth.uid()));

alter table public.shifts add column if not exists training boolean not null default false;
