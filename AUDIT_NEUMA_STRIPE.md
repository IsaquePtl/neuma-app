# Neuma audit — `neuma-stripe` vs production `main`

**Date:** 28 Sep 2026  
**Branch audited:** `neuma-stripe` @ `0ef3e02`  
**Production:** Vercel project `neuma-app`, production deployment of `main` @ `c7f9510` (“chore: redeploy production with Stripe test billing env”), domain `www.comunidadeneuma.com`  
**Database:** Supabase `gkxvlduobwvwarqfxyuh` (single project; this is production)  
**This document lives on:** `cursor/audit-neuma-stripe-findings-c17c` (draft findings PR into `neuma-stripe`, not into `main`)

## Executive summary

**Do not merge to `main`. Do not deploy.**

`neuma-stripe` is two commits ahead of production (`859e77d` path gates, `0ef3e02` seed/lint fix) and is missing the signup rate-limit fix that is already on `main` (`2955c95`). The gate migration is **already applied** to the production database (`teoria_musical_path_pass_rule`, 17 Sep 2026). Production code does not read `pass_rule`. Shipping this branch is what turns those columns into student-facing behavior.

The new student self-advance (`markNodeSeen` and quiz auto-advance) **does not persist**. Both call `completeCurrentAndActivateNext` with the student session. RLS on `nodes` and `paths` is select-only for students, and the helper ignored the update result, so the write matches zero rows and the UI can still say the next level is unlocked. Mentor “Avançar nível” works, because mentors have `nodes_mentor_all`. Approving a check-in also advances, on a separate code path that does not use this helper.

This findings branch makes that helper write with the service role **after** the caller has proven the node is visible, and it throws if a write fails. That matches the intended design. It is **not** a reason to deploy: once writes succeed, the only active path (`E2E 30 — Teoria Musical (Ana)`, current node `D5 — Pentatónica`, `pass_rule = none`) becomes a self-serve “Marcar como visto”, and the next node is a real quiz (`MF`) that auto-advances. Twenty live milestone nodes already have `pass_rule = quiz` and real questions, and students can read `correct_option_id` through the Data API.

Stripe on production is still the test billing setup from the latest `main` deploy. Nine of eleven students are `billing_exempt`. One student created on or after the cutoff has no subscription. Do not turn on live Stripe keys in the same change as this branch.

## What was checked

- Diff of `neuma-stripe` against `origin/main` (both directions).
- Server actions for auth, billing access, quiz, check-ins, level advance, feedback approval, path-template apply, Teoria Musical seed, and the Stripe webhook.
- RLS in repo migrations, then the live policies and data on `gkxvlduobwvwarqfxyuh` (read-only SQL).
- Vercel production deployment identity, env **names** and targets, and deployment protection. Secret values are marked sensitive and were not returned decrypted.
- `tsc --noEmit` in `apps/web` (pass). `npm run lint` (fail: 56 errors, 10 warnings, pre-existing; no GitHub Actions workflow). Playwright was not run. No logged-in browser pass.

## Delta vs what production runs

| | Production `main` | `neuma-stripe` |
| --- | --- | --- |
| App commit | `c7f9510` | `0ef3e02` (does not contain `2955c95`) |
| Signup | Admin `createUser` + `email_confirm: true`, avoids Supabase’s 2 emails/hour confirm-email cap | Still `auth.signUp`, which hits that cap |
| Path gates | UI ignores `pass_rule` (columns already exist in the DB) | Student UI and actions honor `pass_rule` |
| Billing | Already in production from PR #1, test-mode env per the deploy message | Same billing code; this branch does not change it |

A **normal merge** of `neuma-stripe` into `main` keeps the signup fix, because the two new commits do not touch `apps/web/lib/actions/auth.ts`. Pointing production at this branch, or resetting `main` to it, **drops** that fix and signup returns to “email rate limit exceeded”.

## Critical

### C1. Student “visto” and quiz auto-advance are silent no-ops

