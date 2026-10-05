export const PRODUCTION_HOSTING = Object.freeze({
  account: '5604e87732eb7e972fe87990a0f04be7',
  zone: '734e4c2f15250cb00897b03e6be1fea8',
  hostname: 'fitgoin.com',
  service: 'fitgoin-production',
  legacyService: 'fitgoin',
});

export async function productionWorkerExists({ token, request = fetch } = {}) {
  if (!token) throw new Error('Existing Cloudflare deployment credential is unavailable.');
  const { account, service } = PRODUCTION_HOSTING;
  const response = await request(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/services/${service}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (response.status === 404 && data.errors?.some(error => [10007, 10090].includes(error.code))) return false;
  if (!response.ok || !data.success) throw new Error(`Cannot confirm production Worker existence: HTTP ${response.status}`);
  return true;
}

// Domain reassignment is scoped to this existing site and account. A foreign
// service or zone must be reviewed instead of being overwritten automatically.
export async function configureProductionHosting({ token, request = fetch } = {}) {
  if (!token) throw new Error('Existing Cloudflare deployment credential is unavailable.');
  const { account, zone, hostname, service, legacyService } = PRODUCTION_HOSTING;
  const root = `https://api.cloudflare.com/client/v4/accounts/${account}/`;
  async function call(endpoint, method = 'GET', body) {
    const response = await request(new URL(endpoint, root), {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Cloudflare hosting ${method} ${endpoint} failed: HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(`Cloudflare hosting ${method} ${endpoint} was rejected.`);
    return data.result;
  }
  const domains = await call('workers/domains');
  if (!Array.isArray(domains)) throw new Error('Cloudflare domain inventory is invalid.');
  const matches = domains.filter(domain => domain.hostname === hostname);
  if (matches.length !== 1) throw new Error('Expected exactly one existing production domain.');
  const previous = matches[0];
  if (previous.zone_id !== zone || ![legacyService, service].includes(previous.service)) {
    throw new Error('Production domain belongs to an unexpected zone or service; refusing to overwrite.');
  }

  // Set these before attaching the domain so no additional public preview
  // hostname is introduced by creating the production Worker.
  await call(`workers/scripts/${service}/subdomain`, 'POST', { enabled: false, previews_enabled: false });
  const subdomain = await call(`workers/scripts/${service}/subdomain`);
  if (subdomain.enabled !== false || subdomain.previews_enabled !== false) {
    throw new Error('Production workers.dev or preview URLs are still enabled.');
  }
  if (previous.service !== service) {
    await call('workers/domains', 'PUT', { hostname, service, zone_id: zone });
  }
  const updated = (await call('workers/domains')).filter(domain => domain.hostname === hostname);
  if (updated.length !== 1 || updated[0].zone_id !== zone || updated[0].service !== service || updated[0].enabled === false) {
    throw new Error('Production domain mapping did not match the published Worker.');
  }
  return { hostname, service, changed: previous.service !== service, workersDev: false, previewsEnabled: false };
}
