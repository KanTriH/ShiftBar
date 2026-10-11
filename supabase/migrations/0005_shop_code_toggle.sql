-- Shift Scheduler 2.0 - 迁移 0005：店长可以选择是否开启"店铺码绑定"
--
-- code_enabled = true （默认，和以前一样）：员工可以注册账号，用店铺码绑定店铺，查看自己的班表和工时。
-- code_enabled = false：员工只能通过报班链接报班（按名字），不能再新绑定店铺。
--                       已经绑定的员工不受影响，他们的班表和工时照常能看。
-- 报班链接本身（/s/店铺码）两种情况下都可以用。

alter table public.shops add column if not exists code_enabled boolean not null default true;

-- 访客 RPC：多返回一个 claim_enabled，前端据此决定要不要显示"注册账号"
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
    'claim_enabled', s.code_enabled,
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.sort, l.name)
      from locations l where l.shop_id = s.id), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'claimed', m.user_id is not null) order by m.name)
      from members m where m.shop_id = s.id), '[]'::jsonb)
  );
end $$;

-- 认领：已经绑定的员工直接返回自己；新的绑定要求店长开启了店铺码
create or replace function public.claim_member(p_code text, p_name text) returns jsonb
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

  if not s.code_enabled then raise exception 'claim_disabled'; end if;

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
