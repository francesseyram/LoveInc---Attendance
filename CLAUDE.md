# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Love Inc Global church attendance system (Christian fellowship at Ashesi University, Ghana). React 18 + Vite SPA with Firebase (Firestore + Auth) as the entire backend — there is no server code, no build step beyond Vite, and no test suite.

## Commands

```bash
npm install                  # or: npm run install:fast (skips audit/fund; .npmrc already sets this)
npm run install:ci           # clean install from lockfile
npm run dev                  # Vite dev server on :5173, auto-opens browser
npm run build                # → dist/
npm run preview              # serve the production build locally

firebase deploy --only firestore:rules   # after editing firestore.rules
firebase deploy                          # hosting + rules (build first)

node scripts/seed-members.mjs            # dry run — roster import, reports only
node scripts/seed-members.mjs --commit   # writes; idempotent, skips existing studentIds

npm run dev:sandbox                      # dev against .env.sandbox (loveinc-attendance-sbx)
npm run build:sandbox
SEED_ENV_FILE=.env.sandbox node scripts/seed-members.mjs --commit
node scripts/seed-demo-data.mjs          # sandbox-only demo services + attendance
```

`.env` is production; `.env.sandbox` is the throwaway project. Vite picks the latter up via
`--mode sandbox`. Do feature work against the sandbox.

Requires a `.env` (copy `.env.example`). All Firebase keys are `VITE_`-prefixed and read in [src/firebase/config.js](src/firebase/config.js). `VITE_APP_DOMAIN` is only used to build QR check-in URLs; it falls back to `window.location.origin`.

There is no linter, formatter, or test runner configured. Verify changes by running `npm run dev` against a real Firebase project.

**The configured project `love-inc-global` is production.** It holds 375 real members —
names, phone numbers, emails, birthdays — imported from the church roster. Feature work
that creates test services or test check-ins pollutes live attendance data. Point `.env`
at a sandbox project for that, and treat any write script as production-affecting by
default. Deletes need the Firebase CLI: `firestore.rules` requires auth to delete, and
the client SDK runs unauthenticated in these scripts.

## Architecture

**Two audiences, one SPA.** `/checkin` is fully public (no auth, no login) — it is what QR codes point at. Everything under `/admin` is behind [ProtectedRoute](src/components/ProtectedRoute.jsx). `/` and any unknown path redirect to `/checkin`.

**All Firestore access goes through [src/firebase/](src/firebase/)** — `members.js`, `services.js`, `attendance.js`. Pages and components never import `firebase/firestore` directly. Keep new queries in those modules.

**Three collections**, joined by ID on the client (no Firestore joins):
- `members` — `studentId` is the natural key used at check-in and **holds the member's phone number** in canonical `+233XXXXXXXXX` form (see "Members are keyed by phone" below); `email` links a member row to a Firebase Auth account; `role` drives all UI gating.
- `services` — at most one has `isActive: true`. `createService` and `setActiveService` both use a `writeBatch` to clear the flag on every other service first. `completeService` sets `isCompleted` and clears `isActive`.
- `attendance` — one doc per (`memberId`, `serviceId`) pair, with `isNew` marking first-timers.

**No composite indexes.** Attendance queries deliberately use a single `where` and sort client-side (see the comments in [attendance.js](src/firebase/attendance.js)). Adding an `orderBy` alongside a `where` there would require deploying a Firestore index — sort in JS instead.

**Name search is a full-collection fetch, cached per session** — `searchMembersByName`
in [members.js](src/firebase/members.js). Firestore prefix range queries were tried and
rejected: they only match the *start* of a field, so "arthur" missed "Caleb Akwesie Arthur",
and this roster is full of compound surnames people search by the second half of. Call
`invalidateMemberSearchCache()` after creating a member. The public check-in page therefore
downloads the roster — `members` is already world-readable per `firestore.rules`, so this
adds no exposure that the public API key didn't already allow, but tightening member reads
is the fix if that matters.

**Attendance analysis** lives in [analytics.js](src/firebase/analytics.js): one full read of
each collection, everything else computed in JS by `buildAnalytics()`. `INACTIVE_AFTER_MISSED_SERVICES`
(3) and `ACTIVITY_RULE_LABEL` are exported together so the rule shown in the UI can't drift
from the rule the code applies. Rendered by [AttendanceAnalysis.jsx](src/components/AttendanceAnalysis.jsx).

