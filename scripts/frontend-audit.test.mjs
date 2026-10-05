import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import vm from 'node:vm';
const source=(await readFile(new URL('../fitmatch.js',import.meta.url),'utf8')).replace(/^import [^\n]*\n/gm,'').replace(/\r?\ninit\(\);\r?\n/,'\n');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function calls({media=()=>Promise.resolve(stream()),replace=async()=>{},writeResult=null,readResult=null}={}){
 const elements=new Map(),writes=[],shown=[],tracks=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{classList:{remove(){}},open:false,close(){this.open=false},play:async()=>{},getTracks:()=>[],textContent:''});return elements.get(id)};
 const peer={getSenders:()=>[{track:{kind:'video'},replaceTrack:replace}],createOffer:async()=>({type:'offer',sdp:'fixture'}),createAnswer:async()=>({type:'answer',sdp:'fixture'}),setLocalDescription:async value=>peer.localDescription=value,setRemoteDescription:async()=>{},close(){}};
 const db={from(table){let payload,kind;const q={insert(value){payload=value;kind='insert';return q},update(value){payload=value;kind='update';return q},select(){return q},eq(){return q},gt(){return q},gte(){return q},order(){return q},limit(){return q},single(){return q},maybeSingle(){return q},then(resolve){if(kind)writes.push({table,kind,payload});return Promise.resolve(kind&&writeResult?writeResult({table,kind,payload}):!kind&&readResult?readResult():{data:{id:'call',status:'ringing',...payload},error:null}).then(resolve)}};return q}};
 const context=vm.createContext({Blob,File,URL,Uint8Array,DataView,crypto:globalThis.crypto,matchMedia:()=>({matches:false}),navigator:{mediaDevices:{getUserMedia:media}},document:{getElementById:get},RTCPeerConnection:class{},MediaStream:class{constructor(values){this.values=values}getTracks(){return this.values}getAudioTracks(){return this.values.filter(x=>x.kind==='audio')}getVideoTracks(){return this.values.filter(x=>x.kind==='video')}},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,console,testDB:db,testPeer:peer,testShown:shown});
 vm.runInContext(source+`
 db=testDB;user={id:'owner'};activeThread={id:'thread',client_id:'owner',coach_id:'coach'};
 cancelVoiceRecording=()=>{};showActiveCall=value=>testShown.push(value);createCallPeer=()=>{callPeer=testPeer;return testPeer};sendCallSignal=async()=>{};waitForCallOffer=async()=>({payload:{type:'offer',sdp:'fixture'}});flushCallIce=async()=>{};pollCallSignals=async()=>{};
 globalThis.qa={audio:startAudioCall,video:startVideoCall,accept:acceptIncomingCall,camera:switchCallCamera,cancel:cleanupCallLocal,
 end:endCurrentCall,refresh:refreshCurrentCall,checkIncoming:checkIncomingCall,
 incoming:()=>{incomingCall={id:'incoming',kind:'audio',thread_id:'thread'};},
 logout:()=>{user=null;authEpoch++;cleanupCallLocal()},changeThread:()=>activeThread={id:'other'},
 cameraSetup:local=>{currentCall={id:'camera-call',kind:'video',status:'accepted'};callPeer=testPeer;callLocalStream=local;},
 state:()=>({call:currentCall,local:callLocalStream,request:callMediaRequest})};
 `,context);
 return{...context.qa,writes,shown,get,peer};
}
function stream(){const audio={kind:'audio',stops:0,stop(){this.stops++}},video={kind:'video',stops:0,stop(){this.stops++}};return{audio,video,getTracks:()=>[audio,video],getAudioTracks:()=>[audio],getVideoTracks:()=>[video]};}
for(const kind of ['audio','video'])test(`Late ${kind} permission after logout stops media before writing a call`,async()=>{
 const permission=deferred(),value=stream(),h=calls({media:()=>permission.promise});const pending=h[kind]();h.logout();permission.resolve(value);await pending;
 assert.equal(value.audio.stops,1);assert.equal(value.video.stops,1);assert.equal(h.writes.length,0);assert.equal(h.shown.length,0);assert.equal(h.state().local,null);
});
test('Repeated call buttons share one pending permission request',async()=>{
 const permission=deferred(),value=stream();let requests=0;const h=calls({media:()=>{requests++;return permission.promise}});
 const pending=h.audio();await assert.rejects(h.video(),/Подожди/);h.cancel();permission.resolve(value);await pending;
 assert.equal(requests,1);assert.equal(value.audio.stops,1);assert.equal(h.writes.length,0);
});
test('Changing the chat before granting microphone permission does not call the old partner',async()=>{
 const permission=deferred(),value=stream(),h=calls({media:()=>permission.promise});const pending=h.audio();h.changeThread();permission.resolve(value);await pending;
 assert.equal(h.writes.length,0);assert.equal(value.audio.stops,1);
});
test('Late incoming permission after logout cannot reopen a private call',async()=>{
 const permission=deferred(),value=stream(),h=calls({media:()=>permission.promise});h.incoming();const pending=h.accept();h.logout();permission.resolve(value);await pending;
 assert.equal(value.audio.stops,1);assert.equal(h.writes.length,0);assert.equal(h.shown.length,0);
});
test('Failed camera replacement stops the new camera and preserves the current tracks',async()=>{
 const old=stream(),next=stream(),h=calls({media:()=>Promise.resolve(next),replace:async()=>{throw Error('replace failed')}});h.cameraSetup(old);
 await assert.rejects(h.camera(),/replace failed/);assert.equal(next.video.stops,1);assert.equal(old.video.stops,0);assert.equal(h.state().local,old);assert.equal(h.state().request,null);
});
test('Ending a call while a camera prompt is pending stops the late camera',async()=>{
 const permission=deferred(),old=stream(),next=stream(),h=calls({media:()=>permission.promise});h.cameraSetup(old);const pending=h.camera();h.cancel();permission.resolve(next);await pending;
 assert.equal(next.video.stops,1);assert.equal(old.video.stops,1);assert.equal(h.state().local,null);
});
test('End stops the microphone and camera before waiting for an unavailable server',async()=>{
 const reply=deferred(),local=stream(),h=calls({writeResult:()=>reply.promise});h.cameraSetup(local);const ending=h.end();
 assert.equal(local.audio.stops,1);assert.equal(local.video.stops,1);assert.equal(h.state().call,null);
 reply.resolve({data:null,error:Error('Server offline')});await assert.rejects(ending,/Server offline/);assert.equal(h.state().local,null);
});
test('An old call poll cannot restore call state after logout',async()=>{
 const reply=deferred(),local=stream(),h=calls({readResult:()=>reply.promise});h.cameraSetup(local);const polling=h.refresh();h.logout();reply.resolve({data:{id:'camera-call',kind:'video',status:'accepted'},error:null});await polling;
 assert.equal(h.state().call,null);assert.equal(h.state().local,null);
});
test('An old incoming poll cannot show a private call after logout',async()=>{
 const reply=deferred(),h=calls({readResult:()=>reply.promise});const polling=h.checkIncoming();h.logout();reply.resolve({data:{id:'late-incoming',kind:'audio',status:'ringing'},error:null});await polling;
 assert.equal(h.state().call,null);assert.equal(h.get('incomingCallDialog').open,false);
});
const cookieSource=await readFile(new URL('../cookie-consent.js',import.meta.url),'utf8');
for(const value of ['%E0%A4%A','unknown'])test(`Invalid consent cookie ${value} does not imply consent or break settings`,()=>{
 let banner,events=0;const listeners={};const document={cookie:'fitgoin_cookie_consent_v1='+value,readyState:'complete',getElementById:()=>banner,createElement:()=>({setAttribute(){}}),body:{append(element){banner=element}},addEventListener(name,handler){listeners[name]=handler}};
 const window={dispatchEvent(){events++}};vm.runInNewContext(cookieSource,{document,window,CustomEvent:class{}});
 assert.equal(window.fitgoinCookieConsent.analytics,false);assert.equal(banner.id,'cookieBanner');assert.equal(typeof listeners.click,'function');assert.equal(events,1);
});
