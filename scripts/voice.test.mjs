import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../fitmatch.js', import.meta.url), 'utf8')).replace(/^import \{mountFitGoInAI\}[^\n]*\n/m,'').replace(/\r?\ninit\(\);\r?\n/, '\n');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const tick = () => new Promise(r => setImmediate(r));

function harness({ microphone, upload, insert, confirm } = {}) {
  const elements = new Map(), uploads = [], inserts = [], removed = [], recorders = [], streams = [];
  let clock = 0;
  class Element {
    constructor() { this.dataset = {}; this.disabled = false; this.children = []; this.listeners = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    querySelectorAll() { return []; }
    reportValidity() { return true; }
    replaceChildren() { this.children = []; }
    append(...children) { this.children.push(...children); }
    reset() {}
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const stream = () => {
    const track = { stops: 0, stop() { this.stops++; } };
    const value = { track, getTracks: () => [track] }; streams.push(value); return value;
  };
  class Recorder {
    static isTypeSupported(type) { return type === 'audio/mp4'; }
    constructor(stream, options) { this.stream = stream; this.mimeType = options?.mimeType || 'audio/webm'; this.state = 'inactive'; this.stops = 0; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.stops++; }
    async finish(blob = new Blob(['voice bytes'], { type: this.mimeType })) {
      this.ondataavailable({ data: blob }); await this.onstop(); await tick();
    }
  }
  const db = {
    storage: { from: () => ({
      upload: async (path, blob, options) => { uploads.push({ path, blob, options }); if (upload) await upload(); return { data: {}, error: null }; },
      remove: async paths => { removed.push(...paths); return { data: {}, error: null }; },
    }) },
    from: () => ({
      insert: payload => ({ select: () => ({ single: async () => {
        inserts.push({ ...payload }); return insert ? insert(payload, inserts.length) : { data: { ...payload, id: 1 }, error: null };
      } }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => confirm ? confirm() : { data: null, error: null } }) }),
    }),
  };
  const context = vm.createContext({
    Blob, File, URL, Uint8Array, DataView, crypto: globalThis.crypto,
    matchMedia: () => ({ matches: false }), performance: { now: () => clock },
    navigator: { mediaDevices: { getUserMedia: () => microphone ? microphone(stream) : Promise.resolve(stream()) } },
    document: { getElementById: get, createElement: () => new Element() },
    MediaRecorder: Recorder, FormData: class { constructor(form) { this.body = form.body || ''; } get() { return this.body; } },
    setInterval: () => 1, clearInterval() {}, setTimeout, clearTimeout, console,
  });
  context.testDB = db;
  vm.runInContext(source + `
    db=testDB;user={id:'sender'};activeThread={id:'thread'};
    pollMessages=async()=>{};bindChat();
    globalThis.qa={start:startVoiceRecording,stop:stopVoiceRecording,cancel:cancelVoiceRecording,fix:fixVoiceWebMDuration,
      changeThread:()=>{cancelVoiceRecording();threadEpoch++;activeThread={id:'other'};pendingMessage=null;clearChatAttachment();},
      state:()=>({session:voiceSession,file:pendingChatAttachment,duration:pendingChatDurationMs,pending:pendingMessage})};
  `, context);
  return {
    ...context.qa, get, uploads, inserts, removed, recorders, streams,
    advance: ms => { clock += ms; },
    submit: body => { const form = get('messageForm'); form.body = body || ''; form.listeners.submit({ preventDefault() {}, currentTarget: form, target: form }); },
    idle: async () => { for (let i = 0; i < 100; i++) { if (!get('messageForm').dataset.busy) return; await tick(); } throw Error('Submit did not settle'); },
  };
}

test('Send stops recording once and waits for the final audio data before upload', async () => {
  const h = harness(); await h.start(); h.advance(5200); h.submit(); h.submit(); await tick();
  assert.equal(h.recorders[0].stops, 1); assert.equal(h.uploads.length, 0);
  await h.recorders[0].finish(); await h.idle();
  assert.equal(h.uploads.length, 1); assert.equal(h.inserts.length, 1);
  assert.equal(h.inserts[0].kind, 'audio'); assert.equal(h.inserts[0].body, '');
  assert.equal(h.inserts[0].duration_ms, 5200); assert.equal(h.inserts[0].media_mime, 'audio/mp4');
  assert.match(h.uploads[0].path, /^sender\/thread\/.*\.m4a$/);
  assert.equal(await h.uploads[0].blob.text(), 'voice bytes');
  assert.equal(h.streams[0].track.stops, 1); assert.equal(h.state().file, null);
});

test('Send also waits when Stop was pressed before the recorder emits its last data', async () => {
  const h = harness(); await h.start(); h.advance(2300); const stopped = h.stop(); h.advance(2000); h.submit('Привет'); await tick();
  assert.equal(h.uploads.length, 0); await h.recorders[0].finish(); await stopped; await h.idle();
  assert.equal(h.inserts[0].duration_ms, 2300); assert.equal(h.inserts[0].body, 'Привет');
  assert.equal(h.recorders[0].stops, 1);
});

test('An empty or failed recording does not send text alone or an empty attachment', async () => {
  const h = harness(); await h.start(); h.submit('Текст вместе с голосом'); await tick();
  await h.recorders[0].finish(new Blob([], { type: 'audio/mp4' })); await h.idle();
  assert.equal(h.inserts.length, 0); assert.equal(h.uploads.length, 0);
  assert.match(h.get('chatMessage').textContent, /пустой/); assert.equal(h.state().session, null);
  await h.start(); h.submit(); await tick(); h.recorders[1].onerror(); await h.idle();
  assert.equal(h.inserts.length, 0); assert.equal(h.streams[1].track.stops, 1);
});

test('Changing the thread while Send waits discards the recording and never sends to either thread', async () => {
  const h = harness(); await h.start(); h.submit(); await tick(); h.changeThread(); await h.idle();
  await h.recorders[0].finish(); assert.equal(h.inserts.length, 0); assert.equal(h.uploads.length, 0);
  assert.equal(h.state().file, null);
});

test('Late stop events from a cancelled recording cannot stop a new recording', async () => {
  const h = harness(); await h.start(); h.cancel(); await h.start(); await h.recorders[0].finish();
  assert.equal(h.state().session.recorder, h.recorders[1]); assert.equal(h.recorders[1].state, 'recording');
  assert.equal(h.streams[1].track.stops, 0); assert.equal(h.state().file, null); h.cancel();
});

test('Cancelling a pending microphone request releases its late stream without touching the next one', async () => {
  const late = deferred(); let calls = 0;
  const h = harness({ microphone: make => ++calls === 1 ? late.promise : Promise.resolve(make()) });
  const first = h.start(); h.cancel(); await h.start();
  const track = { stops: 0, stop() { this.stops++; } }; late.resolve({ getTracks: () => [track] }); await first;
  assert.equal(track.stops, 1); assert.equal(h.state().session.recorder, h.recorders[0]);
  assert.equal(h.streams[0].track.stops, 0); h.cancel();
});

test('A thread change during upload prevents insertion and removes the unused attachment', async () => {
  const gate = deferred(), h = harness({ upload: () => gate.promise });
  await h.start(); h.submit(); await tick(); await h.recorders[0].finish();
  assert.equal(h.uploads.length, 1); h.changeThread(); gate.resolve(); await h.idle();
  assert.equal(h.inserts.length, 0); assert.deepEqual(h.removed, [h.uploads[0].path]);
  assert.equal(h.state().pending, null);
});

test('Retry after an unconfirmed send reuses the nonce and uploaded file', async () => {
  const h = harness({
    insert: (payload, count) => count === 1 ? { error: { message: 'Network lost' } } : { data: { ...payload, id: 1 } },
    confirm: () => ({ error: { message: 'Network lost' } }),
  });
  await h.start(); h.submit(); await tick(); await h.recorders[0].finish(); await h.idle();
  assert(h.state().file); h.submit(); await h.idle();
  assert.equal(h.uploads.length, 1); assert.equal(h.inserts.length, 2);
  assert.equal(h.inserts[0].client_nonce, h.inserts[1].client_nonce); assert.equal(h.removed.length, 0);
});

const element = (hex, body) => Buffer.concat([Buffer.from(hex, 'hex'), Buffer.from([0x80 | body.length]), body]);
function webm({ scale = 1000000, duration, indexed = false, known = false, padding = 0 } = {}) {
  const scaleBytes = Buffer.alloc(3); scaleBytes.writeUIntBE(scale, 0, 3);
  const info = [element('2ad7b1', scaleBytes)];
  if (duration !== undefined) { const value = Buffer.alloc(8); value.writeDoubleBE(duration); info.push(element('4489', value)); }
  if (padding) info.push(element('ec', Buffer.alloc(padding)));
  const content = Buffer.concat([...(indexed ? [element('114d9b74', Buffer.alloc(0))] : []), element('1549a966', Buffer.concat(info)), element('1f43b675', Buffer.from([0xe7, 0x81, 0]))]);
  return new Blob([element('1a45dfa3', Buffer.alloc(0)), Buffer.from('18538067', 'hex'), known ? Buffer.from([0x80 | content.length]) : Buffer.from('01ffffffffffffff', 'hex'), content], { type: 'audio/webm' });
}

test('Missing WebM duration is written with the correct timestamp scale and preserves encoded data', async () => {
  const h = harness(), original = webm({ scale: 2000000 }), fixed = await h.fix(original, 9000);
  const before = Buffer.from(await original.arrayBuffer()), after = Buffer.from(await fixed.arrayBuffer());
  const offset = after.indexOf(Buffer.from('448988', 'hex'));
  assert(offset > 0); assert.equal(after.readDoubleBE(offset + 3), 4500);
  assert.deepEqual(after.subarray(-8), before.subarray(-8)); assert.equal(after.length - before.length, 11);
});

test('WebM repairs update a known segment size and grow the Info size field when necessary', async () => {
  const h = harness(), known = webm({ known: true }), fixed = await h.fix(known, 2400);
  const before = Buffer.from(await known.arrayBuffer()), after = Buffer.from(await fixed.arrayBuffer());
  assert.equal(after[9] - before[9], 11);
  const large = webm({ padding: 114 }), grown = await h.fix(large, 1000);
  assert.equal(grown.size - large.size, 12);
  const bytes = Buffer.from(await grown.arrayBuffer()), offset = bytes.indexOf(Buffer.from('1549a966', 'hex'));
  assert.equal(bytes[offset + 4], 0x40);
});

test('Existing duration and indexed files stay intact; zero duration can be replaced without moving data', async () => {
  const h = harness(), complete = webm({ duration: 1000 }), indexed = webm({ indexed: true });
  assert.equal(await h.fix(complete, 5000), complete); assert.equal(await h.fix(indexed, 5000), indexed);
  const zero = webm({ duration: 0, indexed: true }), fixed = await h.fix(zero, 3300);
  const bytes = Buffer.from(await fixed.arrayBuffer()), offset = bytes.indexOf(Buffer.from('448988', 'hex'));
  assert.equal(fixed.size, zero.size); assert.equal(bytes.readDoubleBE(offset + 3), 3300);
});

test('MP4, malformed WebM, and invalid duration values pass through without corruption', async () => {
  const h = harness(), mp4 = new Blob(['MP4'], { type: 'audio/mp4' }), malformed = new Blob(['invalid'], { type: 'audio/webm' });
  assert.equal(await h.fix(mp4, 1000), mp4); assert.equal(await h.fix(malformed, 1000), malformed);
  const original = webm(); assert.equal(await h.fix(original, 0), original); assert.equal(await h.fix(original, NaN), original);
});
