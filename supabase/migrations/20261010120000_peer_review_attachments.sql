-- Reviewer uploads remain private until staff approves them for the author.
alter table public.review_assignments
  add column if not exists review_file_path text,
  add column if not exists review_file_name text,
  add column if not exists edits_sent_file_path text,
  add column if not exists edits_sent_file_name text;

-- Earlier initial-review approvals were recorded as final acceptance, which
-- prevented subsequent peer feedback and author revisions. Reopen only papers
-- still in the initial/editorial stages with an approved accept recommendation.
update public.manuscript_submissions as m
set decision = 'pending', status = 'editorial review'
where m.decision = 'accepted'
  and m.status in ('initial review', 'editorial review')
  and m.deleted_at is null
  and exists (
    select 1 from public.editor_recommendations as r
    where r.submission_id = m.id and r.action = 'accept' and r.status = 'approved'
  );
