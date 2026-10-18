ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name VARCHAR(128),
    ADD COLUMN IF NOT EXISTS surname VARCHAR(128);

UPDATE users
SET name = split_part(trim(full_name), ' ', 1),
    surname = trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1));

ALTER TABLE users
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN surname SET NOT NULL;