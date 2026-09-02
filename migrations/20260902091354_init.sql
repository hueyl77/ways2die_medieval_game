-- A Million Ways to Die in Medieval — core schema.
-- Game tables are server-only: RLS enabled with no client policies; the edge
-- function reads and writes them with the project admin key.

CREATE TABLE public.games (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  host_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'lobby',      -- lobby | playing | finished
  phase         text NOT NULL DEFAULT 'lobby',
  round         int  NOT NULL DEFAULT 0,
  version       int  NOT NULL DEFAULT 1,
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot      jsonb,                              -- full engine state once playing
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX games_code_idx ON public.games(code);
CREATE INDEX games_status_idx ON public.games(status);

CREATE TABLE public.game_members (
  game_id     uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_index  int  NOT NULL,
  name        text NOT NULL,
  crest       text NOT NULL,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, user_id)
);
CREATE INDEX game_members_user_idx ON public.game_members(user_id);

CREATE TABLE public.rounds (
  game_id     uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round       int  NOT NULL,
  log         jsonb NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, round)
);

CREATE TABLE public.game_events (
  id          bigserial PRIMARY KEY,
  game_id     uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id     uuid,
  kind        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_events_game_idx ON public.game_events(game_id, id);

ALTER TABLE public.games        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events  ENABLE ROW LEVEL SECURITY;
-- no policies: anon/authenticated cannot read game data through PostgREST
REVOKE ALL ON public.games, public.game_members, public.rounds, public.game_events FROM anon, authenticated;

CREATE TRIGGER games_updated_at BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- Membership helper for realtime RLS (SECURITY DEFINER: game_members has no client policies)
CREATE OR REPLACE FUNCTION public.is_game_member(gid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_members
    WHERE game_id = gid AND user_id = (SELECT auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_game_member(uuid) TO authenticated;

-- Realtime: game state bumps and gossip chat
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('game:%', 'Game state changed (version bump)', true),
       ('chat:%', 'Gossip chat for a game', true)
ON CONFLICT (pattern) DO UPDATE SET description = EXCLUDED.description, enabled = EXCLUDED.enabled;

CREATE OR REPLACE FUNCTION public.notify_game_changed()
RETURNS trigger AS $$
BEGIN
  PERFORM realtime.publish(
    'game:' || NEW.id::text,
    'state_changed',
    jsonb_build_object('id', NEW.id, 'version', NEW.version, 'phase', NEW.phase, 'round', NEW.round, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER games_notify_changed AFTER UPDATE ON public.games
  FOR EACH ROW WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION public.notify_game_changed();

ALTER TABLE realtime.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_subscribe_game_channels ON realtime.channels
  FOR SELECT TO authenticated
  USING (
    (pattern = 'game:%' OR pattern = 'chat:%')
    AND public.is_game_member(NULLIF(split_part(realtime.channel_name(), ':', 2), '')::uuid)
  );

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_publish_chat ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    channel_name LIKE 'chat:%'
    AND public.is_game_member(NULLIF(split_part(channel_name, ':', 2), '')::uuid)
  );
