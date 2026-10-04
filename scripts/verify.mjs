import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = ['index.html', 'fitmatch.js', 'styles.css', 'fitgoin-ai.js', 'fitgoin-ai-core.mjs', 'fitgoin-ai-paid.mjs', 'fitgoin-ai-media.mjs', 'fitgoin-ai.css', 'cookie-consent.js', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'site.webmanifest', 'privacy.html', 'terms.html', 'legal.html', 'cookies.html', 'support.html'];
const migrations = new Map([
  ['20260927144002_fitgoin_stage1_foundation.sql', '0033aacf37052dc6ce150b0dca9669e9'],
  ['20260929062004_add_fgi_messages_sender_index.sql', '38fe7f22d0fac6cf8e667fc80842f7bd'],
  ['20260929062127_track_fgi_thread_activity.sql', '35d115737d8f41ec3d90d1a8f63da45b'],
  ['20260929080940_tighten_fgi_storage_policies.sql', 'df85b11aa2289dee956104069d642cb6'],
  ['20260929081241_harden_fgi_data_integrity.sql', 'd994e020f1d3540df5fb2832ba46a7fd'],
  ['20260929102250_support_phone_auth_profiles.sql', '4920ed23d70898d91cd59a9f6376180a'],
  ['20260929104742_add_chat_presence.sql', '52f2f847d0bec378971c6b52c2e72814'],
  ['20260929105457_add_chat_media.sql', '1c595a2fe6fd006421cd922862526a08'],
  ['20260929110708_add_audio_call_signaling.sql', 'dfb51292f6203d9d5ecaade58730b14f'],
  ['20260929111114_harden_call_stale_recovery.sql', 'fa31d04e2f2ee21c909da11cfcc35589'],
  ['20260929111231_index_call_foreign_keys.sql', 'e965606b67ec9e37992cdd01fd4ae857'],
  ['20260930210545_add_coach_match_availability.sql', '53c6d78aca7aa1a3ed5894c43ed0a643'],
  ['20261002055725_grant_coach_availability_save.sql', 'cecde5c9ca8ecdfd1f3880da963f8274'],
  ['20261003091539_create_fitgoin_ai.sql', '85260269487fce5693b180ffae87093a'],
  ['20261003093815_index_ai_messages_and_merge_share_read_policy.sql', 'ea07021693a06e116657c66f48bf3e4c'],
]);
for (const file of files) await access(new URL(`../${file}`, import.meta.url));
for (const file of migrations.keys()) await access(new URL(`../supabase/migrations/${file}`, import.meta.url));

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../fitmatch.js', import.meta.url), 'utf8');

