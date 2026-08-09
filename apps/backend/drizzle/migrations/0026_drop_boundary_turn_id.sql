-- =============================================================================
-- 0026: Drop chat_shares.boundary_turn_id.
-- The column was never consumed by the codebase: continue-chat rebuilds purely
-- from the snapshot (conversationTurns.branched_from_turn_id is always NULL on
-- continued chats), and the public read only carried the value through. See
-- share.service.ts.
-- =============================================================================
ALTER TABLE "chat_shares" DROP COLUMN IF EXISTS "boundary_turn_id";