- **Area:** Student path UX / RLS  
- **Evidence:** `apps/web/lib/nodes/complete-and-activate.ts` (before this findings commit) updated `nodes` and `paths` with the caller’s Supabase client and did not check errors. Callers: `markNodeSeen` and `submitQuizAttempt` (`apps/web/lib/actions/journey-level.ts`, `apps/web/lib/actions/quiz.ts`). Live policies: `nodes_student_select` and `paths_student_select` are `SELECT` only; `nodes_mentor_all` / `paths_mentor_all` are the only writes. Confirmed on the live database.  
- **Impact:** On Ana’s active lesson the new button “Marcar como visto” appears to run, then the same node stays active. A passing quiz sets `unlocked: true` and the result copy says the next level is open (`apps/web/components/checkpoint-quiz-form.tsx`) even though the node never moved. The quiz attempt itself is saved (students may insert `node_quiz_attempts`).  
- **Fix on this branch:** After the caller-scoped read (RLS still proves the student can see that node), writes go through `createAdminClient()`, and a failed write throws. Mentor advance uses the same helper, so it keeps working.  
- **Still required before any deploy:** accept the product change in C2, and close the quiz answer leak in H1. Turning the writes on is what makes those issues real.

### C2. The migration is already live, and it already changed every existing node

- **Area:** Migrations / student path  
- **Evidence:** Remote migration `teoria_musical_path_pass_rule` (`20260917183754`). Repo file `apps/web/supabase/migrations/0037_teoria_musical_path.sql` backfills `practice → check_in` and `lesson|resource → none`, leaving `milestone` and `call` at `mentor` unless something else set `quiz`. Live counts:

  | kind | pass_rule | nodes |
  | --- | --- | --- |
  | lesson | none | 56 (1 active: `D5 — Pentatónica`) |
  | resource | none | 1 |
  | practice | check_in | 21 (1 completed: `D4`; 14 text, 7 video) |
  | milestone | quiz | 20 (60 real questions, not the skeleton) |
  | milestone | mentor | 2, **zero** questions (includes `MG — Check-point: tríades (mentor)`) |
  | call | mentor | 6 |

- **Impact:** Production UI still shows a lesson check-in (“Confirmar que concluíste”) and only the mentor moves the path. After this branch, those 56 lessons offer “Marcar como visto” and, once C1 is fixed, the student finishes them alone. The comment in `0037` says this preserves current meaning. It does not: on `main`, a lesson check-in does not self-advance.  
- **Paths in the database now:** 1 active, `E2E 30 — Teoria Musical (Ana)`; 3 drafts, `DJ → guitarra (1:1)`, `Piano estruturado (1:1)`, `Teoria no braço (1:1)`. On the active path, nodes before `D5` are `locked`, not `completed` (`D4` is the only `completed` node). “Marcar como visto” on `D5` completes `D5` and activates `MF — Check-point: pentatónica`. It does not reopen A–C.  
- **Suggested fix:** Do not re-run `0037` on production (the `UPDATE … WHERE pass_rule = 'mentor'` would undo a mentor who set a lesson back to mentor). Before deploy, confirm in Studio that Ana’s current node and the three drafts should behave as the table above. If lessons on the live path should stay mentor-gated, set those rows back to `mentor` **before** shipping the UI.

## High

### H1. Quiz answers are readable by the student, and this branch makes the score a gate

- **Area:** RLS / quiz  
- **Evidence:** `0015_checkpoint_quiz.sql` policy “Students read own node_quiz_questions” is `SELECT` on the whole row, including `correct_option_id`. `listQuizQuestions` in `apps/web/lib/actions/quiz.ts` returns that column to any logged-in user who passes RLS. `getQuizForStudent` strips it, but the Data API and the other server action do not. `MF` already has three real prompts (“A pentatónica tem…”, and two more).  
- **Impact:** On `main` the quiz is score-only, so this is cheating at a worksheet. On this branch, `pass_rule = quiz` plus a passing score calls the advance helper. A student can read the key and unlock the next node. Stripping the field in one server action is not enough while the column stays on the authenticated select policy.  
- **Suggested fix:** Move `correct_option_id` to a mentor-only table (or a security-definer RPC). Keep scoring on the server. Do this before any quiz node is a gate in production.

