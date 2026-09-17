-- Live nodes get duration_weeks (templates already have it since 0012).
-- Null is treated as 1 by segmentNodeTimeline after resegment.

alter table public.nodes
  add column if not exists duration_weeks int;
