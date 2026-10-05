import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceRole,entryPage,guardedPage,safeWorkspace,bookmarkIds,formDraft,restoreDraft} from '../fitgoin-premium-core.mjs';
test('Server profile and coach record determine navigation; editable metadata and UI drafts do not grant roles',()=>{
  assert.equal(workspaceRole({role:'client',signup_intent:'coach'},null),'client');
  assert.equal(workspaceRole({role:'coach'},null),'coach');
  assert.equal(workspaceRole({role:'client'},{id:'owner'}),'coach');
  for(const route of ['ai','account','inbox','match','coaches','dashboard','welcome'])assert.equal(guardedPage(route,false,'client'),'login');
  assert.equal(guardedPage('profile',false,'client'),'profile');
  assert.equal(guardedPage('match',true,'coach'),'account');
  for(const route of ['home','ranking','ai','coaches','inbox'])assert.equal(guardedPage(route,true,'coach'),route);
  assert.equal(entryPage({role:'client'},null,{}),'welcome');
  assert.equal(entryPage({role:'client'},null,{introduction_seen:true,preferred_path:'ai'}),'ai');
  assert.equal(entryPage({role:'client'},null,{introduction_seen:true,preferred_path:'human'}),'dashboard');
  assert.equal(entryPage({role:'client'},null,{introduction_seen:true,preferred_path:'human',last_page:'match'}),'match');
  assert.equal(entryPage({role:'client'},null,{introduction_seen:true,preferred_path:'ai',last_page:'inbox'}),'inbox');
  assert.equal(entryPage({role:'client'},null,{last_page:'ai'}),'welcome');
  assert.equal(entryPage({role:'client'},null,{introduction_seen:true,preferred_path:'human',last_page:'admin'}),'dashboard');
  assert.equal(entryPage({role:'coach'},null,{}),'account');
  assert.equal(entryPage({role:'coach'},{id:'owner'},{}),'profile');
});
test('Workspace snapshots are bounded, copied and contain no credentials or client-owned access claims',()=>{
  const original={role:'admin',access_token:'fixture',friend:true,password:'fixture',match_draft:{fields:{sport:'fitness'}}};
  const data=safeWorkspace(original);assert.equal(data.role,undefined);assert.equal(data.friend,undefined);assert.equal(data.password,undefined);assert.equal(data.access_token,undefined);
  data.match_draft.fields.sport='boxing';assert.equal(original.match_draft.fields.sport,'fitness');
  assert.throws(()=>safeWorkspace({data:'x'.repeat(24576)}),/workspace_too_large/);
  assert.deepEqual(bookmarkIds(['invalid','90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001']),['90000000-0000-4000-8000-000000000001']);
});
test('Questionnaire drafts preserve checkbox arrays without storing passwords, files or publication consent',()=>{
  const fields=[{name:'password',type:'password',value:'fixture'},{name:'photo',type:'file',value:'fixture'},{name:'name',type:'text',value:'Trainer'},{name:'languages',type:'checkbox',value:'en',checked:true},{name:'languages',type:'checkbox',value:'ru',checked:false},{name:'published',type:'checkbox',value:'on',checked:true}];
  const draft=formDraft({elements:fields});assert.deepEqual(draft,{name:'Trainer',languages:['en']});
  fields[2].value='';fields[3].checked=false;restoreDraft({elements:fields},draft);assert.equal(fields[2].value,'Trainer');assert.equal(fields[3].checked,true);assert.equal(fields[5].checked,true);
});
