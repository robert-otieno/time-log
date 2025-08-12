-- Convert existing date values to ISO 8601 (YYYY-MM-DD)
UPDATE daily_tasks SET date = strftime('%Y-%m-%d', date) WHERE date LIKE '%/%/%';
UPDATE weekly_priorities SET week_start = strftime('%Y-%m-%d', week_start) WHERE week_start LIKE '%/%/%';
UPDATE rhythm_completions SET date = strftime('%Y-%m-%d', date) WHERE date LIKE '%/%/%';