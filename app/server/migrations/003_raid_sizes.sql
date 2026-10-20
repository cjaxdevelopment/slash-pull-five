-- Round old unsupported sizes up so all existing characters and groups still fit.
UPDATE plans SET capacity = CASE WHEN capacity <= 10 THEN 10 WHEN capacity <= 20 THEN 20 ELSE 40 END,
  revision = revision + 1, updated_at = now()
WHERE capacity NOT IN (10,20,40);
ALTER TABLE plans ADD CONSTRAINT supported_raid_size CHECK (capacity IN (10,20,40));
