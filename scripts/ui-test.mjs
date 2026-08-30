/**
 * UI smoke + responsiveness tests using a real headless browser.
 * Verifies routing, protected routes, validation, responsive layout and that
 * no console errors occur. Does not require Firebase Auth to be enabled.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
let pass = 0
let fail = 0
const consoleErrors = []

function ok(n, extra = '') {
  pass++
  console.log(`  \x1b[32m✓\x1b[0m ${n}${extra ? ` \x1b[90m${extra}\x1b[0m` : ''}`)
}
function bad(n, msg) {
  fail++
  console.log(`  \x1b[31m✗\x1b[0m ${n}\n    \x1b[31m${msg}\x1b[0m`)
}
function assert(c, n, extra) {
  c ? ok(n, extra) : bad(n, 'assertion failed')
}
function section(t) {
  console.log(`\n\x1b[1m\x1b[36m${t}\x1b[0m`)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

try {
  // ============================== ROUTING ==============================
  section('ROUTING & PROTECTED ROUTES')

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  assert(await page.locator('input[type="email"]').isVisible(), 'Login page renders email field')
  assert(
    await page.getByRole('button', { name: /sign in/i }).isVisible(),
    'Login page renders submit button'
  )

  // Unauthenticated access to a protected route must redirect to /login.
  for (const route of ['/dashboard', '/customers', '/vehicles', '/services', '/settings']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const url = page.url()
    assert(url.includes('/login'), `Unauthenticated ${route} redirects to /login`)
  }

  // Unknown route falls through to dashboard -> login when signed out.
  await page.goto(`${BASE}/this-route-does-not-exist`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  assert(page.url().includes('/login'), 'Unknown route redirects (SPA fallback works)')

  // ============================ NAVIGATION ============================
  section('AUTH PAGE NAVIGATION')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: /register here/i }).click()
  await page.waitForTimeout(500)
  assert(page.url().includes('/register'), 'Login → Register link works')
  assert(
    await page.locator('input[autocomplete="name"]').isVisible(),
    'Register page renders name field'
  )

  await page.getByRole('link', { name: /^sign in$/i }).click()
  await page.waitForTimeout(500)
  assert(page.url().includes('/login'), 'Register → Login link works')

  // ============================ VALIDATION ============================
  section('CLIENT-SIDE VALIDATION')

  // Empty login submit -> both required errors.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForTimeout(400)
  assert(
    await page.getByText('Email is required.').isVisible(),
    'Empty email shows required error'
  )
  assert(
    await page.getByText('Password is required.').isVisible(),
    'Empty password shows required error'
  )

  // Invalid email format.
  await page.fill('input[type="email"]', 'not-an-email')
  await page.fill('input[type="password"]', 'something')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForTimeout(400)
  assert(
    await page.getByText('Enter a valid email address.').isVisible(),
    'Invalid email format rejected'
  )

  // Register: password mismatch + short password.
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
  await page.locator('input[autocomplete="name"]').fill('Test Staff')
  await page.locator('input[type="email"]').fill('staff@test.com')
  const pwFields = page.locator('input[type="password"]')
  await pwFields.nth(0).fill('123')
  await pwFields.nth(1).fill('456')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForTimeout(400)
  assert(
    await page.getByText('Password must be at least 6 characters.').isVisible(),
    'Short password rejected'
  )
  assert(
    await page.getByText('Passwords do not match.').isVisible(),
    'Password mismatch rejected'
  )

  // Password strength meter appears (fresh page: the meter is intentionally
  // hidden while a password validation error is being shown).
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
  await page.locator('input[type="password"]').nth(0).fill('Str0ng!Passw0rd')
  await page.waitForTimeout(400)
  const strengthLabels = await page
    .locator('form')
    .innerHTML()
    .then((h) => h.match(/Weak|Fair|Good|Strong/g) ?? [])
  assert(
    strengthLabels.includes('Strong'),
    'Password strength meter reacts to input',
    `label: ${strengthLabels.join(',')}`
  )

  // ====================== FIREBASE ERROR SURFACING ======================
  section('FIREBASE ERROR HANDLING')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', `nobody_${Date.now()}@test.com`)
  await page.fill('input[type="password"]', 'WrongPass123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForTimeout(4000)
  const alert = page.locator('[role="alert"]')
  const alertVisible = await alert.count()
  assert(alertVisible > 0, 'Failed sign-in shows a friendly error (not a crash)')
  if (alertVisible > 0) {
    const txt = await alert.first().innerText()
    console.log(`    \x1b[90mmessage: "${txt.trim().slice(0, 120)}"\x1b[0m`)
    assert(
      !txt.includes('auth/') && !txt.includes('FirebaseError'),
      'Error message is human-readable (raw code mapped)'
    )
  }

  // ========================== RESPONSIVENESS ==========================
  section('RESPONSIVENESS')
  const viewports = [
    { name: 'Desktop 1440×900', width: 1440, height: 900 },
    { name: 'Tablet 768×1024', width: 768, height: 1024 },
    { name: 'Mobile 390×844', width: 390, height: 844 }
  ]
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientW = await page.evaluate(() => document.documentElement.clientWidth)
    const noHScroll = scrollW <= clientW + 2
    const formVisible = await page.locator('form').isVisible()
    assert(noHScroll && formVisible, `${vp.name} renders without horizontal overflow`, `${scrollW}px content / ${clientW}px viewport`)
  }

  // Brand panel is desktop-only; form is always present.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const desktopHeadline = await page
    .getByText(/Know which vehicle needs service/i)
    .isVisible()
    .catch(() => false)
  assert(desktopHeadline, 'Desktop shows the marketing/brand panel')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const mobileHidden = await page
    .getByText(/Know which vehicle needs service/i)
    .isVisible()
    .catch(() => false)
  assert(!mobileHidden, 'Mobile hides the desktop brand panel (responsive layout)')

  // ============================== GOOGLE AUTH ==============================
  section('GOOGLE SIGN-IN')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })

  const gBtn = page.locator('[data-testid="google-signin"]')
  assert((await gBtn.count()) === 1, 'Login page renders a Google sign-in button')
  assert(
    /continue with google/i.test((await gBtn.textContent()) ?? ''),
    'Google button is labelled "Continue with Google"'
  )
  assert((await gBtn.locator('svg').count()) >= 1, 'Google button shows the Google "G" logo')
  assert(await gBtn.isEnabled(), 'Google button is enabled (clickable, not a placeholder)')

  // Verify it actually calls Firebase: intercept the popup/redirect attempt.
  let googleFlowStarted = false
  page.on('popup', () => {
    googleFlowStarted = true
  })
  page.on('request', (r) => {
    if (/accounts\.google\.com|identitytoolkit.*createAuthUri/i.test(r.url())) googleFlowStarted = true
  })
  await gBtn.click()
  await page.waitForTimeout(3000)
  const gErrorShown = (await page.locator('[role="alert"]').count()) > 0
  assert(
    googleFlowStarted || gErrorShown,
    'Clicking Google button triggers a real Firebase OAuth flow (popup/request or actionable error)'
  )
  if (gErrorShown) {
    const t = (await page.locator('[role="alert"]').first().textContent()) ?? ''
    console.log(`    \x1b[33mnote:\x1b[0m Google flow reported: ${t.trim().slice(0, 160)}`)
  }

  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
  const gBtnReg = page.locator('[data-testid="google-signin"]')
  assert((await gBtnReg.count()) === 1, 'Register page also offers Google sign-up')
  assert(
    /sign up with google/i.test((await gBtnReg.textContent()) ?? ''),
    'Register Google button is labelled "Sign up with Google"'
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const gBox = await page.locator('[data-testid="google-signin"]').boundingBox()
  assert(!!gBox && gBox.width > 200, 'Google button is full-width and visible on mobile (390px)')

  // ============================== ASSETS ==============================
  section('ASSETS & CONSOLE')
  await page.setViewportSize({ width: 1440, height: 900 })
  const resp = await page.goto(`${BASE}/favicon.svg`)
  assert(resp?.status() === 200, 'favicon.svg served')

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const realErrors = consoleErrors.filter(
    (e) =>
      !/auth\/(operation-not-allowed|invalid-credential|user-not-found|wrong-password)/i.test(e) &&
      !/identitytoolkit|400 \(Bad Request\)|Failed to load resource/i.test(e) &&
      // Emitted by the Google popup we deliberately open above; mitigated in
      // production by the Cross-Origin-Opener-Policy header in public/_headers.
      !/Cross-Origin-Opener-Policy/i.test(e)
  )

  const hdr = await page.goto(`${BASE}/login`)
  assert(
    hdr?.headers()['cross-origin-opener-policy'] === 'same-origin-allow-popups',
    'COOP header set to same-origin-allow-popups (keeps Google popup detectable)'
  )
  if (realErrors.length === 0) {
    ok('No unexpected console errors')
  } else {
    bad('No unexpected console errors', realErrors.slice(0, 4).join(' | '))
  }
} catch (e) {
  bad('Test run', e.message)
} finally {
  await browser.close()
}

console.log(
  `\n\x1b[1mRESULT: \x1b[32m${pass} passed\x1b[0m` + (fail ? `, \x1b[31m${fail} failed\x1b[0m` : '') + '\n'
)
process.exit(fail ? 1 : 0)
