# Vehicle Service Due Predictor

Solution for **LofiStack Hackathon 2026 — P09**

## Project information

- **Team:** Team Nightmare
- **Team ID:** `LSH26-T040`
- **Problem:** `P09 — Vehicle Service Due Predictor`
- **Live application:** <https://lsh26-t040-p09.vercel.app/>
- **Demo video:** N/A

> Judges will evaluate only the exact commit SHA entered in the Final Submission Form.

## Solution summary

Vehicle Service Due Predictor helps auto workshops efficiently manage vehicle maintenance, track fixture service history, and calculate upcoming service due dates. By analyzing current odometer readings, average daily usage, fixed calendar dates, and maintenance intervals, the system automatically prioritizes overdue and high-value work into an actionable daily customer call list.

## Requirements

| Requirement | Status | Where to verify |
| --- | --- | --- |
| R1 — Vehicle and service data | Complete | Vehicles list page (`/vehicles`), Owner details (`/customers/:id`) |
| R2 — Next due date and service status | Complete | Dashboard (`/`), Vehicle details (`/vehicles/:id`), engine algorithms (`src/lib/prediction.ts`) |
| R3 — Workshop daily call list | Complete | Workshop Dashboard main view (`/`) |
| R4 — Owner vehicle page and service completion | Complete | Vehicle details view (`/vehicles/:id`), Service record action buttons |

## How to test the application

1. Open the live application at <https://lsh26-t040-p09.vercel.app/>.
2. Load the P09 sample data fixture from the settings or initial data setup page.
3. Open the Workshop Dashboard (`/`) to review the prioritized daily call list ordered by overdue status and job value.
4. Verify service items are categorized strictly as **Overdue**, **Due soon**, or **Fine** using the supplied fixture case date.
5. Navigate to an owner and vehicle page to review all service items, next due dates, estimated costs, and historical records.
6. Click to record a completed service item and confirm that the item resets according to its rule while generating a new service history entry.

### Test or sample data

The system is configured to ingest the official P09 sample data fixture containing at least 40 vehicles and 25 owners:
`https://live.hackathon.lofistack.com/api/fixtures/P09?teamId=LSH26-T040`

You can load or reset fixture data via the dashboard setup panel or application settings screen.

## Run locally

### Requirements

- Node.js (v18+ recommended)
- npm / pnpm / yarn
- Firebase Account (Firestore & Authentication)

### Setup

```bash
git clone https://github.com/armanhossen-dev/lsh26-T040-p09.git
cd lsh26-T040-p09
npm install
cp .env.example .env
npm run dev
```
