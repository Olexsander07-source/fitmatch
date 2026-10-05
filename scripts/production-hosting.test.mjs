import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configureProductionHosting, productionWorkerExists, PRODUCTION_HOSTING as site } from './production-hosting.mjs';

test('a genuinely absent production Worker may be initialized', async () => {
  const request = async url => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${site.account}/workers/services/${site.service}`);
    return Response.json({ success: false, errors: [{ code: 10090 }] }, { status: 404 });
  };
  assert.equal(await productionWorkerExists({ token: 'fixture-only', request }), false);
});

test('an existing production Worker is not initialized again', async () => {
  assert.equal(await productionWorkerExists({ token: 'fixture-only', request: async () => Response.json({ success: true, result: {} }) }), true);
});

test('an authentication failure is never mistaken for an absent Worker', async () => {
  await assert.rejects(productionWorkerExists({ token: 'fixture-only', request: async () => Response.json({ success: false, errors: [{ code: 10000 }] }, { status: 403 }) }), /HTTP 403/);
});

test('production configuration keeps domain assignment out of the legacy Git build', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.name, site.service);
  assert.equal(config.account_id, site.account);
  assert.deepEqual(config.routes, []);
  assert.equal(config.workers_dev, false);
});

function fixture({ service = site.legacyService, zone = site.zone, failDisable = false, keepPreview = false, keepOldMapping = false, removed = [], conflicting = [], transferZone = site.zone } = {}) {
  let current = service;
  const calls = [];
  const request = async (url, options) => {
    calls.push({ path: url.pathname, method: options.method, body: options.body ? JSON.parse(options.body) : null });
    assert.equal(url.host, 'api.cloudflare.com');
    assert(url.pathname.startsWith(`/client/v4/accounts/${site.account}/`));
    const last = calls.at(-1);
    if (last.path.endsWith('/subdomain')) {
      if (failDisable && last.method === 'POST') return new Response(null, { status: 403 });
      return Response.json({ success: true, result: { enabled: false, previews_enabled: keepPreview } });
    }
    if (last.path.endsWith('/domains/changeset')) {
      assert.equal(url.search, '?replace_state=true');
      return Response.json({ success: true, result: {
        added: [], updated: [{ hostname: site.hostname, service: site.service, zone_id: transferZone }],
        removed, conflicting, affected_zones: [transferZone],
      } });
    }
    if (last.path.endsWith('/domains/records')) {
      assert.equal(last.method, 'PUT');
      if (!keepOldMapping) current = site.service;
      return Response.json({ success: true, result: {} });
    }
    assert(last.path.endsWith('/workers/domains'));
    return Response.json({ success: true, result: [{ hostname: site.hostname, service: current, zone_id: zone, enabled: true }] });
  };
  return { calls, request };
}

test('production domain moves to the complete Worker after additional public URLs are disabled', async () => {
  const f = fixture();
  const result = await configureProductionHosting({ token: 'fixture-only', request: f.request });
  assert.equal(result.service, site.service);
  assert.equal(result.changed, true);
  const writes = f.calls.filter(call => call.method !== 'GET');
  assert.deepEqual(writes.map(call => call.method), ['POST', 'POST', 'PUT']);
  assert.deepEqual(writes[0].body, { enabled: false, previews_enabled: false });
  const origins = [{ hostname: site.hostname, zone_id: site.zone, enabled: true, previews_enabled: false }];
  assert.deepEqual(writes[1].body, origins);
  assert.deepEqual(writes[2].body, {
    override_scope: true, override_existing_origin: true,
    override_existing_dns_record: false, origins,
  });
});

test('subsequent releases preserve the existing production mapping', async () => {
  const f = fixture({ service: site.service });
  assert.equal((await configureProductionHosting({ token: 'fixture-only', request: f.request })).changed, false);
  assert.equal(f.calls.filter(call => call.method === 'PUT').length, 0);
});

for (const options of [{ service: 'another-site' }, { zone: 'another-zone' }]) {
  test(`an unrelated ${options.service ? 'service' : 'zone'} cannot be overwritten`, async () => {
    const f = fixture(options);
    await assert.rejects(configureProductionHosting({ token: 'fixture-only', request: f.request }), /refusing to overwrite/);
    assert.equal(f.calls.filter(call => call.method !== 'GET').length, 0);
  });
}

test('failed protection of preview URLs stops before domain reassignment', async () => {
  const f = fixture({ failDisable: true });
  await assert.rejects(configureProductionHosting({ token: 'fixture-only', request: f.request }), /HTTP 403/);
  assert.equal(f.calls.filter(call => call.method === 'PUT').length, 0);
});

test('enabled previews cannot be silently accepted', async () => {
  const f = fixture({ keepPreview: true });
  await assert.rejects(configureProductionHosting({ token: 'fixture-only', request: f.request }), /still enabled/);
  assert.equal(f.calls.filter(call => call.method === 'PUT').length, 0);
});

test('a successful API response cannot hide unchanged domain routing', async () => {
  const f = fixture({ keepOldMapping: true });
  await assert.rejects(configureProductionHosting({ token: 'fixture-only', request: f.request }), /mapping did not match/);
});

for (const options of [{ removed: [{ hostname: 'another.example' }] }, { conflicting: [{ hostname: site.hostname }] }, { transferZone: 'another-zone' }]) {
  test(`atomic transfer rejects ${Object.keys(options)[0]} outside the intended change`, async () => {
    const f = fixture(options);
    await assert.rejects(configureProductionHosting({ token: 'fixture-only', request: f.request }), /unexpected domains or DNS/);
    assert.equal(f.calls.filter(call => call.method === 'PUT').length, 0);
  });
}
