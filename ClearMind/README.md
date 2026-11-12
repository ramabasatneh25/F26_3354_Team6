# ClearMind

Mental wellness tracking and support for college students. Students log a daily check-in, see how
their mood and stress change over a semester, and reach campus counseling or a crisis line from any
page. Practitioners and school administrators publish the resources students are matched to.

**Team 6 — CE/CS/SE 3354 Software Engineering, Fall 2026**
Repository: https://github.com/ramabasatneh25/F26_3354_Team6
Implementation, README and demo: Kobby Frimpong · Unit test (Section 4.2): Oliver Perez

React 18 + Tailwind client, Node.js + Express API, JSON data store. Requires **Node.js 18+**.

---

## 1. Install dependencies

```bash
git clone https://github.com/ramabasatneh25/F26_3354_Team6.git
cd F26_3354_Team6
npm run install:all
```

`install:all` installs both `server/` and `client/`. Takes about a minute.

## 2. Configure environment variables

**Optional — skip this for local use.** Every variable has a working default, so the app runs with
no configuration. To change one:

```bash
cp .env.example server/.env.local     # edit as needed
```

Then either set a variable inline for a single run:

```bash
PORT=5000 npm start
```

…or load the whole file first:

```bash
# macOS / Linux
export $(grep -v '^#' server/.env.local | xargs) && npm start
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `JWT_SECRET` | `clearmind-dev-secret-change-me` | Signs session tokens. **Change before deploying.** |
| `JWT_TTL` | `7d` | Session length |
| `CLEARMIND_DATA_DIR` | `server/data` | Where the data file is written |
| `CORS_ORIGIN` | caller's origin | Restricts who may call the API |
| `AUTH_PROVIDER` | `local` | `local` (bcrypt + JWT) or `firebase` |
| `FIREBASE_PROJECT_ID` | unset | Required when `AUTH_PROVIDER=firebase` |
| `GOOGLE_APPLICATION_CREDENTIALS` | unset | Path to a Firebase service-account file |
| `VITE_API_TARGET` | `http://localhost:4000` | Where the dev client proxies `/api` |

The SDD names Firebase Auth, but `local` is the default so the project runs with no external
accounts. To use Firebase instead: `npm install firebase-admin --prefix server`, then set
`AUTH_PROVIDER`, `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS`. Only
`server/middleware/auth.js` changes behaviour; no route is affected.

## 3. Load demo data

```bash
npm run seed
```

Creates five accounts, five practitioner profiles, three UT Dallas resources, and three weeks of
check-in history so the dashboard and weekly report have data. Re-running wipes and rebuilds it.
Skip this step to start empty and register your own account.

## 4. Run it

```bash
npm run build
npm start
```

Open **http://localhost:4000**.

For development with hot reload, use `npm run dev` instead and open **http://localhost:5173**
(API on 4000, client on 5173, `/api` proxied). Stop either with `Ctrl + C`.

---

## Demo accounts

Password for all: **`ClearMind2026`**

| Role | Email |
|---|---|
| Student | `student@utdallas.edu` |
| Practitioner | `practitioner@clearmind.app` |
| School admin | `admin@utdallas.edu` |

**To see the crisis alert:** submit a check-in with mood ≤ 2 or stress ≥ 9. It is deliberately
unskippable — no close button, Escape does nothing, focus is trapped until acknowledged.

## Tests

```bash
npm test
```

55 tests, 4 suites:

| Suite | Covers |
|---|---|
| `crisisService.test.js` | **Deliverable #2 Section 4.2** — 12 cases over `assessRisk`, equivalence partitioning and boundary values on `MOOD_THRESHOLD = 2`, `STRESS_THRESHOLD = 9` |
| `reportGenerator.test.js` | Weekly report window, comparisons, empty and stale states |
| `connections.test.js` | FR-7 privacy boundaries — what a practitioner must *not* see |
| `api.test.js` | End-to-end API: auth, consent, roles, every FR, export and deletion |

`assessRisk` is imported from `server/services/crisisService.js` — the same function the live
check-in route calls, not a copy. Tests use a temporary directory and never touch your data file.

## What's implemented

