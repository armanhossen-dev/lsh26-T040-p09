# Firebase setup — required steps

I verified your Firebase project `project-9-a6037` directly from the sandbox. The Firestore
database exists and is reachable, but some settings must be switched on in the console before
login and data access will work. Only the project owner can do these — an API key cannot.

| # | Step | Status from my probe |
|---|------|----------------------|
| 1 | Enable Email/Password sign-in | ❌ **not enabled** — must do |
| 2 | Publish Firestore rules | ❌ **denying all** — must do |
| 3 | Enable Google sign-in | ✅ **already enabled** — nothing to do |
| 4 | Add the preview domain to authorised domains | ⚠️ **needed for Google login on the preview URL** |

Total time: about 3 minutes.

---

## Step 1 — Enable Email/Password sign-in  ⚠️ REQUIRED

**Why:** the Identity Toolkit API currently rejects every registration with
`OPERATION_NOT_ALLOWED`, which means the Email/Password provider has never been enabled.

1. Open <https://console.firebase.google.com/project/project-9-a6037/authentication/providers>
2. If you see a **Get started** button, click it.
3. In **Sign-in method**, click **Email/Password**.
4. Turn on the first toggle (**Enable**). Leave "Email link (passwordless)" off.
5. Click **Save**.

**Verify:**

```bash
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyB2EMLhCcS77caRx8ZxYrSaXyxB2MANIzE" \
  -H "Content-Type: application/json" \
  -d '{"email":"probe@example.com","password":"Probe12345!","returnSecureToken":true}'
```

Before: `"message": "OPERATION_NOT_ALLOWED"` · After: a JSON payload containing `idToken`.

---

## Step 1b — Google sign-in  ✅ ALREADY DONE

I probed the Identity Toolkit and Google is already configured on this project (OAuth client
`479696854558-se0b5rnaul8ajk57bddtdo50eqf87voo.apps.googleusercontent.com`). The
**Continue with Google** button on the login page uses it directly — no action needed:

```bash
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=AIzaSyB2EMLhCcS77caRx8ZxYrSaXyxB2MANIzE" \
  -H "Content-Type: application/json" \
  -d '{"providerId":"google.com","continueUri":"https://project-9-a6037.firebaseapp.com/__/auth/handler"}'
```

Returns an `authUri` → provider is live.

---

## Step 2 — Publish the Firestore security rules  ⚠️ REQUIRED

**Why:** the database currently answers `PERMISSION_DENIED` even for signed-in users, so no
document can be read or written. The rules in `firestore.rules` fix this while still blocking
all unauthenticated access.

1. Open <https://console.firebase.google.com/project/project-9-a6037/firestore/rules>
2. Delete everything in the editor.
3. Paste the entire contents of **`firestore.rules`** from this project.
4. Click **Publish**.

These rules enforce:

| Rule | Effect |
|---|---|
| `signedIn()` on all workshop collections | unauthenticated users get `PERMISSION_DENIED` |
| `isSelf(uid)` on `/users/{uid}` | a staffer can only read/write their own profile |
| immutable `uid` / `email` / `role` | a client cannot escalate its own role to `admin` |
| shape + range validation | rejects negative mileage, negative cost, bad year, empty names |
| `match /{document=**} { allow read, write: if false; }` | denies any collection not listed |

---

## Step 3 — Confirm everything works

After both steps, run the end-to-end verification. It creates real documents, checks the
prediction pipeline, then deletes what it created:

```bash
cd /home/user/webapp
node scripts/verify-firebase.mjs
```

Expected output ends with:

```
RESULT: 20 passed
```

If Step 1 was missed it stops at `auth/operation-not-allowed`.
If Step 2 was missed it stops at `permission-denied`. Both cases print the fix.

---

## Step 4 — Authorise the domain for Google sign-in  ⚠️ REQUIRED for Google login

**Why:** Firebase only allows OAuth popups from domains on its allow-list. Right now the list is:

```
localhost
project-9-a6037.firebaseapp.com
project-9-a6037.web.app
```

Email/password login works from any domain, but clicking **Continue with Google** from the
preview or production URL will fail with `auth/unauthorized-domain` until the domain is added.
The app shows that as a plain-English message naming the exact hostname to add.

1. Open <https://console.firebase.google.com/project/project-9-a6037/authentication/settings>
2. Scroll to **Authorised domains** → **Add domain**.
3. Add the hostname you are using (no `https://`, no trailing slash):
   - Preview/testing: `3000-iqd7juzbh0k25ncv82m80-8f57ffe2.sandbox.novita.ai`
   - After deploying: your Cloudflare Pages domain, e.g. `autoserve-dhaka.pages.dev`
4. Click **Add**. It takes effect immediately — just reload the page.

> Note: the sandbox preview hostname changes if the sandbox is recreated. For long-term use,
> deploy the app and authorise the stable production domain instead.

---

## Optional — index for larger datasets

The app sorts on `registrationKey`, `name` and `serviceDate`, which Firestore serves from
single-field indexes automatically. No composite index is required. If you later add a query that
needs one, Firestore logs a console error containing a one-click creation link — the app surfaces
this as *"Firestore needs an index for this query."*

## Optional — production environment variables

The Firebase web config is safe to expose (it identifies, not authenticates — your security rules
do the enforcing), but the code reads it from env vars so you can point staging and production at
different projects. Copy `.env.example` to `.env` locally, and set the same `VITE_FIREBASE_*`
variables in your host's build settings for production.
