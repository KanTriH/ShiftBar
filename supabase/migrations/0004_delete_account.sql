-- Shift Scheduler 2.0 - 迁移 0004：用户自己注销账号
-- 浏览器端没有权限直接删除 auth 用户（那需要 service_role 密钥，绝不能放到前端），
-- 所以用一个 security definer 函数：它只能删除"当前登录的自己"。
--
-- 注销会删除：
--   * 店长：自己名下的所有店铺，以及店铺下的门店、岗位、员工、报班、班次、当日任务、发布记录（外键级联）
--   * 员工：自己在各店铺里的员工记录，以及这些记录下的报班和班次（外键级联）
--   * 登录账号本身
-- 这些操作无法恢复。

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  -- 员工身份：先删员工记录（报班、班次通过外键 on delete cascade 一起删除）
  delete from public.members where user_id = uid;

  -- 删除登录用户；shops.owner_id 外键是 on delete cascade，店长名下的店铺及全部数据随之删除
  delete from auth.users where id = uid;
end $$;

-- 只有已登录用户可以调用，访客和匿名不行
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
