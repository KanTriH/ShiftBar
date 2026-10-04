-- 危险：删除本项目的全部表、函数和数据（不会删除用户账号）。
-- 仅在需要从头重新执行 0001_init.sql 和 0002_locations_tasks_settings.sql 时使用。

drop table if exists public.daily_tasks   cascade;
drop table if exists public.publications  cascade;
drop table if exists public.shifts        cascade;
drop table if exists public.availability  cascade;
drop table if exists public.members       cascade;
drop table if exists public.positions     cascade;
drop table if exists public.locations     cascade;
drop table if exists public.shops         cascade;

drop function if exists public.is_owner(uuid);
drop function if exists public.is_member(uuid);
drop function if exists public.can_read_shift(uuid, uuid, date);
drop function if exists public.get_shop_public(text);
drop function if exists public.get_guest_availability(text, text, date);
drop function if exists public.submit_availability(text, text, date, jsonb);
drop function if exists public.claim_member(text, text);
drop function if exists public.week_start_of(uuid, date);
drop function if exists public.can_read_task(uuid, date);
drop function if exists public.shops_create_default_location();
drop function if exists public.shops_default_location();
drop function if exists public.shifts_default_location();
drop function if exists public.shops_reset_publications();
