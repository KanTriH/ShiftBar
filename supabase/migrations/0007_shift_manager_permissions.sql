-- Shift Scheduler 2.0 - 迁移 0007：Shift manager（店长可以给已注册员工分配管理权限）
--
-- 店长（shops.owner_id）仍然只有一个，并且拥有全部权限。
-- 员工记录上多两列：
--   role         'staff'（默认）或 'shift_manager'
--   permissions  只对 shift_manager 有意义，jsonb，键是下面 5 个开关，值是 true / false：
--     schedule          排班：创建、移动、删除班次，写当日任务
--     publish           发布 / 撤回班表
--     view_availability 查看全体员工的报班
--     manage_staff      添加员工、改试工 / 正式、勾选岗位技能
--     export_pdf        导出班表 PDF
-- 永远只有店长能做的事：店铺设置（营业时间、门店、岗位标签、店铺码）、角色和权限本身、注销账号。
--
-- 所有权限判断都在数据库里（行级安全），前端只是据此隐藏按钮。

alter table public.members add column if not exists role text not null default 'staff'
  check (role in ('staff', 'shift_manager'));
alter table public.members add column if not exists permissions jsonb not null default '{}'::jsonb;

-- ============================================================
-- 辅助函数（security definer，避免 RLS 策略互相递归）
-- ============================================================

-- 当前登录用户是不是这家店的 shift manager
create or replace function public.is_shift_manager(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where shop_id = p_shop and user_id = auth.uid() and role = 'shift_manager')
$$;

-- 当前登录用户在这家店是否有某项权限：店长永远有；shift manager 看开关
create or replace function public.can_manage(p_shop uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = p_shop and owner_id = auth.uid())
      or coalesce((
        select (m.permissions ->> p_perm)::boolean
        from members m
        where m.shop_id = p_shop and m.user_id = auth.uid() and m.role = 'shift_manager'
        limit 1), false)
$$;

grant execute on function public.is_shift_manager(uuid)     to authenticated;
grant execute on function public.can_manage(uuid, text)     to authenticated;

-- ============================================================
-- 防止越权：shift manager 不能给自己或别人改角色 / 权限 / 绑定的账号，也不能删除 shift manager
-- ============================================================

create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- 只有店长能删除 shift manager。例外：本人注销账号（delete_my_account），以及整家店被删除时的级联删除
    -- （此时 shops 那一行已经不存在了）
    if old.role = 'shift_manager'
       and exists (select 1 from shops where id = old.shop_id)
       and not exists (select 1 from shops where id = old.shop_id and owner_id = auth.uid())
       and old.user_id is distinct from auth.uid() then
      raise exception 'forbidden';
    end if;
    return old;
  end if;

  if not exists (select 1 from shops where id = new.shop_id and owner_id = auth.uid()) then
    -- 不是店长：角色和权限只能保持默认；已有记录的角色、权限、绑定账号不能被改
    if tg_op = 'INSERT' then
      -- 注册认领（claim_member / submit_availability）和店长之外的人手动添加都只能新建普通员工
      if new.role <> 'staff' or new.permissions <> '{}'::jsonb then raise exception 'forbidden'; end if;
    elsif tg_op = 'UPDATE' then
      if new.role is distinct from old.role
         or new.permissions is distinct from old.permissions
         or (new.user_id is distinct from old.user_id and auth.uid() is not null and old.user_id is not null and old.user_id <> auth.uid()) then
        raise exception 'forbidden';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists members_guard_trg on public.members;
create trigger members_guard_trg before insert or update or delete on public.members
  for each row execute function public.members_guard();

-- ============================================================
-- 行级安全：在"店长全权"的策略之外，给 shift manager 增加按开关放行的策略
-- （多条宽松策略之间是"或"的关系，店长的原有策略不变）
-- ============================================================

-- 员工记录：所有 shift manager 都能看到全店员工（排班需要）；增删改要 manage_staff
drop policy if exists members_sm_read   on public.members;
drop policy if exists members_sm_insert on public.members;
drop policy if exists members_sm_update on public.members;
drop policy if exists members_sm_delete on public.members;
create policy members_sm_read   on public.members for select using (public.is_shift_manager(shop_id));
create policy members_sm_insert on public.members for insert with check (public.can_manage(shop_id, 'manage_staff'));
create policy members_sm_update on public.members for update using (public.can_manage(shop_id, 'manage_staff')) with check (public.can_manage(shop_id, 'manage_staff'));
create policy members_sm_delete on public.members for delete using (public.can_manage(shop_id, 'manage_staff'));

-- 技能：shift manager 都能看（排班时用）；勾选要 manage_staff
drop policy if exists member_positions_sm_read  on public.member_positions;
drop policy if exists member_positions_sm_write on public.member_positions;
create policy member_positions_sm_read on public.member_positions for select using (public.is_shift_manager(shop_id));
create policy member_positions_sm_write on public.member_positions for all
  using (public.can_manage(shop_id, 'manage_staff'))
  with check (
    public.can_manage(shop_id, 'manage_staff')
    and exists (select 1 from public.members   m where m.id = member_id   and m.shop_id = member_positions.shop_id)
    and exists (select 1 from public.positions p where p.id = position_id and p.shop_id = member_positions.shop_id)
  );

-- 报班：排班或查看可用时间的人可读（写入仍然只走 submit_availability）
drop policy if exists availability_sm_read on public.availability;
create policy availability_sm_read on public.availability for select
  using (public.can_manage(shop_id, 'view_availability') or public.can_manage(shop_id, 'schedule'));

-- 班次：排班 / 发布 / 导出的人可读；增删改要 schedule
drop policy if exists shifts_sm_read   on public.shifts;
drop policy if exists shifts_sm_insert on public.shifts;
drop policy if exists shifts_sm_update on public.shifts;
drop policy if exists shifts_sm_delete on public.shifts;
create policy shifts_sm_read on public.shifts for select
  using (public.can_manage(shop_id, 'schedule') or public.can_manage(shop_id, 'publish') or public.can_manage(shop_id, 'export_pdf'));
create policy shifts_sm_insert on public.shifts for insert with check (public.can_manage(shop_id, 'schedule'));
create policy shifts_sm_update on public.shifts for update using (public.can_manage(shop_id, 'schedule')) with check (public.can_manage(shop_id, 'schedule'));
create policy shifts_sm_delete on public.shifts for delete using (public.can_manage(shop_id, 'schedule'));

-- 当日任务：排班 / 发布 / 导出的人可读（导出的 PDF 里有）；写入要 schedule
drop policy if exists daily_tasks_sm_read  on public.daily_tasks;
drop policy if exists daily_tasks_sm_write on public.daily_tasks;
create policy daily_tasks_sm_read on public.daily_tasks for select
  using (public.can_manage(shop_id, 'schedule') or public.can_manage(shop_id, 'publish') or public.can_manage(shop_id, 'export_pdf'));
create policy daily_tasks_sm_write on public.daily_tasks for all
  using (public.can_manage(shop_id, 'schedule')) with check (public.can_manage(shop_id, 'schedule'));

-- 发布记录：读取已有"成员可读"策略；发布 / 撤回要 publish
drop policy if exists publications_sm_write on public.publications;
create policy publications_sm_write on public.publications for all
  using (public.can_manage(shop_id, 'publish')) with check (public.can_manage(shop_id, 'publish'));

notify pgrst, 'reload schema';
