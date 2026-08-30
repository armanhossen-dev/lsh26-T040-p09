# Vehicle Service Tracker

Solution for **LofiStack Hackathon 2026 — P09**

## Project information

* **Team:** Nightmare
* **Team ID:** `LSH26-T040`
* **Problem:** `P09 — Vehicle Service`
* **Live application:** `<LIVE-APP-URL>`
* **Demo video:** `<OPTIONAL-DEMO-VIDEO-URL>`

> Judges will evaluate only the exact commit SHA entered in the Final Submission Form.

## Solution summary

Vehicle Service Tracker helps vehicle owners keep track of important maintenance and service requirements in one place. The application uses vehicle information, odometer readings, service schedules, and service history to determine upcoming or overdue maintenance based on fixed dates, time intervals, and mileage.

The goal is to make vehicle maintenance easier to monitor and help owners avoid missed servicing, expired documents, and mileage-based maintenance.

## Requirements

| Requirement                         | Status   | Where to verify                    |
| ----------------------------------- | -------- | ---------------------------------- |
| Vehicle and owner information       | Complete | Vehicle/owner dashboard            |
| Odometer reading tracking           | Complete | Vehicle details / odometer section |
| Fixed-date service tracking         | Complete | Service schedule                   |
| Period-based service tracking       | Complete | Service schedule                   |
| Distance-based service tracking     | Complete | Service schedule                   |
| Service history                     | Complete | Vehicle service history            |
| Upcoming/overdue service indication | Complete | Vehicle dashboard/service status   |

## How to test the application

1. Open the live application.
2. Load or enter a P09 vehicle-service case.
3. Select a vehicle and review its current odometer reading.
4. Review the service items and their maintenance rules.
5. Check the service history for previously completed maintenance.
6. Verify the application calculates the service status from the supplied dates, intervals, mileage, and history.
7. Add/update an odometer reading and verify that distance-based service status changes accordingly.

### Test or sample data

The submission kit provides public P09 fixture data in:

`fixtures/P09_vehicle_service_public.json`

The fixture contains vehicle owners, vehicles, odometer readings, service items, maintenance rules, and service history.

The application should treat the fixture's `today` value as the case date rather than relying on the computer's current clock.

Example service rules include:

* **Fixed date:** Insurance/document renewal
* **Period based:** Air filter every N months
* **Distance based:** Brake pads every N kilometres

## Run locally

### Requirements

* `<RUNTIME AND VERSION>`
* `<PACKAGE MANAGER>`
* `<DATABASE, IF REQUIRED>`

### Setup

```bash
git clone <PUBLIC-REPOSITORY-URL>
cd lsh26-t040-p09

<INSTALL-COMMAND>

<COPY-EXAMPLE-ENV-COMMAND>

<RUN-COMMAND>
```

Do not include real passwords, tokens, API keys, or private credentials.

## Problem-solving approach

We approached the problem by first identifying the three main maintenance-rule types: fixed-date, time-period, and distance-based service schedules.

The application keeps the vehicle's current odometer reading and service history as the basis for determining whether a service is upcoming, due, or overdue. For date-based services, the relevant due date and service interval are considered. For mileage-based services, the latest odometer reading and previous service mileage are compared.

We also designed the interface around quick visibility of vehicle status so that a user can understand which maintenance items need attention without manually calculating every interval.

The solution was tested using the published P09 fixture structure and different combinations of service dates, service history, and odometer readings.

## Technology used

* **Frontend:** `<FRONTEND TECHNOLOGY>`
* **Backend:** `<BACKEND TECHNOLOGY>`
* **Database:** `<DATABASE OR N/A>`
* **Deployment:** `<DEPLOYMENT PROVIDER>`
* **Other material tools:** `<LIBRARIES / UI COMPONENTS / OTHER TOOLS>`

See [`LICENSES.md`](LICENSES.md) for third-party materials.

## Team contributions

| Registered member      | GitHub username   | Major contribution                                                 | Evidence                          |
| ---------------------- | ----------------- | ------------------------------------------------------------------ | --------------------------------- |
| Md. Arman Hossen Ripon | `armanhossen-dev` | Frontend development, UI and user-facing vehicle/service workflows | Frontend source files and commits |
| Bornil Mahmud          | `BornilMahmud`    | Backend development, service logic and data handling               | Backend source files and commits  |

## AI usage

The team used AI tools as development assistants. AI-generated suggestions were reviewed, adapted, tested, and integrated by the team.

* **ChatGPT** — Assisted with problem analysis, solution planning, debugging, documentation, and development guidance.
* **Claude** — Assisted with coding ideas, code review, debugging, and implementation guidance.
* **DeepSeek** — Assisted with coding, debugging, and technical problem solving.
* **Genspark AI** — Assisted with development research, implementation ideas, and productivity.

The team remains responsible for understanding, testing, and defending all submitted code and functionality.

## Major design decisions

* **Rule-based service calculation:** Service status is derived from the maintenance rule and available service history instead of relying on manually entered status values.
* **Case-based date handling:** The application's calculations use the `today` value supplied by the P09 case data where applicable.
* **Separate maintenance rule types:** Fixed-date, period-based, and distance-based rules are handled independently to make the calculations easier to verify and maintain.
* **Service history as evidence:** Previous service records are used when determining the next maintenance requirement.

## Known limitations

* The application depends on correctly structured vehicle/service data.
* Advanced vehicle telemetry or automatic odometer integration is outside the current scope.
* Notifications/reminders may depend on the deployed application's available notification infrastructure.
* The current solution is focused on the requirements and fixture format provided for P09.

## Repository records

* [`EVENT.md`](EVENT.md) — event start code and pre-event-material declaration
* [`evaluation-manifest.json`](evaluation-manifest.json) — structured judging evidence
* [`LICENSES.md`](LICENSES.md) — frameworks, libraries, templates and assets
