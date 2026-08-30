# AutoServe Dhaka

Solution for **LofiStack Hackathon 2026 — P09**

## Project information

- **Team:** `Nightmare`
- **Team ID:** `LSH26-T040`
- **Problem:** `P09 — Vehicle Service Prediction`
- **Live application:** [lsh26-t040-p09.vercel.app](https://lsh26-t040-p09.vercel.app/)    
- **Demo video:** Optional link, maximum three minutes

> Judges will evaluate only the exact commit SHA entered in the Final Submission Form.

## Solution summary

AutoServe Dhaka is a workshop-facing web app for tracking customer vehicles and predicting when
each one is next due for service. Staff record customers, vehicles and service history, and the
app combines a mileage-based forecast with a time-based forecast to flag each vehicle as safe,
due soon, or overdue. Data is stored in Firestore behind authenticated, per-collection security
rules, and the dashboard surfaces the most urgent vehicles first.

## Requirements

| Requirement              | Status                             | Where to verify       |
| ------------------------ | ----------------------------------- | --------------------- |
| R1 — <short description> | Complete / Partial / Not attempted | Page, route or action |
| R2 — <short description> | Complete / Partial / Not attempted | Page, route or action |
| R3 — <short description> | Complete / Partial / Not attempted | Page, route or action |
| R4 — <short description> | Complete / Partial / Not attempted | Page, route or action |

## How to test the application

1. Open the live application and register a new account, or sign in with an existing one
   (email/password or **Continue with Google**).
2. On the **Customers** page, add a customer, then add one of their vehicles from the
   **Vehicles** page.
3. Open the vehicle's detail page and log at least two service records with different dates
   and odometer readings.
4. Return to the **Dashboard** — the vehicle's next-service prediction (date, mileage, and
   SAFE / DUE SOON / OVERDUE status) updates automatically from the logged history.

### Test or sample data

There is no bundled fixture file or one-click import — judges enter customers, vehicles and
service records directly through the UI forms described above. To reset a test account, delete
its customers/vehicles from the **Customers** and **Vehicles** pages (deleting a customer or
vehicle cascades to its dependent vehicles/service records).

## Run locally

### Requirements

- Node.js 18+ and npm
- A Firebase project with Firestore and Authentication (Email/Password and Google providers)
- Cloudflare Wrangler (only needed for the `dev:sandbox` / `deploy` scripts)

### Setup

```bash
git clone https://github.com/armanhossen-dev/lsh26-T040-p09
cd lsh26-t040-p09
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` with your own Firebase web config (`VITE_FIREBASE_*` keys — see
`FIREBASE_SETUP.md` for the exact console steps: enabling Email/Password sign-in, publishing
`firestore.rules`, and authorising your dev/preview domain for Google sign-in).

Do not include real passwords, tokens or API keys. List only variable names in `.env.example`.

## Problem-solving approach

Briefly explain:

- how the team understood the problem;
- the chosen solution;
- the most important technical or product decision; and
- how the solution was tested.

## Technology used

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS, React Router, Recharts
- **Backend:** Firebase Authentication + Firestore (client SDK), Hono (Cloudflare Pages Functions)
- **Database:** Cloud Firestore
- **Deployment:** Cloudflare Pages (via Wrangler)
- **Other material tools:** Vitest (unit tests), Playwright (`scripts/ui-test.mjs`)

See [`LICENSES.md`](LICENSES.md) for third-party materials.

## Team contributions

| Registered member | GitHub username | Major contribution | Evidence                |
| ----------------- | --------------- | ------------------- | ------------------------ |
| \<Name>           | `<username>`    | \<Contribution>      | File, feature or commit |
| \<Name>           | `<username>`    | \<Contribution>      | File, feature or commit |

Commit count alone does not represent contribution.

## AI usage

List each AI tool used, what it assisted with and how the team verified its output. Write `No AI tools used` if none were used.

## Major design decisions

- **Deterministic prediction engine, not ML:** `src/lib/prediction.ts` combines a measured
  average km-interval and a measured average day-interval from a vehicle's own service history
  (falling back to documented manufacturer-style defaults per vehicle type when fewer than two
  records exist), and reports whichever forecast is more urgent. This keeps every prediction
  fully explainable to a workshop staff member.
- **Firestore security rules do the enforcing, not the client:** `firestore.rules` requires
  authentication on every workshop collection, locks user profiles to their own owner, blocks
  role escalation, and validates document shape/ranges (no negative mileage or cost), with a
  default-deny fallback for any unlisted collection.

## Known limitations

- No bulk/CSV import — customers, vehicles and service history must be entered one at a time
  through the UI.
- Google sign-in requires the app's hostname to be added to the Firebase project's authorised
  domains list (see `FIREBASE_SETUP.md`); it will fail with `auth/unauthorized-domain` otherwise.

## Repository records

- [`EVENT.md`](EVENT.md) — event start code and pre-event-material declaration
- [`evaluation-manifest.json`](evaluation-manifest.json) — structured judging evidence
- [`LICENSES.md`](LICENSES.md) — frameworks, libraries, templates and assets
