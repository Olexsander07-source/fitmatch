import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validBooking,validSupport,bookingError,stage5Labels} from '../fitgoin-stage5.mjs';

test('client appointment form rejects malformed and out-of-range inputs',()=>{
 assert.equal(validBooking('2026-11-20','18:00','60'),true);
 assert.equal(validBooking('2026-11-20','23:59','240'),true);
 assert.equal(validBooking('2026-11-20','24:00','30'),false);
 assert.equal(validBooking('2026-11-20','18:00','10'),false);
 assert.equal(validBooking('whatever','18:00','60'),false);
 assert.equal(validBooking('2026-02-31','18:00','60'),false);
 assert.equal(validBooking('2028-02-29','18:00','60'),true);
 assert.equal(validBooking('2027-02-29','18:00','60'),false);
 assert.equal(validBooking('2026-11-20','18:00','60.5'),false);
});
test('occupied booking slots produce actionable localized errors',()=>{
 assert.match(bookingError({message:'coach_time_unavailable'},'ru'),/занято/);
 assert.match(bookingError({message:'coach_time_unavailable'},'fr'),/réservé/);
 assert.match(bookingError({message:'coach_time_unavailable'},'en'),/booked/);
 assert.equal(bookingError({message:'invalid_booking_time'},'ru'),'invalid_booking_time');
});

test('support reports have minimum and maximum lengths',()=>{
 assert(validSupport('Trainer profile bug','Messages are failing to load.'));
 assert(!validSupport('Bug','Not working'));
 assert(!validSupport('A'.repeat(141),'This is a sample report'));
 assert(!validSupport('Sample report','x'.repeat(6001)));
});
test('Stage 5 translates booking fields, statuses and notification bodies',()=>{
 for(const lang of ['ru','en','fr']){
   const label=stage5Labels(lang);
   for(const key of ['date','time','duration','note','category','problem','question','suggestion','invalidDate','readAll']){
     assert.ok(label[key]?.length,lang+': '+key);
   }
   for(const status of ['pending','confirmed','declined','cancelled','completed','open','in_progress','resolved']){
     assert.ok(label.statuses[status]?.length,lang+': status '+status);
   }
   for(const kind of ['booking_requested','booking_received','booking_confirmed','booking_declined','booking_cancelled','booking_completed','support_new','support_reply']){
     assert.equal(label.notices[kind].length,2,lang+': notification '+kind);
     assert.ok(label.notices[kind][0]&&label.notices[kind][1]);
   }
 }
 assert.match(stage5Labels('fr').notices.booking_received[0],/Demande/);
 assert.match(stage5Labels('ru').invalidDate,/дату/);
});

test('existing main app integrates stage5 without replacing AI and chat',()=>{
 const main=readFileSync(new URL('../fitmatch.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('build.mjs',import.meta.url),'utf8');
 assert(main.includes("import {mountStage5} from './fitgoin-stage5.mjs"));
 assert(main.includes('stage5?.onThread()'));
 assert(main.includes('stage5?.sessionChanged()'));
 assert(main.includes('stage5?.onPage(id)'));
 assert(main.includes("db.functions.invoke('fitgoin-chat-translate'"));
 assert(build.includes("'fitgoin-stage5.mjs'"));
});
test('SQL prevents booking self-approval, cross-user reads, and support privilege forgery',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261108093000_stage5_booking_support_notifications.sql',import.meta.url),'utf8');
 assert(sql.includes("REVOKE INSERT,UPDATE ON public.bookings FROM authenticated,anon"));
 assert(sql.includes("actor=b.coach_id AND b.status='pending'"));
 assert(sql.includes('threadrow.client_id'));
 assert(sql.includes("u.raw_app_meta_data->>'fitgoin_role'='owner'"));
 assert(sql.includes("reporter_id=(SELECT auth.uid())"));
 assert(sql.includes('fgi_notifications_view'));
 assert(sql.includes('support_email_outbox'));
 assert(sql.includes('fgi_booking_create'));
 assert(sql.includes('fgi_booking_decide'));
});
