ALTER TABLE profs_characters ADD COLUMN class_id integer CHECK (class_id > 0);
