// Live, read-only browser checks. No intercepted requests or fixture accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.FGI_PLAYWRIGHT_MODULE || 'playwright-core');

(async () => {
  const base = process.env.FGI_SITE_URL || 'https://fitgoin.com/';
  const failures = [], errors = [], results = [];
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.FGI_CHROME || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined),
    args: process.platform === 'win32' ? [] : ['--no-sandbox'],
    ...(proxy ? {proxy: {server: new URL(proxy).origin}} : {}),
  });
  try {
    for (const width of [360, 390, 768, 1440]) {
      const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'no-preference', ignoreHTTPSErrors: Boolean(proxy)});
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push({width, error: error.message}));
      page.on('response', response => {
        if (response.url().startsWith(base) && response.status() >= 400) failures.push({width, url: response.url(), status: response.status()});
      });
      page.on('requestfailed', request => {
        if (request.url().startsWith(base)) failures.push({width, url: request.url(), error: request.failure()?.errorText});
      });
      await page.goto(`${base}?ui_verify=${Date.now()}`, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(() => typeof document.getElementById('pauseHero')?.onclick === 'function');
      await page.locator('#cookieBanner [data-cookie-choice="necessary"]').click();
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(await overflow(), false, `homepage overflow at ${width}`);

      if (width === 360) {
        await page.waitForFunction(() => document.querySelectorAll('.hero-indicator i')[1]?.classList.contains('active'), null, {timeout: 20000});
        await page.waitForFunction(() => document.getElementById('heroImage').style.backgroundImage.includes('online-800.webp'));
        await page.locator('#pauseHero').click();
        assert.equal(await page.locator('#pauseHero').getAttribute('aria-pressed'), 'true');
        const before = await page.locator('#heroImage').evaluate(el => el.style.backgroundImage);
        await page.waitForTimeout(9000);
        assert.equal(await page.locator('#heroImage').evaluate(el => el.style.backgroundImage), before, 'paused background must stay still');
        await page.locator('#pauseHero').click();
        assert.equal(await page.locator('#pauseHero').getAttribute('aria-pressed'), 'false');
        await page.waitForFunction(() => document.querySelectorAll('.hero-indicator i')[2]?.classList.contains('active'), null, {timeout: 20000});
        await page.waitForFunction(() => document.getElementById('heroImage').style.backgroundImage.includes('boxing-800.webp'));
      }

      await page.locator('#home [data-signup-role="client"]').click();
      await page.locator('#signup.active').waitFor();
      assert.match(await page.locator('#signupRoleLabel').textContent(), /КЛИЕНТА/);
      assert.equal(await overflow(), false, `client signup overflow at ${width}`);
      await page.locator('.logo').click();
      await page.locator('#home [data-signup-role="coach"]').click();
      await page.locator('#signup.active').waitFor();
      assert.match(await page.locator('#signupRoleLabel').textContent(), /ТРЕНЕРА/);
      await page.locator('.logo').click();
      await page.locator('#authOpen').click();
      await page.locator('#authDialog[open]').waitFor();
      assert.equal(await overflow(), false, `login overflow at ${width}`);
      await page.locator('#authDialog [data-close]').click();
      await page.locator('#home [data-action="login"]').click();
      await page.locator('#authDialog[open]').waitFor();
      await page.locator('#authDialog [data-close]').click();
      await page.locator('#accountOpen').click();
      await page.locator('#signup.active').waitFor();
      await page.locator('.logo').click();
      await page.locator('[data-cookie-settings]').click();
      await page.locator('#cookieBanner:visible').waitFor();
      await page.locator('[data-cookie-choice="necessary"]').click();
      results.push({width, status: 'passed', scenarios: ['client registration button', 'trainer registration button', 'header and homepage login buttons', 'trainer entry button', 'cookie settings', 'no horizontal overflow', ...(width === 360 ? ['automatic background changes', 'pause freezes background', 'resume changes background again'] : [])]});
      console.log(`Live UI passed at ${width}px`);
      await context.close();
    }
    assert.deepEqual(errors, [], 'live JavaScript errors');
    assert.deepEqual(failures, [], 'live first-party request failures');
    const report = {at: new Date().toISOString(), base, fixture: false, viewports: results, pageErrors: errors, failedRequests: failures, status: 'passed'};
    if (process.env.FGI_UI_REPORT) {
      fs.mkdirSync(path.dirname(process.env.FGI_UI_REPORT), {recursive: true});
      fs.writeFileSync(process.env.FGI_UI_REPORT, JSON.stringify(report, null, 2) + '\n');
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