### H2. Mentor-only quiz copy tells the student a score is required

- **Area:** Student quiz UX (the known MG note)  
- **Evidence:** `submitQuizAttempt` always returns `pass_score: quizPassScore(node.pass_score)`, which defaults to 60 even when `pass_rule` is not `quiz` (`apps/web/lib/actions/quiz.ts`). `CheckpointQuizForm` then prefers “Precisas de 60% para avançar” whenever `score < pass_score`, and only afterwards says the mentor validates the level (`apps/web/components/checkpoint-quiz-form.tsx`). `CheckpointQuiz` on the level page is correct: if `quizGate` is false it says the quiz does not block (`apps/web/components/checkpoint-quiz.tsx`).  
- **Impact:** `MG` is `pass_rule = mentor` and currently has **no** questions, so the student hits “Este check-point ainda nao tem perguntas” if they open it. The false threshold copy appears as soon as a mentor-only milestone has questions and the student scores under 60. The level page and the result screen disagree.  
- **Suggested fix:** Return `pass_score` only when `nodeUsesQuizGate` is true. If there are no questions, don’t offer “Abrir quiz” (or say the mentor has not published it).

### H3. Student paywall cutoff is invisible to the student session

- **Area:** Billing / RLS  
- **Evidence:** `getAccessState` reads `finance_settings.paywall_start_at` with the user client (`apps/web/lib/billing/access.ts`). Live RLS on `finance_settings` is `finance_settings_mentor_all` only. A blocked read becomes `data = null`, and a null cutoff is treated as grandfathered (`hasAccess: true`). The SQL function `has_app_access()` is security definer and **can** see the row, but the Next.js layout never calls it.  
- **Live data:** `paywall_start_at = 2026-09-01T00:00:00Z`, `past_due_grace_days = 7`. Profiles: 1 mentor, 11 students, 9 `billing_exempt`, 7 students created on or after the cutoff, **1** non-exempt post-cutoff student with no `active` / `trialing` / `past_due` subscription. Subscriptions in the table: active annual, active quarterly, active `one_to_one`, plus three canceled.  
- **Env:** Production Vercel has `NEUMA_BILLING_ENABLED` and `NEUMA_PAYWALL_START_AT` (production target only). The API did not decrypt them. The code uses the env var first. If that value is a real timestamp, the RLS hole does not matter in production. If it is empty or invalid, **nobody is paywalled**, including the one student the database cutoff would block.  
- **Suggested fix:** Read `paywall_start_at` with the service role (or call `has_app_access`). Don’t treat “I couldn’t read the setting” as “everyone is grandfathered”.

### H4. Paywall is a layout redirect, not a check inside actions

- **Area:** Auth / billing  
- **Evidence:** Only `apps/web/app/(student)/layout.tsx` redirects to `/subscrever`. `markNodeSeen`, `submitQuizAttempt`, `submitCheckIn`, and billing server actions do not call `getAccessState`. Middleware (`apps/web/lib/supabase/middleware.ts`) checks the session, not access.  
- **Impact:** A student who fails the paywall can still invoke those actions if they can reach the action endpoint. Today this matters for at most one account, and only if billing is actually on.  
- **Suggested fix:** Call the same access helper at the start of student mutations.

### H5. Approving a check-in advances the path without looking at `pass_rule`

- **Area:** Mentor Studio / check-ins  
- **Evidence:** `submitFeedback` in `apps/web/lib/actions/feedbacks.ts`, when `approved` is set, marks the check-in’s node completed and the next node active. It does not use `completeCurrentAndActivateNext`, does not lock other non-completed siblings, and does not read `pass_rule`. `submitCheckIn` on this branch rejects nodes that are not `pass_rule = check_in`, so new submissions are gated. Older pending check-ins are not.  
- **Impact:** Approving a leftover check-in on a lesson, quiz, or call still moves the path. Two advance implementations can also leave two `active` nodes. The session page loads the active node with `maybeSingle()`; two rows make that query fail and the hub loses “nível actual”. This path exists on `main` already; the new gates make the mismatch sharper. The Studio label “Check-in — mentor aprova o envio” (`node-gate-fields.tsx`) matches the happy path only.  
- **Suggested fix:** On approve, advance only when `pass_rule = check_in`, and call the same helper as mentor “Avançar nível”.

