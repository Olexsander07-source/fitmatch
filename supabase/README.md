# FitGoIn Supabase migrations

The production database is managed through versioned Supabase migrations, not SQL embedded in frontend files.

## Production history
- `20260927144002_fitgoin_stage1_foundation` — exact production SQL mirrored in this repository.
- `20260929062004_add_fgi_messages_sender_index` — adds the sender foreign-key index.
- `20260929062127_track_fgi_thread_activity` — tracks and indexes latest thread activity.

The historical foundation file is byte-for-byte matched to the SQL recorded by Supabase. Do not rerun removed setup blocks from old copies of `fitmatch.js`.

## Rule for future changes
1. Inspect live schema and migration history first.
2. Apply reviewed DDL through the Supabase migration workflow.
3. Store the exact production migration SQL in this directory.
4. Re-run security and performance advisors after DDL changes.
5. Keep service-role and database secrets out of the repository.
- `20260929104742_add_chat_presence` — tracks chat participant online/last-seen state with participant-only RLS.
- `20260929105457_add_chat_media` — adds private participant-only chat attachments and message media metadata.

- `20260929110708_add_audio_call_signaling` — adds participant-only WebRTC call records and SDP/ICE signaling.
- `20260929111114_harden_call_stale_recovery` — expires abandoned ringing/accepted calls so they cannot block future calls.
