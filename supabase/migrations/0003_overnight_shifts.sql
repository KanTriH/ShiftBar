-- Shift Scheduler 2.0 - 迁移 0003：支持跨午夜排班
-- 班次仍然属于"开始的那一天"，但分钟数可以超过 1440（25:00 = 次日 01:00），最多到 2880（次日 24:00）。
-- 例如：周六 17:45 开始、次日 01:00 结束，存为 start_min = 1065, end_min = 1500。
-- 在已经执行过 0001 / 0002 的数据库上运行即可，不会改动已有数据。

-- 先删掉 0001 里限制在一天以内的检查（这些检查的名字是自动生成的，所以按内容查找）
do $$
declare r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where conrelid in ('public.shifts'::regclass, 'public.availability'::regclass)
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%1440%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- 新的范围：开始时间 0 ~ 次日 24:00 之前，结束时间晚于开始，且一个班次最长 24 小时
alter table public.shifts
  add constraint shifts_start_min_range check (start_min >= 0 and start_min < 2880),
  add constraint shifts_end_min_range   check (end_min > 0 and end_min <= 2880),
  add constraint shifts_max_24h         check (end_min - start_min <= 1440);

alter table public.availability
  add constraint availability_start_min_range check (start_min >= 0 and start_min < 2880),
  add constraint availability_end_min_range   check (end_min > 0 and end_min <= 2880),
  add constraint availability_max_24h         check (end_min - start_min <= 1440);