### H6. Shipping this branch by replacing `main` regresses signup

- **Area:** Auth  
- **Evidence:** `git diff HEAD...origin/main -- apps/web/lib/actions/auth.ts`. Production uses `admin.auth.admin.createUser({ email_confirm: true })` then `signInWithPassword`. This branch still calls `supabase.auth.signUp`, which sends Supabase’s confirm-email and hits the built-in 2/hour limit (the bug PR #2 fixed).  
- **Impact:** Replacing production with this branch brings “email rate limit exceeded” back. A merge commit into `main` does not.  
- **Suggested fix:** Merge `main` into the branch (or open the product PR against `main` so Git merges both sides). Do not reset `main`.

### H7. Test-mode Stripe data already lives in the production database

- **Area:** Stripe  
- **Evidence:** Latest production deploy message is explicit: “Stripe test billing env”. `isStripeTestMode()` exists in `apps/web/lib/stripe/client.ts` and is **never used**, so Finanças has no test-mode banner. Webhook sync (`apps/web/lib/stripe/sync.ts`, `apps/web/app/api/stripe/webhook/route.ts`) writes subscriptions into this same Supabase project. Access is decided from those rows, not by asking Stripe on each request.  
- **Impact:** An `active` row created under test keys grants access even after a future switch to `sk_live_`. Live customers will not match test customer ids. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are production-target only; a preview of this branch has no Stripe.  
- **Suggested fix:** Keep test keys until billing is an intentional launch. Before any live key: archive or delete test `subscriptions` / `payments` / `billing_customers`, point the webhook at the live endpoint secret, and show a banner when `isStripeTestMode()` is true. Do not do that in the path-gate deploy.

## Medium

### M1. Gate UI is tied to node kind, not only to `pass_rule`

- **Area:** Student path  
- **Evidence:** `StudentNodePlayer`: check-in and “Marcar como visto” render for lesson, resource, and practice. The quiz block renders only for `milestone`. `call` uses `SessionLayout`, which has no student completion control. Studio still offers every `pass_rule` on every kind (`node-gate-fields.tsx`).  
- **Impact:** A lesson set to `quiz`, or a call set to `none`, has no control that completes it. The student waits for the mentor. The Teoria Musical skeleton happens to use the combination the UI implements (lesson `none`, practice `check_in`, milestone `quiz`, call `mentor`).  
- **Suggested fix:** Drive the player off `pass_rule`, or reject illegal kind/rule pairs in the editor.

### M2. “Rascunho Teoria Musical” rewrites a template with that title

- **Area:** Mentor library  
- **Evidence:** `upsertTeoriaMusicalTemplate` finds a non-archived template titled `Teoria Musical`, overwrites matching `node_code` rows (title, description, `pass_rule`, skeleton quiz), and **deletes** nodes whose code is not in the skeleton. The live template of that name is `archived`, so the first click creates a new draft and does not touch the archive, the library, or students. A second click edits that new draft.  
- **Impact:** If someone un-archives the old template, or names a real template “Teoria Musical”, one click wipes mentor edits.  
- **Suggested fix:** Always insert a new draft with a distinct title, or refuse when a template with that title already has nodes.

### M3. `one_to_one_access_until` exists in production and nowhere in the repo

- **Area:** Schema drift  
- **Evidence:** Column on `public.profiles` (`timestamptz`, nullable). Remote migration name `guard_one_to_one_access_until` (`20260923083345`). No match in this repo. Generated `database.types.ts` does not list the column. All profile values are null. There is no trigger by that name; profile triggers are `guard_profile_privileged_columns` and `profiles_guard_mentor_id`.  
- **Impact:** App code cannot enforce a 1:1 end date. A database rebuilt from `apps/web/supabase/migrations` will not have the column. Regenerating types from production will produce a diff the repo does not expect.  
- **Suggested fix:** Add the column to a repo migration and types, and decide whether access should actually expire. Until then, treat the column as unused.

### M4. Preview deploys talk to production data, and several secrets are production-only

- **Area:** Deploy / env  
- **Evidence:** `NEXT_PUBLIC_SUPABASE_URL`, anon key, and `SUPABASE_SERVICE_ROLE_KEY` target preview **and** production. `NEUMA_BILLING_ENABLED`, `NEUMA_PAYWALL_START_AT`, `STRIPE_*`, and all `R2_*` target production only. Password protection and SSO protection are off on the Vercel project.  
- **Impact:** A preview of `neuma-stripe` is a public URL with the service role on the production project (seed button, path edits, check-in side effects). Billing and video upload will not match production. There is no Deployment Protection to hide that URL.  
- **Suggested fix:** Turn on Vercel deployment protection for preview. Do not put the production service role on preview, or point preview at a different Supabase project.

### M5. Repo migration history and remote history are different tracks

- **Area:** Migrations  
- **Evidence:** Repo files are `0001_init.sql` … `0037_teoria_musical_path.sql`. Remote `schema_migrations` uses timestamp names (`tally_intake`, `schema_catchup_and_path_library`, `teoria_musical_path_pass_rule`, …). `0035` / `0036` billing content is present as tables, not as those filenames. `node_duration_weeks` appears twice remotely.  
- **Impact:** `supabase db push` from this repo can try to apply `0037` again. The SQL is mostly idempotent, but the backfill `UPDATE` is not safe if mentors have customized `pass_rule` (see C2).  
- **Suggested fix:** Treat production as already migrated. Do not push `0037` again. Reconcile the repo history before the next migration.

### M6. Node create/update ignores Postgres errors

- **Area:** Mentor path editor  
- **Evidence:** `createNode` / `updateNode` in `apps/web/lib/actions/nodes.ts` do not check `error` on the insert/update.  
- **Impact:** A bad `check_in_kind`, a missing column, or an RLS failure looks like a successful save.  
- **Suggested fix:** Throw on `error`, same as quiz and template saves.

### M7. `npm run lint` fails; nothing runs it in CI

- **Area:** Build  
- **Evidence:** `tsc --noEmit -p apps/web/tsconfig.json` passed. `npm run lint` reported 66 problems (56 errors, 10 warnings), mostly `react-hooks/set-state-in-effect`, plus `prefer-const` in `cal-bookings.ts`, `invites.ts`, `one-to-one.ts`, `tally.ts`, chord code. No `.github/workflows`. `npm audit` reports 1 critical and 9 high (including `next@16.2.10`: middleware/proxy bypass and a server-action DoS advisory). Not exploit-checked against this app.  
- **Impact:** Lint does not block Vercel. The Next advisory is worth a planned upgrade, not a reason to hold the path-gate decision by itself.  
- **Suggested fix:** Don’t boil the ocean in this PR. Schedule a Next patch and decide whether lint is a required check.

## Low

### L1. Advance is not transactional

`completeCurrentAndActivateNext` still does one update per sibling. A failure mid-loop can leave two active nodes or a completed node with no successor. The findings fix at least surfaces the error instead of swallowing it.

### L2. `submitMentorshipMessage` is unused

Defined in `apps/web/lib/actions/checkins.ts`, no UI caller. It inserts a `text` check-in with no `pass_rule` check. If it is wired up later, approving that feedback hits H5 and advances the node.

### L3. `isStripeTestMode` is dead code

No Finanças banner. See H7.

### L4. Skeleton quiz is an answer key

`teoriaSkeletonQuiz` in `apps/web/lib/teoria-musical/curriculum.ts` tells the student to pick “Pronto”. That is fine for an empty draft. Do not apply a skeleton template onto Ana’s path: her checkpoints already have real questions.

### L5. E2E smoke does not cover gates, billing, or RLS

`apps/web/e2e/smoke.spec.ts` only checks that public routes return a non-500. It does not log in.

## Known acceptable risks vs regressions

**Acceptable on production today (do not “fix” by deploying this branch):**

- Stripe test keys and test subscription rows in the production database, as long as live keys are not introduced casually. The latest production deploy says this is intentional.
- `paywall_start_at` in the database with most students `billing_exempt`.
- `one_to_one_access_until` all null.
- Deployment protection off, if preview URLs are not being shared. It becomes a problem the moment this branch gets a Vercel preview (M4).

**Already on `main`, not introduced here:**

- Signup rate-limit fix (keep it).
- Billing module, webhook idempotency, invoice-before-subscription sync (`syncInvoice` calls `syncSubscription` when `plan` is missing).
- Check-in approval advancing the node without sibling locking (H5).
- Quiz `correct_option_id` on the student select policy (H1). Severity goes up only when quiz becomes a gate.
- Lint errors and the Next advisory (M7).

**New if this branch ships:**

- Lessons self-complete; practices stay check-in; quiz milestones auto-advance; calls stay mentor-only (C2, C1).
- False quiz threshold copy on mentor-only checkpoints (H2).
- Teoria Musical draft seed button (M2).
- Signup regression **only** if production is moved onto this branch instead of merging into `main` (H6).

## Code change on this findings branch

`apps/web/lib/nodes/complete-and-activate.ts`

- Caller client: read the node (RLS). If the student cannot see it, throw.
- Service role: complete the node, activate the next, lock other non-completed siblings, or complete the path.
- Throw on any write error.

No schema change. No billing change. No deploy.

## Live E2E after a future merge (not done here)

Do these on a **non-production** database, or on the Ana path only after Isaque accepts C2. Production Supabase is the only database.

1. Signup with a fresh email: account is created and a session starts, with no “email rate limit exceeded”. Confirm the `main` auth fix is in the deployed commit.
2. Student created after the cutoff, not exempt, no subscription: redirected to `/subscrever`. Exempt student and mentor are not. Grandfathered student (created before the cutoff) is not.
3. Settings during `past_due` grace: card update copy matches reality. After grace, access ends.
4. Ana path, lesson `D5`: “Marcar como visto” completes `D5` and opens `MF` only. Reload `/path`, `/session`, and the Studio journey and confirm a single `active` node.
5. `MF` quiz: failing score does not advance; passing score does. Confirm the student cannot read `correct_option_id` from the browser (H1 must already be fixed).
6. `MG`: copy says the mentor advances, including when the score is under 60. No “Precisas de N% para avançar”.
7. Practice `check_in` text (for example `E2`) does not consume a video slot. Video practice does. Submitting does **not** advance. Mentor approve advances once, and does not leave two active nodes. Mentor “needs revision” does not advance.
8. Call node: student can book if `can_book_sessions`; student cannot self-complete.
9. Draft 1:1 paths stay draft until the mentor applies them. Seed “Rascunho Teoria Musical” does not archive, edit, or assign those drafts.
10. Studio Finanças still shows test-mode data. No live charge. Webhook retry does not duplicate a payment (`stripe_events`).
11. Preview URL, if any, is behind deployment protection and is not using the production service role.

## Recommendation

**Merge to `main` and deploy now? No.**

Ship only when all of the following are true:

1. C1’s service-role write is in the commit that deploys (it is on this findings branch).
2. H1 is fixed (quiz keys are not on the student select policy).
3. H2 is fixed (mentor-only quiz copy).
4. Isaque has looked at Ana’s active node `D5` and the three 1:1 drafts and accepted the `pass_rule` values already stored.
5. The deploy is a merge into `main`, so `2955c95` stays. Production is not retargeted at `neuma-stripe`.
6. Stripe stays in test mode. Live keys are a separate launch.
7. The E2E list above is run against the deployed commit before calling the path gates done.

Until then, production `main` is the safer app: billing stays as it is, and students cannot silently skip a level that the new UI claims to unlock.
