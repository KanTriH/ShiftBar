-- 列出现有数据里"同一个员工、时间重叠"的班次对。只读，不会修改任何数据。
-- 运行迁移 0008 之前先运行它；结果为空说明可以放心运行 0008。
select
  m.name as "员工",
  a.day as "日期A",
  (a.start_min / 60) || ':' || lpad((a.start_min % 60)::text, 2, '0') as "开始A",
  (a.end_min / 60) || ':' || lpad((a.end_min % 60)::text, 2, '0') as "结束A",
  b.day as "日期B",
  (b.start_min / 60) || ':' || lpad((b.start_min % 60)::text, 2, '0') as "开始B",
  (b.end_min / 60) || ':' || lpad((b.end_min % 60)::text, 2, '0') as "结束B",
  a.id as "班次A_id",
  b.id as "班次B_id"
from public.shifts a
join public.shifts b
  on a.member_id = b.member_id and a.id < b.id
 and (a.day - date '2000-01-01') * 1440 + a.start_min < (b.day - date '2000-01-01') * 1440 + b.end_min
 and (b.day - date '2000-01-01') * 1440 + b.start_min < (a.day - date '2000-01-01') * 1440 + a.end_min
join public.members m on m.id = a.member_id
order by m.name, a.day, a.start_min;
