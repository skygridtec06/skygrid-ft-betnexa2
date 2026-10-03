ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_admin_added BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.games AS game
SET is_admin_added = TRUE
WHERE game.game_id ~ '^g[0-9]+$'
   OR EXISTS (
     SELECT 1
     FROM public.admin_logs AS admin_log
     WHERE admin_log.action = 'create_game'
       AND admin_log.target_type = 'game'
       AND admin_log.target_id::text = game.id::text
   );

CREATE INDEX IF NOT EXISTS idx_games_status_admin_added_id
  ON public.games (status, is_admin_added DESC, id ASC);