if (!html.includes('<title>FitGoIn')) throw new Error('FitGoIn title is missing');
if (!html.includes('fitmatch.js')) throw new Error('fitmatch.js is not linked');
if (!html.includes('styles.css')) throw new Error('styles.css is not linked');
if ((html.match(/<script\b/gi)||[]).length !== (html.match(/<\/script\s*>/gi)||[]).length) throw new Error('Unclosed script tag prevents the page from rendering');
if (!js.includes('supabase')) throw new Error('Expected Supabase integration was not found');
if ((html.match(/minlength="6" maxlength="128"/g) || []).length !== 3) throw new Error('Password minimum is not enforced in signup/reset forms');
if (!js.includes('function assertStrongPassword')) throw new Error('Strong password validation is missing');
if (!js.includes('b.updated_at||b.created_at')) throw new Error('Inbox is not ordered by latest thread activity');
if (js.includes('FITGOIN_SETUP_SQL_BEGIN')) throw new Error('Database setup SQL must not be embedded in frontend JavaScript');
if (html.includes('max="100000"')) throw new Error('Frontend price limit must not exceed €100');
if ((html.match(/max="100"/g) || []).length < 2) throw new Error('€100 price/budget limits are missing');
if (!html.includes('rel="canonical"') || !html.includes('property="og:title"')) throw new Error('SEO canonical/OpenGraph metadata is missing');
if (!html.includes('privacy.html') || !html.includes('terms.html') || !html.includes('legal.html') || !html.includes('support.html')) throw new Error('Legal/support footer links are missing');
if (!js.includes("searchParams.set('trainer',id)")) throw new Error('Shareable trainer profile routing is missing');
if (js.includes("allRows('sports')") || js.includes("allRows('coaches')")) throw new Error('Legacy catalogue reads must not return');
if (!html.includes('name="website"')) throw new Error('Signup honeypot is missing');
if (!js.includes("rateGate('signup'")) throw new Error('Signup cooldown is missing');
if (js.includes("c.image_url || c.avatar_url")) throw new Error('External coach image fallback must not return');
if (!html.includes('id="phoneDialog"') || !html.includes('id="phoneSignupOpen"') || !html.includes('id="phoneLoginOpen"')) throw new Error('Phone auth UI is missing');
if (!js.includes('db.auth.signInWithOtp({phone,options})')) throw new Error('Phone OTP request flow is missing');
if (!js.includes("db.auth.verifyOtp({phone:pendingPhone,token,type:'sms'})")) throw new Error('Phone OTP verification flow is missing');
if (!js.includes("shouldCreateUser:phoneMode==='signup'")) throw new Error('Phone login/signup account creation guard is missing');
if (!js.includes('function normalizePhone')) throw new Error('Phone E.164 validation is missing');
if (!html.includes('cookie-consent.js') || !html.includes('cookies.html') || !html.includes('data-cookie-settings')) throw new Error('Cookie consent entry points are missing');
const cookieJs = await readFile(new URL('../cookie-consent.js', import.meta.url), 'utf8');
if (!cookieJs.includes('fitgoin_cookie_consent_v1')) throw new Error('Cookie consent persistence is missing');
if (!cookieJs.includes("analytics:value==='optional'")) throw new Error('Optional analytics consent gate is missing');
if (!html.includes('id="chatPresence"')) throw new Error('Chat presence status slot is missing');
if (!js.includes("db.from('fgi_presence').upsert")) throw new Error('Presence heartbeat is missing');
if (!js.includes("PRESENCE_ONLINE_MS = 75000")) throw new Error('Presence stale-session protection is missing');
if (!js.includes("loadPresence(true)")) throw new Error('Active chat presence refresh is missing');
if (!html.includes('id="chatFile"') || !html.includes('id="chatAttachmentPreview"')) throw new Error('Chat attachment controls are missing');
if (!js.includes("chatBucket: 'fgi-chat'")) throw new Error('Private chat bucket config is missing');
if (!js.includes("createSignedUrl(m.media_path,3600)")) throw new Error('Private chat media signed URLs are missing');
if (!js.includes("uploadChatAttachment(file,actor,thread,pendingChatDurationMs)")) throw new Error('Chat media upload flow is missing');
if (!js.includes("kind:media?.kind || 'text'")) throw new Error('Message media metadata is missing');
if (!html.includes('id="voiceStart"') || !html.includes('id="voiceStop"') || !html.includes('id="voiceTimer"')) throw new Error('Voice recording controls are missing');
if (!js.includes('navigator.mediaDevices?.getUserMedia')) throw new Error('Microphone capture is missing');
if (!js.includes('new MediaRecorder(stream,options)')) throw new Error('MediaRecorder voice flow is missing');
if (!js.includes("kind:'audio'")) throw new Error('Audio message preparation is missing');
if (!js.includes("kind:'audio'") || !js.includes('duration_ms:durationMs?')) throw new Error('Voice duration metadata is missing');
if (!html.includes('id="audioCall"') || !html.includes('id="callDialog"') || !html.includes('id="incomingCallDialog"')) throw new Error('Audio call UI is missing');
if (!js.includes('new RTCPeerConnection({iceServers:CALL_ICE_SERVERS})')) throw new Error('WebRTC peer connection is missing');
if (!js.includes("db.from('fgi_calls').insert")) throw new Error('Call creation signaling is missing');
if (!js.includes("db.from('fgi_call_signals').insert")) throw new Error('Call signal exchange is missing');
if (!js.includes("getUserMedia({audio:{echoCancellation:true")) throw new Error('Audio call microphone capture is missing');
if (!js.includes("update({status:'accepted'})") || !js.includes("update({status:'ended'})")) throw new Error('Call lifecycle updates are missing');
if (!html.includes('id="videoCall"') || !html.includes('id="callRemoteVideo"') || !html.includes('id="callLocalVideo"')) throw new Error('Video call UI is missing');
if (!html.includes('id="toggleCamera"') || !html.includes('id="switchCamera"')) throw new Error('Video camera controls are missing');
if (!js.includes('async function startVideoCall()')) throw new Error('Video call start flow is missing');
if (!js.includes("kind:'video'")) throw new Error('Video call signaling kind is missing');
if (!js.includes("video:{facingMode:{ideal:callFacingMode}")) throw new Error('Video camera capture is missing');
if (!js.includes('async function switchCallCamera()')) throw new Error('Camera switching is missing');
if (!js.includes("sender.replaceTrack(nextTrack)")) throw new Error('Camera track replacement is missing');
if (!js.includes("call.kind==='video'")) throw new Error('Incoming video call handling is missing');
if (!html.includes('id="matchStepText"') || !html.includes('data-match-step="6"')) throw new Error('Seven-step MATCH wizard is missing');
if (!html.includes('id="matchAvailability"') || !html.includes('id="coachAvailability"')) throw new Error('MATCH availability controls are missing');
if (!js.includes("payload.availability=f.getAll('availability')")) throw new Error('Coach availability persistence is missing');
if (!js.includes("[Boolean(p.availability),5")) throw new Error('Availability weight is missing from MATCH');
if (!js.includes('.slice(0,3)')) throw new Error('MATCH top-three result limit is missing');
if (!html.includes('id="clientSignupOpen"') || !html.includes('id="clientForm"') || !html.includes('id="clientCoachStart"') || !html.includes('id="becomeCoach"')) throw new Error('Client registration/account UI is missing');
if (!js.includes("db.from('profiles').update({full_name,phone:phone || null})")) throw new Error('Client profile save flow is missing');
if (!js.includes('bindUI();bindAuth();bindClient();bindCoach();bindMedia();bindChat();')) throw new Error('Client account bindings are missing');
if (js.includes("update({role:") || js.includes("update({ role:")) throw new Error('Frontend must not update profile roles directly');

const openSelects = (html.match(/<select\b/gi) || []).length;
const closeSelects = (html.match(/<\/select\s*>/gi) || []).length;
if (openSelects !== closeSelects) throw new Error(`Malformed HTML: ${openSelects} <select> openings but ${closeSelects} closings`);
for (const match of html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select\s*>/gi)) {
  const inner = match[1];
  const openOptions = (inner.match(/<option\b/gi) || []).length;
  const closeOptions = (inner.match(/<\/option\s*>/gi) || []).length;
  if (openOptions !== closeOptions) throw new Error('Malformed HTML: unmatched <option> tag inside <select>');
  const residual = inner.replace(/<option\b[^>]*>[\s\S]*?<\/option\s*>/gi, '').trim();
  if (residual) throw new Error(`Malformed HTML: unexpected content inside <select>: ${JSON.stringify(residual.slice(0, 80))}`);
}

for (const [file, expected] of migrations) {
  const body = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url));
  const actual = createHash('md5').update(body).digest('hex');
  if (actual !== expected) throw new Error(`Migration ${file} differs from production history: ${actual}`);
}

console.log('FitGoIn source verification passed.');
