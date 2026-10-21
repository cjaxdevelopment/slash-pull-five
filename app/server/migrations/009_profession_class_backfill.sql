-- Refresh existing rosters once to populate classes without replacing recipe snapshots.
INSERT INTO profs_jobs(id,scope_id,kind,priority)
SELECT gen_random_uuid(),s.id,'roster',10
FROM profs_scopes s
WHERE EXISTS (
  SELECT 1 FROM profs_characters c
  WHERE c.scope_id=s.id AND c.in_roster AND c.class_id IS NULL
)
ON CONFLICT DO NOTHING;
