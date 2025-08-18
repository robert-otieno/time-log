CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  deadline TEXT
);

ALTER TABLE rhythm_tasks ADD COLUMN goal_id INTEGER REFERENCES goals(id);

ALTER TABLE rhythm_completions RENAME TO habit_completions;
ALTER TABLE habit_completions RENAME COLUMN task_id TO habit_id;