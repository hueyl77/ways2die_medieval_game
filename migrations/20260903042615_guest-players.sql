-- Guests play without an auth account. The game function vouches for them with a signed guest token and
-- writes their rows through the admin client, so hosts and members may carry ids that are not auth users.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid IN ('public.games'::regclass, 'public.game_members'::regclass)
      AND confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- Guests reach realtime as anonymous sockets. Game ids are unguessable UUIDs, state_changed carries only
-- id/version/phase, and gossip is public within the room, so anonymous sockets may follow both channels.
DROP POLICY IF EXISTS guests_subscribe_game_channels ON realtime.channels;
CREATE POLICY guests_subscribe_game_channels ON realtime.channels
  FOR SELECT TO anon
  USING (pattern = 'game:%' OR pattern = 'chat:%');

DROP POLICY IF EXISTS guests_publish_chat ON realtime.messages;
CREATE POLICY guests_publish_chat ON realtime.messages
  FOR INSERT TO anon
  WITH CHECK (channel_name LIKE 'chat:%');
