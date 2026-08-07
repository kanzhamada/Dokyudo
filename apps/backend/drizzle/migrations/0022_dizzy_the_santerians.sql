-- NOTE: Postgres truncates identifier names to 63 chars, so the actual
-- constraint name ends with "_id_" (the trailing "fk" was cut off).
ALTER TABLE "conversation_turns" DROP CONSTRAINT IF EXISTS "conversation_turns_branched_from_turn_id_conversation_turns_id_";
