# Vehicle Service Due Predictor

**LofiStack Hackathon 2026 · Team Nightmare · LSH26-T040**

## Problem

**P09 — Vehicle Service Due Predictor**

Vehicle Service Due Predictor helps a workshop track vehicle maintenance, predict when service items become due, prioritize daily customer calls, and maintain service history.

## Team

| Member | Role | GitHub |
|---|---|---|
| Md. Arman Hossen Ripon | Frontend Developer | `armanhossen-dev` |
| Bornil Mahmud | Lead Backend Developer | `BornilMahmud` |

## Event Start Code

`LSH26-8490-C900`

The event start code is recorded in `EVENT.md` as required by the hackathon.

## P09 Requirements

### 1. Vehicle and service data

The system supports vehicle records containing owner information, current odometer readings, service items, maintenance rules, and previous service records.

Service rules include:

- **Fixed-date services** — e.g. insurance and fitness
- **Time-period services** — e.g. engine oil replacement
- **Distance-based services** — e.g. brake pads and tyres

The solution is designed to work with the official P09 sample data containing at least 40 vehicles belonging to at least 25 owners.

### 2. Next due date and service status

For every service item, the application determines its next due date according to its own maintenance rule.

For distance-based maintenance, the predicted date is estimated from the vehicle's current odometer reading and its average daily distance.

Each item is classified as:

- **Overdue**
- **Due soon**
- **Fine**

The calculations use the case date supplied by the fixture rather than depending on the machine's current date.

### 3. Workshop daily call list

The workshop receives a prioritized daily call list containing:

- Owner to contact
- Vehicle
- Service item
- Reason the item needs attention
- Service priority

The list is ordered so that the most overdue and highest-value work can be handled first.

### 4. Owner vehicle page and service completion

Each owner can view a vehicle page containing:

- Vehicle information
- Every service item
- Next due date
- Estimated/service cost
- Current service status
- Service history

When a workshop records a completed service, the service item is reset according to its maintenance rule and a new service-history record is created.

## Sample Data

Official P09 fixture:

`https://live.hackathon.lofistack.com/api/fixtures/P09?teamId=LSH26-T040`

The fixture should be used to verify vehicle counts, owners, odometer readings, maintenance rules, service history, due-date calculations, statuses, and service costs.

## How to Test

1. Start the application.
2. Load the P09 sample data.
3. Open the workshop/dashboard view.
4. Review the daily call list.
5. Verify service items are categorized as overdue, due soon, or fine.
6. Open an owner and vehicle.
7. Verify every service item has a next due date and cost.
8. Check fixed-date, period-based, and distance-based maintenance.
9. Record a completed service.
10. Confirm the item resets and the service history grows.

## Technology

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Firebase SDK
- **Database:** Firebase Cloud Firestore & Authentication
- **Deployment:** Vercel / Cloudflare Pages

## AI Usage

The team used the following AI tools as development assistants:

- **ChatGPT** — planning, debugging, documentation, and implementation assistance
- **Claude** — coding assistance, debugging, and review
- **DeepSeek** — coding and technical problem-solving assistance
- **Genspark AI** — research, implementation ideas, and development productivity

All AI-assisted output was reviewed, adapted, tested, and integrated by the team.

## Repository

- `EVENT.md` — event start code
- `LICENSES.md` — third-party libraries/assets and licenses
- `evaluation-manifest.json` — evaluation evidence, if included

## Live Demo

`https://lsh26-t040-p09.vercel.app/`

## Demo Video

`<ADD DEMO VIDEO URL IF AVAILABLE>`

## Important Submission Note

The Final Submission Form requires the exact **40-character commit SHA** for this repository. The repository must be public before submission.