**Check-in entry points.** `/checkin?s={serviceId}` is what QR codes carry; a bare `/checkin`
falls back to `getActiveService()`. Adding `&kiosk=1` switches to shared-device behaviour —
the success screen auto-resets after 6s so the next person can walk up.

**Live attendance** uses `subscribeToServiceAttendance` (`onSnapshot`); the Admin "Live" tab subscribes and must return the unsubscribe from its effect. Everything else is one-shot `getDocs`.

### Members are keyed by phone

The 375 members imported from the church roster had no Ashesi student IDs, so `studentId`
holds the **normalized phone number** instead. `normalizePhoneKey()` in
[members.js](src/firebase/members.js) is the single place that canonicalizes input —
`0207672476`, `207672476`, and `(+233) 207 672 476` all resolve to `+233207672476`.
Every lookup path (`getMemberByStudentId`, `studentIdExists`, `createMember`) runs input
through it, so **never query `studentId` with a raw user string**. The check-in page asks
for a phone number, not a student ID; `auth-{uid}` staff ids bypass normalization untouched.

Roster members also carry `cohort` (`C2022`–`C2029`, the Ashesi class year) and `hostel`.

`birthday` holds a full `YYYY-MM-DD` only when the year is genuinely known (139 members).
Most of the roster recorded only a day and month, which lives in **`birthdayMD`** (`'MM-DD'`).
Render both through `formatBirthday()` rather than `new Date(member.birthday)` — that
throws `Invalid Date` on a `birthdayMD` value. Do not backfill a placeholder year.

Re-import with `node scripts/seed-members.mjs` (dry run) / `--commit`. It is idempotent,
skipping any `studentId` already present. `scripts/members-seed.json` and
`members_for_review.csv` hold real member PII and are gitignored.

### Auth ↔ member sync

Admins are created by hand in the Firebase Auth console and have no `members` row. On sign-in, [App.jsx](src/App.jsx) resolves the user's role by email and, if missing, calls `ensureMemberForAuthUser` to create a row with `role: 'admin'` and a synthetic `studentId` of `auth-{uid}`. That row is written with `setDoc` **keyed by uid**, not `addDoc` — two concurrent sign-ins otherwise both see "no row yet" and create duplicates, which previously made one admin's role flip between `admin` and `superadmin` between sessions. For the same reason `getMemberByEmail` resolves to the **highest-privilege** matching row rather than `docs[0]`, whose order Firestore does not guarantee. Use `isStaffAccountStudentId` / `formatStudentIdForDisplay` when rendering student IDs so those synthetic ids never leak into the UI. The resolved role is exposed as `memberRole` from `useAuth()`; `user` alone only proves someone is signed in, not what they may do.

### Role rules

`member` < `leader` < `admin` < `superadmin`. Authorization is **client-side only** — [validateRoleAssignment](src/firebase/members.js) is the single source of truth (superadmin assigns anything; admin may only set `member`/`leader` and only on targets who are already `member`/`leader`; leaders and members cannot assign). Superadmin-only actions in the UI (deleting a service) gate on `memberRole === 'superadmin'`, not on `user`.

`firestore.rules` is intentionally permissive — `members`, `services`, and `attendance` are publicly readable and creatable so the unauthenticated check-in page works. The rules do **not** enforce the role hierarchy; only the client does. Any new privileged operation needs its own `memberRole` check in the UI.

## Styling

Tailwind, with every color defined as space-separated RGB channels in CSS variables in [src/styles/index.css](src/styles/index.css) and mapped to semantic names (`gold`, `surface`, `brand-*`) in [tailwind.config.js](tailwind.config.js). This is what lets `bg-gold/10` opacity modifiers work — never hardcode hex values in components.

Two themes swap those variables: dark is the `:root` default (gold `#C9A84C` on `#0A0A0A`), light is `.light-theme` on `<html>` (purple `#7C3AED`). The theme lives in `ThemeContext` in App.jsx, persists to `localStorage` under `lig-theme`, and defaults to **light**. Recharts can't read CSS variables, so Admin.jsx has a `useChartColors()` hook holding literal hex values for both themes — keep it in sync if the palette changes.

Reusable classes (`.card`, `.btn-gold`, `.input`, `.badge-*`, `.data-table`, `.tab-btn`) are defined in `@layer components` in index.css. Prefer them over ad-hoc utility stacks. Fonts: Cormorant Garamond for headings (`font-display`/`font-heading`), DM Sans for body — loaded from Google Fonts in [index.html](index.html).

Logos in `public/` are theme-dependent: `global_white_png.png` on dark, `global_black.png` on light (and inside QR codes).