| Req | Requirement | Where |
|---|---|---|
| FR-1 | Log mood, thoughts, wellness metrics | `pages/CheckIn.jsx`, `routes/checkins.js` |
| FR-2 | Personalized feedback per check-in | `services/feedbackEngine.js` |
| FR-3 | Review previous check-ins | `pages/Dashboard.jsx` |
| FR-4 | Weekly reports and trends | `services/reportGenerator.js` |
| FR-5 | Tailored practitioner recommendations | `services/recommendationService.js` |
| FR-6 | Immediate crisis resources | `services/crisisService.js`, `components/CrisisOverlay.jsx` |
| FR-7 | Practitioners publish services and find opted-in students | `routes/connections.js`, `pages/Provider.jsx` |
| FR-8 | Schools connect students to campus resources | `routes/resources.js` |

Alternate flows implemented, not stubbed: UC-1 A1 (crisis alert before feedback), UC-1 A2 (failed
save keeps the entry), UC-2 A1 (date filter), UC-2 A2 (delete one, delete all, export), UC-2 A3
(report withheld until enough data), UC-3 A1 (campus resources ranked first), UC-3 A2/A3 (crisis
numbers always present as `tel:`/`sms:` links), UC-4 A1 (CSV/JSON bulk import), UC-4 A2 (invalid
rows named, nothing published).

Non-functional requirements that shaped the code: auth verified server-side on every route with
queries scoped to the caller (**Security**); a practitioner sees a first name, school and the areas
a student typed — never a check-in, score or email before acceptance; consent collected at
registration before anything is stored (**Ethical**); atomic writes and a form that survives a
failed submit (**Reliability**); export and erase from the My data page plus an access log
(**Legislative Privacy/Security**); visible keyboard focus, `prefers-reduced-motion`, responsive to
phone width (**Usability/Environmental**).

Measured at 25 concurrent users: 900 requests, 0 errors, p90 61 ms against the 2 s budget;
253 bytes per check-in against the 10 KB budget.

## Structure

```
F26_3354_Team6/
├── README.md
├── .env.example                  every variable, documented
├── package.json                  scripts for both halves
├── scripts/dev.mjs               runs both servers for `npm run dev`
├── server/                       Node.js + Express
│   ├── server.js  db.js  seed.js
│   ├── middleware/auth.js        local JWT or Firebase verification
│   ├── routes/                   auth, checkins, reports, resources,
│   │                             connections, account
│   ├── services/                 crisisService, feedbackEngine,
│   │                             reportGenerator, recommendationService
│   └── tests/                    4 suites (see above)
└── client/                       React + Tailwind (Vite)
    └── src/  App.jsx  api.js  context/  components/  pages/
```

`services/` maps one-to-one onto the Services package in the class diagram (SDD 2.5.2), which is
why `assessRisk` could be unit tested in isolation. Routes are grouped by purpose; each file names
the requirements it serves at the top.

## Known limitations

- Data lives in a JSON file, not a database. Fine for one process and the ~100 students in the
  Space NFR; it would not survive horizontal scaling.
- `AUTH_PROVIDER=local` is the default. Firebase is implemented but not what runs out of the box.
- TLS is terminated by the host. Locally you are on plain HTTP.
- Connection requests are in-app only — no email or push, so a student sees one next time they open
  the Support page.
- Feedback is rule-based, not a model. Deliberate: the Ethical NFR rules out anything resembling a
  diagnosis.
- Verified in Chromium. The CSS is standard and includes `-webkit` and `-moz` slider styling, but
  Safari, Firefox and Edge are untested.

## Troubleshooting

| Problem | Fix |
|---|---|
| `EADDRINUSE :::4000` | `PORT=5000 npm start` |
| `Cannot GET /` | Client not built — run `npm run build` first, or use `npm run dev` on port 5173 |
| Everything returns 401 | Session expired or data re-seeded — sign in again |
| Dashboard is empty | New account has no check-ins — log some, or `npm run seed` and use the demo student |
| Want to start over | `npm run seed` wipes and rebuilds; delete `server/data/clearmind.json` to start empty |

---

ClearMind is a course project and a wellness tool. It does not diagnose conditions and does not
replace professional care or emergency services. If you are in crisis, call or text **988** or
**911**.
