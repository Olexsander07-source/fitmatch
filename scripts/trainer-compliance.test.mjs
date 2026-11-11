import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRAINER_DOCUMENT_BUCKET,TRAINER_MIME,validateTrainerEvidence,validateTrainerFileSignature} from '../fitgoin-trainer-verification.mjs';

const sql=readFileSync(new URL('../supabase/migrations/20261111120000_trainer_documents_and_launch_gate.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const frontend=readFileSync(new URL('../fitmatch.js',import.meta.url),'utf8');
const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
test('only genuine, bounded evidence formats pass initial validation',()=>{
 for(const [mime,extension] of Object.entries(TRAINER_MIME)){
  const fake={type:mime,size:1024};
  assert.equal(validateTrainerEvidence({country:'FR',format:'in_person',kind:'professional_card',file:fake,attested:true}),extension);
 }
 const valid={country:'UA',format:'online',kind:'qualification',file:{type:'application/pdf',size:1024},attested:true};
 for(const [field,value] of [['country','France'],['format','virtual'],['kind','unknown'],['attested',false],['file',{type:'text/html',size:1024}],['file',{type:'application/pdf',size:6291457}],['file',{type:'application/pdf',size:0}]]){
  assert.throws(()=>validateTrainerEvidence({...valid,[field]:value}),field+' should be rejected');
 }
});
test('evidence is private, review is owner-only and never auto-awards verified',()=>{
 assert.equal(TRAINER_DOCUMENT_BUCKET,'fgi-trainer-docs');
 assert.match(sql,/VALUES\('fgi-trainer-docs','fgi-trainer-docs',false,6291456/);
 assert.match(sql,/ALTER TABLE public\.fgi_trainer_documents ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/GRANT UPDATE\(status,review_note\) ON public\.fgi_trainer_documents TO authenticated/);
 assert.match(sql,/fgi_trainer_documents_owner_review/);
 assert.match(sql,/fgi_is_owner\(\)/);
 assert.match(sql,/statement_accepted_at/);
 assert.match(sql,/attested boolean NOT NULL CHECK\(attested=true\)/);
 assert.match(sql,/CREATE POLICY fgi_trainer_docs_upload/);
 assert.match(sql,/CREATE POLICY fgi_trainer_docs_read/);
 assert.doesNotMatch(sql,/UPDATE public\.fgi_coaches SET verified=true/);
});
test('payments remain closed until four legally authorized rollout switches',()=>{
 assert.match(sql,/payment_activation_approved boolean NOT NULL DEFAULT false/);
 assert.match(sql,/enterprise_registered AND consumer_terms_approved/);
 assert.match(sql,/trainer_rules_approved AND payment_activation_approved/);
 assert.match(sql,/CREATE TRIGGER fgi_block_unapproved_payment_links/);
});
test('existing coach profile and media remain intact and verification ships with build',()=>{
 assert.match(html,/id="coachCompliancePanel"/);
 assert.match(html,/id="coachComplianceForm"/);
 assert.match(html,/id="ownerCompliancePanel"/);
 assert.match(html,/id="coachForm"/);
 assert.match(html,/id="galleryForm"/);
 assert.match(html,/accept="application\/pdf,image\/jpeg,image\/png,image\/webp"/);
 assert.match(frontend,/mountTrainerVerification/);
 assert.match(frontend,/void trainerVerification\?\.refresh\(\)/);
 assert.match(build,/fitgoin-trainer-verification\.mjs/);
});

test('rejects spoofed PDF and image uploads even with a permitted declared MIME',async()=>{
 const make=(values,type)=>new Blob([Uint8Array.from(values)],{type});
 assert.equal(await validateTrainerFileSignature(make([37,80,68,70,45,49,46,55],'application/pdf'),'pdf'),true);
 assert.equal(await validateTrainerFileSignature(make([60,104,116,109,108,62],'application/pdf'),'pdf'),false);
 assert.equal(await validateTrainerFileSignature(make([255,216,255,224,0,16],'image/jpeg'),'jpg'),true);
 assert.equal(await validateTrainerFileSignature(make([137,80,78,71,13,10,26,10],'image/png'),'png'),true);
 assert.equal(await validateTrainerFileSignature(make([82,73,70,70,1,2,3,4,87,69,66,80],'image/webp'),'webp'),true);
 assert.equal(await validateTrainerFileSignature(make([71,73,70,56,57,97],'image/webp'),'webp'),false);
});
