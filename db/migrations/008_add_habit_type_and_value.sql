ALTER TABLE rhythm_tasks ADD COLUMN type text NOT NULL DEFAULT 'checkbox';
ALTER TABLE rhythm_tasks ADD COLUMN target integer NOT NULL DEFAULT 1;
ALTER TABLE habit_completions ADD COLUMN value integer NOT NULL DEFAULT 0;