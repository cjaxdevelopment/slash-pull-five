ALTER TABLE profs_recipes ADD COLUMN reagents jsonb;
ALTER TABLE profs_recipes ADD COLUMN modified_reagents boolean NOT NULL DEFAULT false;
