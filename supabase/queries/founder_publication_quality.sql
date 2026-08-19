-- Founder - Publication Quality
-- Aggregate Build 3.4A health and quality. Never selects journal text, titles, editorial output, source references or media.
with generation_health as (
  select
    count(*) filter (where state = 'succeeded')::integer as generations_succeeded,
    count(*) filter (where state = 'failed')::integer as generations_failed,
    coalesce(sum(input_tokens) filter (where state = 'succeeded'), 0)::bigint as input_tokens,
    coalesce(sum(output_tokens) filter (where state = 'succeeded'), 0)::bigint as output_tokens,
    coalesce(sum(estimated_cost_usd) filter (where state = 'succeeded'), 0)::numeric(12, 4) as estimated_cost_usd
  from public.generation_jobs
), chapter_health as (
  select
    count(*) filter (where mode = 'original')::integer as original_chapters,
    count(*) filter (where mode = 'ai')::integer as ai_chapters,
    count(*) filter (where state = 'ready')::integer as ready_chapters,
    count(*) filter (where state = 'stale')::integer as stale_chapters,
    count(*) filter (where state = 'failed')::integer as failed_chapters
  from public.publications
  where scope = 'monthly'
), quality as (
  select
    count(*)::integer as reviewed_generations,
    count(*) filter (where verdict = 'accurate')::integer as accurate_generations,
    count(*) filter (where verdict = 'invented-fact')::integer as invented_fact_reports,
    case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where verdict = 'accurate') / count(*), 1) end as accuracy_percent
  from public.publication_feedback
)
select
  chapter_health.*,
  generation_health.*,
  quality.*,
  (quality.reviewed_generations >= 10 and quality.accuracy_percent >= 80 and quality.invented_fact_reports = 0) as numeric_quality_gate_met
from chapter_health
cross join generation_health
cross join quality;
