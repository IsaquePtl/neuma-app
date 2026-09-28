# Neuma Stripe — exhaustive E2E audit

Branch audited: `neuma-stripe` (base). Fixes, if any, live on `cursor/neuma-stripe-e2e-audit-3f45`.

Date: 2026-09-28. Method: full route manifest from `next build`, code trace of every page, then real role round-trips against the live Neuma App database (project `gkxvlduobwvwarqfxyuh`) inside a single transaction that was rolled back. A follow-up read confirmed zero leftover audit users, the quiz SELECT policy still present, and `paywall_start_at` restored. No browser session was possible: this environment has no app `.env.local`, no Stripe keys, and no GoTrue passwords, and the test did not commit users or Checkout sessions.

There is no separate `admin` role. Studio **is** the mentor/admin surface (`profiles.role` is only `mentor` | `student`).

---

## Executive summary

**Verdict: do-not-ship.**

Do **not** merge this work to `main`. Do **not** deploy.

The student journey “mark lesson seen” and “pass quiz → unlock next node” was a silent no-op: students have `SELECT` only on `nodes` and `paths` (`0001_init.sql`), and `completeCurrentAndActivateNext` ignored the empty update. A student could tap **Marcar como visto** or finish a quiz and the level would stay active. The paywall cutoff stored in `finance_settings.paywall_start_at` was also invisible to students (no `SELECT` policy), so with `NEUMA_BILLING_ENABLED=true` and no `NEUMA_PAYWALL_START_AT` every student was grandfathered. Quiz answer keys were readable by the student session (`correct_option_id` on a student `SELECT` policy, and `listQuizQuestions` returned them to any logged-in user).

Those three are fixed on `cursor/neuma-stripe-e2e-audit-3f45` and are **not** live-verified. They are not enough to ship. Still open, and still user-visible:

- **Prolongar prazo** tells the mentor the feedback was sent and leaves the check-in `pending`.
- Neuma 1:1 redeem dead-ends when the email already has an account, including after the screen tells the person to log in and reopen the link.
- Journey editor **Guardar** toasts “Alterações guardadas” and writes nothing.
- Approving an agent `path_edit` proposal marks it applied and edits nothing.
- Lint is red (56 errors / 10 warnings) on code that already existed on `neuma-stripe`.
- Migrations through billing are already on the live database. `0038` is **not** applied: a student session can still `SELECT` `correct_option_id`.
- Live RLS round-trips (rolled back) confirm the student write no-op, the quiz-key leak, the stray-active-node approve, and the paywall read. `finance_settings.paywall_start_at` is **`2026-09-01T00:00:00Z`**, not null. Students see 0 rows, so the cutoff does not bind.
- Browser click-through of either role: still not done. Blockers are listed in Real flow tests.

`NEUMA_BILLING_ENABLED` defaults off. Turning the flag on in production without `0035`+`0036`, a Stripe webhook secret, and the service role key does not “turn on billing”. It either grandfather-opens the app (cutoff null) or breaks checkout.

---

## Coverage

| Layer | Coverage | Notes |
| --- | --- | --- |
| Route inventory | **100%** (56/56) | Every route printed by `next build` on this branch is listed below, including redirects, webhooks, manifest, and `_not-found`. |
| Reachable screens + primary CTAs | **100% of screens** | Every `page.tsx` has its primary actions and a verdict. Dense client tools (metronome, chord builders) are one row each: they are local UI, not server flows. |
| End-to-end code trace (student + mentor flows in the brief) | **100% of the named steps** | Breaks are called out in the flow section. |
| Live database role loops | **Done, rolled back** | Mentor ↔ student cycles for paths, four pass rules, check-in, feedback, isolation, extend, and the paywall read. See Real flow tests. |
| Live browser E2E | **0%** | No GoTrue session and no Stripe keys. Playwright smoke was not run. Local Docker/Supabase CLI is not available. |
| Typecheck | Pass | `tsc --noEmit` and `next build` TypeScript step. |
| Lint | Fail (pre-existing) | `eslint .`: 56 errors, 10 warnings. Edited files are clean. |
| Production build | Pass | `next build` (Next.js 16.2.10, Turbopack). Font warning: `Nata Sans` has no fallback metrics. |

Button verdicts: **WORKING** (handler persists or navigates), **CONDITIONAL** (works only in a stated state), **STUB** (control or copy pretends to do something it does not), **BROKEN** (handler runs and the outcome is wrong), **UNREACHABLE** (no control for a supported server path), **DEAD** (no handler). Nothing in the inventory was classified DEAD; the closest cases are STUB and BROKEN.

---

## Real flow tests

These are not a static reading of the handlers. They are `SET ROLE authenticated` sessions on the **live** Neuma database, with `request.jwt.claim.sub` set to a throwaway mentor, a throwaway student, and a second student. The whole script is one transaction ending in `ROLLBACK`. After it returned, a second query showed `users_left = 0`, `profiles_left = 0`, the student quiz policy still installed, and `paywall_start_at` back to `2026-09-01T00:00:00Z`.

What this is: the same RLS the app’s user client hits, including `is_mentor()`, student SELECT-only on `nodes`/`paths`, check-in insert, feedback read, and `finance_settings`. Service-role steps are the table owner (RLS bypass), which is what `createAdminClient()` does.

What this is not: a browser. No screen was clicked. Stripe Checkout, Resend, R2, and Cal.com were not called. The branch’s TypeScript helper was not deployed; the “service role” steps below re-issue the writes that helper performs, on this database, then roll them back.

Product verdict is **PASS** only when the behaviour a user should get actually happened. Reproducing a known bug is **FAIL**.

### Blockers for a browser loop

| Blocker | Evidence |
| --- | --- |
| No app env in this VM | No `apps/web/.env.local`. `env` has no `SUPABASE_*` or `STRIPE_*`. |
| No Docker | `docker info` fails, so `supabase start` cannot boot GoTrue + PostgREST locally. Postgres 16 is installed on the VM and was not needed once the live rolled-back session worked. |
| No test passwords | Creating a durable `auth.users` row, or a Stripe Checkout session, would write to the live project. That was not done. |
| Playwright | `e2e/smoke.spec.ts` only checks HTTP status and a redirect to `/login`. It cannot log in. |

### Loop

One path, then a second path. Actors alternate.

1. **Mentor** creates an active path for the student with four levels: lesson `pass_rule=none` (active), milestone `quiz` (locked, pass score 60, one question whose key is `b`), practice `check_in`/`text` (locked), call `mentor` (locked).
2. **Student** reads the path and tries to mark the lesson seen.
3. **Mentor** sees the lesson still active and advances it.
4. **Student** opens the quiz (reads the key, inserts a 100% attempt) and tries to complete the node.
5. **Service role** (the audit-branch helper) completes the quiz node and activates practice.
6. **Student** sees practice active, inserts a text check-in, tries to approve it.
7. **Mentor** runs the old approve (complete current, activate next, no sibling lock) against a stray active node, then the new helper, and writes feedback.
8. **Student** reads the feedback and tries to complete the call.
9. **Mentor** completes the call and the path.
10. **Student** reads the path as completed.
11. **Mentor** creates a second two-lesson path. **Student** fails both self-advances. **Service role** completes both. **Another student** sees neither path.
12. **Mentor** “extends” the practice node. The check-in status is not touched.

### Results

| # | Flow | Steps | Expected | Actual | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | Percurso create | Mentor session inserts path + 4 nodes | 4 nodes, node 1 `active` | `4 nodes`, first `active` | **PASS** |
| 2 | Student sees the path | Student `SELECT` on own `paths`/`nodes` | 4 nodes | `4` | **PASS** |
| 3 | Pass rule `none` | Student `UPDATE nodes SET status=completed` on the active lesson (what **Marcar como visto** does) | Node becomes `completed`, next becomes `active` | `updated=0 status=active` | **FAIL** |
| 4 | Mentor repair | Mentor updates lesson `completed`, quiz `active`, others `locked` | `1:completed,2:active,3:locked,4:locked` | that map | **PASS** |
| 5 | Quiz key | Student `SELECT correct_option_id` | No row / no key | `visible=1 key=b` | **FAIL** |
| 6 | Quiz attempt stored | Student `INSERT` into `node_quiz_attempts` score 100 | Row inserted (RLS allows it) | Insert succeeded (later steps ran) | **PASS** |
| 7 | Pass rule `quiz` | Student `UPDATE` of the quiz node after the passing attempt | Node `completed`, practice `active` | `updated=0 status=active` | **FAIL** |
| 8 | Service-role helper | Owner update: quiz `completed`, practice `active`, call `locked` | That map | `1:completed,2:completed,3:active,4:locked` | **PASS** (this is the branch fix; it is not deployed) |
| 9 | Student sees the next level | Student reads practice | `active` | `active` | **PASS** |
| 10 | 1:1 check-in | Student inserts `check_ins` kind `text`, status `pending` | Pending row | `pending` | **PASS** |
| 11 | Student self-approve | Student `UPDATE check_ins SET status=approved` | Denied | `updated=0 status=pending` | **PASS** (denial is correct) |
| 12 | Old mentor approve | Quiz node forced back to `active`, then mentor completes practice and activates the call only | One active node | `active_count=2` map `1:completed,2:active,3:completed,4:active` | **FAIL** |
| 13 | New helper + feedback | Lock every non-completed sibling except the call; mentor inserts `feedbacks.notes='boa pratica'`, `approved=true`; check-in `approved` | Exactly 1 active node | `active_count=1` | **PASS** (helper not deployed) |
| 14 | Student reads avaliação | Student joins `feedbacks` to own check-in and reads the call | Notes visible, call `active` | `boa pratica / saw=active` | **PASS** |
| 15 | Pass rule `mentor` | Student tries to complete the call | Stays `active` | `write=0` and status stays `active` | **PASS** (denial is correct) |
| 16 | Mentor finishes the path | Mentor sets call `completed` and path `completed`; student reads the path | `completed` | `completed` | **PASS** |
| 17 | Second path, both `none` gates | Student write on A returns 0; helper activates B; student sees B and write on B returns 0; helper completes the path | Student blocked twice, path `completed` only after the helper | `writeA=0 sawB=active writeB=0 path=completed` | **FAIL** for the student button, **PASS** for the undeployed helper |
| 18 | Isolation | Second student selects both path ids | 0 | `0` | **PASS** |
| 19 | Prolongar prazo, pending check-in | Mentor sets the node `active` and a new `due_date`, and does not touch `check_ins` | Check-in leaves the pending queue | `node=active check_in=pending` | **FAIL** for the queue. The deadline itself is a separate result below. |
| 20 | Paywall cutoff | Set `paywall_start_at` inside the transaction; student counts rows; owner reads the value | Student sees the cutoff the app is supposed to enforce | `student_rows=0 db=2020-01-01T00:00:00Z` during the test. After rollback the live value is `2026-09-01T00:00:00Z` | **FAIL** |
| 21 | `0038` dry-run | `DROP POLICY` student quiz select, student counts questions, then rollback | 0 rows | `0`, and the policy is present again after rollback | **PASS** for the migration text. **Not applied.** |

### Prolongar prazo de um nível

Case: the student is not ready, so the mentor keeps them on the same level and moves the deadline. This is not “advance”.

**UI.** On `/studio/journeys/:id/levels/:nodeId`, tab **Feedback**, the decision **Prolongar prazo** is always on the panel, including when there is no check-in (`mentor-level-review-view.tsx` renders `MentorFeedbackPanel` with a null check-in). Amount defaults to weeks, with **Dias** / **Semanas** (1–365 days or 1–52 weeks). **Enviar Feedback** calls `extendLevelWeek` (`mentor-feedback-panel.tsx`). The tab **Nível** has no extend button; it only previews the player.

**Server.** `extendLevelWeek` (`lib/actions/journey-level.ts`) is mentor-only. It adds the chosen days to `nodes.due_date` (or to today when the date is null), sets that node `active`, locks every other non-completed sibling, sets the path `active`, then calls `tryIncrementWeekExtensions`. The due-date `update` does not check `{ error }`. The student never writes this column.

**What the student reads.** `due_date` is on the node row, and students may `SELECT` their nodes. It is rendered as “Até …” on the level (`student-node-player.tsx`), the path map (`student-path-map.tsx`), `/home`, and `/session`.

Second rolled-back session, same live database, mentor then student. Cleanup afterwards: `users_left = 0`.

| Step | Who | Expected | Actual | Verdict |
| --- | --- | --- | --- | --- |
| Level exists with a deadline | Student reads node 1 | `active`, `due_date = 2026-09-20`, next node `locked` | `active 2026-09-20` | **PASS** |
| Mentor extends 2 weeks (14 days), same action as **Prolongar prazo** | Mentor `UPDATE` returns a row: `due_date = 2026-09-20 + 14`, status stays `active`, next stays `locked` | 1 row written | `wrote=1` | **PASS** |
| Student sees the new deadline and is still on this level | Student `SELECT` | `active`, `2026-10-04`, next `locked` | `active due=2026-10-04 next=locked` | **PASS** |
| Student still cannot mark the level done | Student `UPDATE` status | 0 rows | `0` | **PASS** |
| No deadline yet | Mentor sets `due_date` from today + 7 | `2026-10-05` (28 Sep + 7) | `2026-10-05` | **PASS** |
| Extra check-in slot the copy promises | `tryIncrementWeekExtensions` updates `nodes.week_extensions` | Column exists and goes `0 → 1`, so `allowedCheckInsForNode` becomes 2 | Live `nodes` has **no** `week_extensions` column (`undefined_column`). The helper treats that error as a no-op (`week-extensions.ts`). Migration `0032_node_week_extensions.sql` is not in the applied migration list. | **FAIL** |

**Admin → Student verdict for the deadline: PASS.** A mentor extend moves `due_date`, the student can read it, and the level does not advance.

**Verdict for “not ready, so give them another check-in”: FAIL** on this database. The blocked-check-in copy says another video is allowed only if the mentor prolongs the level (`lib/checkins/allowance.ts`). That counter never increments here, so a student who already used the one video slot stays blocked after **Prolongar prazo**. A student who has not submitted yet is unaffected: they still have the original slot, and they do see the later date.

If a check-in is already `pending`, prolonging also leaves it `pending` (row 19). The toast still says the feedback was sent.

### How to read the four gates

| Gate | Who may advance | Live result |
| --- | --- | --- |
| `none` | Student, **Marcar como visto** | **FAIL.** Update matches 0 rows and raises nothing. The lesson stays active. Mentor advance in the next step **PASS**. |
| `quiz` | Student, score ≥ `pass_score` (60) | Attempt **PASS**. Advance **FAIL** for the same RLS reason. The answer key is readable (**FAIL**). |
| `check_in` | Student submits; mentor approves | Submit **PASS**. Student cannot approve (**PASS**). Mentor approve with the old statement list can leave two `active` nodes (**FAIL**). The helper leaves one (**PASS**, not deployed). |
| `mentor` | Mentor only | Student write **PASS** as a denial. Mentor complete **PASS**. |

### 1:1 invite redeem

Not executed. `redeemOneToOneInvite` calls `auth.admin.createUser` and then Stripe. Doing that here would create a real auth user and a real Checkout session. The code path is unchanged: an email that already exists returns “Entra e abre o link do convite outra vez”, and the page has no logged-in branch. The pedagogical 1:1 loop (check-in → feedback → mentor advance) is rows 10–16 above.

### Browser

**Not run.** Opening `/login` without a session does not exercise these loops. A faithful browser pass still needs a staging project or a local GoTrue, two passwords, `NEUMA_BILLING_ENABLED=true`, and the branch deployed there so the helper and `0038` are what the buttons call. Until then, rows 3, 5, 7, 12, 17, 19, and 20 are the live failures.

---

## Fixes on `cursor/neuma-stripe-e2e-audit-3f45`

Not a product sign-off. Code-only, typecheck-clean, not exercised in a browser.

| Fix | What changed | Why |
| --- | --- | --- |
| Student / quiz / mentor advance actually writes | `lib/nodes/complete-and-activate.ts` writes, checks the returned row, and if RLS filtered it (student) retries with the service role. Mentors still succeed on their own session when the first write returns a row. | `nodes_student_select` / `paths_student_select` are SELECT-only. Empty updates were ignored. |
| Approve check-in locks siblings | `submitFeedback` calls that helper instead of setting only the next node to `active`. | Two nodes could stay `active`. |
| Paywall cutoff visible to students | `paywallStartAt()` reads `finance_settings` with the service role, then falls back to the user client. | Students have no policy on `finance_settings`. |
| Failed invoices stay out of the ledger | `syncInvoice` returns unless `invoice.status === "paid"`. | Webhook also calls it for `invoice.payment_failed`. `paid_at` fell back to `invoice.created`, so a failed invoice could enter `finance_dashboard` revenue counts. |
| Quiz answer key | `listQuizQuestions` is mentor-only. The player loads questions with the service role after an ownership check and returns prompts/options only. Migration `0038_quiz_hide_answer_key.sql` drops the student SELECT policy. | Otherwise a student (or the browser anon key) could read `correct_option_id` and, after the advance fix, unlock the path with a perfect score. |

`0038` does nothing until it is applied. Until then the PostgREST leak remains; the server action no longer returns the key.

---

## Findings

### Critical

#### C1. Student self-advance was a silent no-op

- **Area:** Student path — lesson “mark seen”, quiz pass, and any caller of `completeCurrentAndActivateNext` on a student session.
- **Evidence:** `apps/web/supabase/migrations/0001_init.sql` policies `nodes_student_select` and `paths_student_select` (SELECT only). `nodes_mentor_all` is the only write policy. `markNodeSeen` (`lib/actions/journey-level.ts`) and `submitQuizAttempt` (`lib/actions/quiz.ts`) call the helper with the user client. Before this branch the helper never inspected `{ error }` or returned rows.
- **Impact:** Lesson and quiz gates do not move the path. The UI revalidates and looks unchanged, with no error toast. Mentor approval was the only advance that persisted.
- **Fix:** Applied on the audit branch (service-role fallback + thrown error). **Live check still required** with a student session and `SUPABASE_SERVICE_ROLE_KEY` set. Without that key the student path now fails loudly instead of pretending to save.

#### C2. DB paywall cutoff never applied to students

- **Area:** Billing gate, `(student)/layout.tsx` → `getAccessState()`.
- **Evidence:** `lib/billing/access.ts` `paywallStartAt()` used `createClient()` against `finance_settings`. `0035_billing.sql` grants mentor `ALL` on that table and no student policy. A denied read returns null, and a null cutoff is `reason: "grandfathered"` (`access.ts`, and the same rule in `has_app_access()`).
- **Impact:** Confirmed on the live database. `paywall_start_at` is `2026-09-01T00:00:00Z`. A student session reads **0 rows**. The service role reads the date. With `NEUMA_BILLING_ENABLED=true` and no env override, accounts created on or after 1 Sep 2026 are supposed to hit the paywall and do not. Only `NEUMA_PAYWALL_START_AT` (env) works today. `.env.example` says production reads the database setting.
- **Fix:** Applied (admin read). There is still **no Studio control** that calls `updateFinanceSetting` — the cutoff is SQL or env, not a button. With the seeded value `'null'::jsonb`, billing-on still lets every account in. That part is intentional (`0035` comment: null cutoff keeps production unchanged).

### High

#### H1. Prolongar prazo does not close the check-in

- **Area:** Mentor level review.
- **Evidence:** `components/mentor-feedback-panel.tsx` `handleSubmit` when `decision === "extend"` calls `extendLevelWeek` and, if there is text/video, `saveCheckInFeedbackOnly`. Neither updates `check_ins.status`. `saveCheckInFeedbackOnly` (`lib/actions/feedbacks.ts`) upserts feedback with `approved: false` and returns. The button then toasts success via `markSubmitted()`.
- **Impact:** Check-in stays in **Por rever**. Mentor thinks it was handled. The deadline itself does move and the student can read the new `due_date` (see Real flow tests, Prolongar prazo). A second video slot does not: live `nodes` has no `week_extensions` column, and `tryIncrementWeekExtensions` swallows that error.
- **Fix:** Not applied. Product choice: mark `needs_revision`, or a distinct “extended” state that leaves the pending queue without asking for a new video. Do not guess in this audit.

#### H2. Neuma 1:1 cannot be redeemed by an existing account

- **Area:** `/1-1/[token]`, `redeemOneToOneInvite`.
- **Evidence:** `lib/actions/one-to-one.ts` always `auth.admin.createUser`. On “already” it returns: “Já existe uma conta com este email. Entra e abre o link do convite outra vez.” The page (`app/1-1/[token]/page.tsx`) does not look at the session. Reopening the link shows the same create-account form and hits the same error.
- **Impact:** Anyone who already signed up (including a normal student) cannot pay a 1:1 invite. The copy describes a path that does not exist.
- **Fix:** Not applied. Needs a logged-in branch that starts Checkout for `auth.uid()` when the email matches the invite, without creating a second user.

#### H3. Quiz answer key was world-readable to the student session

- **Area:** Checkpoint quiz.
- **Evidence:** `0015_checkpoint_quiz.sql` policy “Students read own node_quiz_questions” is `SELECT` of the full row, including `correct_option_id`. `listQuizQuestions` used `requireUser()` and returned that column. `pass_rule = quiz` treats score ≥ threshold as an unlock (`submitQuizAttempt`).
- **Impact:** Combined with C1’s fix, a student who can see the key can unlock the path without knowing the material.
- **Fix:** Applied in code + `0038`. **Must be migrated** or the table policy still allows a direct Supabase query from the browser.

#### H4. `has_app_access()` is not what the app uses, and grace disagrees

- **Area:** Billing.
- **Evidence:** Gate is `getAccessState()` in the student layout only. SQL `has_app_access()` (`0035`) is unused by the app. Grace in TS is `NEUMA_PAST_DUE_GRACE_DAYS` (default 7). Grace in SQL is `finance_settings.past_due_grace_days`.
- **Impact:** Any future RLS that trusts the SQL function will disagree with the screen the student sees. Changing grace in the database does not change the banner or the lockout.
- **Fix:** Not applied. Pick one source (recommend the SQL function, read via service role / `SECURITY DEFINER`) before turning the paywall on for new accounts.

#### H5. Journey **Guardar** does not persist

- **Area:** `/studio/journeys/[id]/edit`.
- **Evidence:** `components/journey-path-edit-guard.tsx` `acknowledgeSave` updates a local snapshot and toasts “Alterações guardadas” / “Percurso guardado”. The leave dialog’s save path navigates away. Real writes are the per-dialog actions (`upsertPath`, `updateNode`, `createNode`, `moveNode`, `setPathStatus`).
- **Impact:** A mentor who edits inline and hits the header **Guardar** can leave believing the path was saved.
- **Fix:** Not applied. Either wire **Guardar** to the dirty node/path actions or change the label so it does not claim a write.

#### H6. Unsigned webhooks when secrets are empty

- **Area:** `POST /api/cal/webhook`, `POST /api/tally/webhook`.
- **Evidence:** `.env.example` states that with empty Tally secrets the handler accepts the body. Cal verification is skipped when `CAL_WEBHOOK_SECRET` is empty (`lib/cal.ts`). Both handlers write through the service role.
- **Impact:** A production deploy that forgets the secrets accepts forged check-ins, onboardings, and bookings.
- **Fix:** Not applied. Fail closed when `NODE_ENV=production` or when `NEXT_PUBLIC_SITE_URL` is not localhost.

#### H7. Missing Supabase env skips auth in the proxy

- **Area:** `apps/web/proxy.ts` → `lib/supabase/middleware.ts`.
- **Evidence:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing, the proxy logs and returns `NextResponse.next()`. Comment says this avoids `MIDDLEWARE_INVOCATION_FAILED`.
- **Impact:** A misconfigured deploy serves `/studio` and `/home` with no session redirect. Downstream server components still call Supabase and will throw, but the gate itself is open.
- **Fix:** Not applied. Prefer a 503 over an open proxy.

### Medium

#### M1. `path_edit` agent proposals are a cosmetic approve

- **Area:** `/studio/agent/inbox`.
- **Evidence:** `lib/actions/agent-proposals.ts` branch `proposal.kind === "path_edit"` is a comment only (“Soft apply”), then the row is marked `applied`.
- **Impact:** **Aprovar** looks successful. The journey does not change.
- **Fix:** Not applied. Hide **Aprovar** for this kind, or label it “Marcar como lido”.

#### M2. Agent `path_draft` inserts every node as `locked`

- **Area:** Inbox approve → journeys.
- **Evidence:** `agent-proposals.ts` sets `status: "locked"` on every inserted node and comments that the mentor must activate. `applyPathTemplate` sets the first node `active`.
- **Impact:** An approved draft is a path the student cannot start until someone uses **Ativar** / **Ativar nível**. Easy to miss.
- **Fix:** Not applied. Align with template apply (first node `active`) when the path is assigned, or keep draft and surface an “activar primeiro nível” banner. The comment shows the lock was deliberate; the gap is the missing prompt.

#### M3. Apply template does not show the new path

- **Area:** Student ficha / journeys, `applyPathTemplate`.
- **Evidence:** Insert sets the first node active (good). The dialog toasts and closes without `router.refresh()` or a redirect to `/studio/journeys/:id`.
- **Impact:** Mentor can believe the apply failed and apply twice.
- **Fix:** Not applied. Redirect to the new journey.

#### M4. Several mentor writes report success or return without checking Postgres

- **Area:** Studio mutations.
- **Evidence:**
  - `lib/actions/nodes.ts` — create/update/delete/reorder without `{ error }`.
  - `lib/actions/paths.ts` `setPathStatus` — update not checked.
  - `lib/actions/tally.ts` mark processed / pending — update not checked.
  - `lib/actions/students.ts` `updateStudentNotes` — update not checked.
  - `lib/actions/one-to-one.ts` `revokeOneToOneInvite` — always `{ ok: true }`.
  - `createOneToOneInvite` — `sendEmail` result ignored, action still `{ ok: true }`.
  - `lib/actions/auth.ts` `createSignupAccount` profile `.update()` result ignored.
- **Impact:** RLS or a missing column looks like a saved note, a revoked invite, or a sent 1:1 email.
- **Fix:** Not applied (wide, easy to get wrong in one pass). Check `{ error }` and surface it. 1:1 email failure should return `{ ok: false }` or a distinct warning.

#### M5. Finance dashboard turns a missing migration into zeros

- **Area:** `/studio/finance`.
- **Evidence:** `loadFinanceDashboard` catches RPC errors and returns an empty dashboard. `0036` defines `finance_dashboard()`.
- **Impact:** Mentor reads €0 MRR when the function was never created.
- **Fix:** Not applied. Show the Postgres error in the diagnostics panel that already exists for Stripe.

#### M6. No “pedir revisão” control

- **Area:** Level review.
- **Evidence:** UI decisions are only **Avançar nível** and **Prolongar prazo**. `submitFeedback` supports `approved` off → `check_ins.status = needs_revision` and one extra check-in slot. Nothing in Studio posts that.
- **Impact:** The student **Reenviar check-in** button (`needs_revision` only) is unreachable from the current mentor UI.
- **Fix:** Not applied. Add the third decision, or document that revision is out of product scope and delete the dead status path.

#### M7. Cal booking can paint a session the database does not have

- **Area:** Student call nodes and `/session`.
- **Evidence:** `components/session-booking-section.tsx` updates local state when the embed reports a booking; `syncCalBookingFromEmbed` errors are logged. Cancel path reverts on failure; the create path is not symmetric.
- **Impact:** “Entrar na call” / the booking chip can exist only in the browser tab.
- **Fix:** Not applied. Keep the chip pending until sync returns.

#### M8. Checkout success without a synced subscription loops

- **Area:** `/subscrever/sucesso` → `/home`.
- **Evidence:** `finalizeCheckoutSession` retries `syncSubscription` four times. The success page is outside the student layout, so it always renders. **Ir para a app** goes to `/home`, and `(student)/layout.tsx` sends a student with no access back to `/subscrever`.
- **Impact:** Webhook delay or a bad `session_id` looks like a payment that did not unlock the app, with a bounce between home and the paywall.
- **Fix:** Not applied. Keep the user on the success screen until `getAccessState().hasAccess` is true.

#### M9. `revoke` / email / signup profile errors are swallowed

- Covered with M4. Called out again because 1:1 and signup are on the launch path.

#### M10. Blocked students can still submit onboarding

- **Area:** `/onboarding`.
- **Evidence:** Middleware lists `/onboarding` as public. It is outside `(student)/layout.tsx`, so the paywall never runs. `submitOnboarding` uses the admin client.
- **Impact:** An unpaid logged-in student can complete onboarding. That may be intentional (lead form). It is not “paywall before the product”.
- **Fix:** Not applied. If onboarding is post-purchase, move it under the student layout or check `getAccessState()`.

### Low

#### L1. Apple sign-in is a permanent stub

- **Area:** Login and signup.
- **Evidence:** `components/oauth-sign-in-buttons.tsx` — button **Apple**, `disabled`, `title="Em breve"`.
- **Impact:** The control is visible and does nothing. Google works.
- **Fix:** Hide it until the Supabase Apple provider is configured.

#### L2. `updateFinanceSetting` has no UI

- **Area:** Finanças.
- **Evidence:** `lib/actions/finance.ts` `updateFinanceSetting` has no callers in `components/` or `app/`. MRR goal and `paywall_start_at` are display / SQL only.
- **Impact:** Mentors cannot set the paywall date or the MRR target from Studio.

#### L3. Empty quiz has no way forward

- **Area:** `/path/[nodeId]/quiz`.
- **Evidence:** `checkpoint-quiz-panel.tsx` shows a message when there are no questions and no advance CTA. `submitQuizAttempt` throws if the question list is empty.
- **Impact:** A node with `pass_rule=quiz` and zero questions is a dead end. Mentor must change the rule or add questions.

#### L4. `requestEmailChange` is unused

- **Area:** Settings.
- **Evidence:** Email field on `settings-view` is read-only. No button calls the action.
- **Impact:** Students cannot change email in the app.

#### L5. Cal.com header link is generic

- **Area:** `/studio/calendar`.
- **Evidence:** Link target `https://app.cal.com/bookings/upcoming`, not the mentor username in `NEXT_PUBLIC_CALCOM_USERNAME`.
- **Impact:** Opens Cal.com; the mentor still has to land in the right account.

#### L6. Default mentor email is hardcoded as fallback

- **Area:** Signup.
- **Evidence:** `.env.example` fallback `isaqueportilho2014@gmail.com` in `DEFAULT_MENTOR_EMAIL` comments / `lib/auth/default-mentor.ts`.
- **Impact:** If the env var and that profile are both missing, new students have no mentor. The code warns; it does not block signup.

#### L7. Lint debt

- **Area:** Repo quality.
- **Evidence:** `eslint .` → 66 problems (56 errors, 10 warnings). Dominant rule: `react-hooks/set-state-in-effect` in `app-shell`, `accent-provider`, and similar client components, plus `prefer-const` in actions. Not introduced by the audit fixes.
- **Impact:** `npm run lint` cannot gate CI as written.

#### L8. `Nata Sans` build warning

- **Area:** Build.
- **Evidence:** `next build` — “Failed to find font override values for font `Nata Sans`”. Build still exits 0.

---

## How gates work

### Proxy (`apps/web/proxy.ts`)

Public without a session: `/`, `/login` (except `/login/welcome`), `/onboarding`, `/soundworks`, `/subscrever`, `/subscrever/sucesso`, `/auth/*`, `/1-1/*`, `/api/tally/*`, `/api/cal/webhook`, `/api/stripe/webhook`.

Everything else: anonymous users go to `/login` (APIs get 401 JSON). Logged-in `/login` goes to `/`. Logged-in `/login/signup` without the finishing cookie goes to `/`.

### Role

| Layout | Rule |
| --- | --- |
| `/` | No user → `/login`. Mentor → `/studio`. Else → `/home`. |
| `(mentor)/layout.tsx` | Must be `role=mentor`, else `/login?error=perfil-invalido`. No billing gate. |
| `(student)/layout.tsx` | Must be `role=student`. Mentor hitting a student URL → `/studio`. `!hasAccess` → `/subscrever`. `reason=grace` shows the coral banner. |

### Billing (`getAccessState`)

Runs only when `NEUMA_BILLING_ENABLED` is `1` or `true`. Otherwise `reason=billing_disabled` and everyone passes.

Order when on: no profile → block; mentor → allow; `billing_exempt` → allow; cutoff null or account created before cutoff → grandfather; subscription `active`/`trialing` → allow; `past_due` inside grace → allow + banner; else → `/subscrever`.

Exempt from the layout gate (reachable while unpaid): `/subscrever`, `/subscrever/sucesso`, `/onboarding`, `/soundworks`, `/1-1/*`, auth pages.

`/settings` is **inside** the student layout. A fully blocked student cannot update a card there; they use the paywall. A grace student can open settings.

There is no Stripe Customer Portal. Card updates are Checkout `mode: "setup"` (`createCardUpdateSession`).

Plans (`lib/stripe/plans.ts`): monthly `neuma_monthly` 2494¢, quarterly `neuma_quarterly` 6294¢, annual `neuma_annual` 19894¢. Price resolution is lookup key, then `STRIPE_PRICE_*`.

---

## Student flow (code)

`login` → role redirect `/home` → student layout billing gate → `/subscrever` if blocked → Checkout → `/subscrever/sucesso` `finalizeCheckoutSession` → `/home`.

`/home` todo and the active-level card link to `/path`, `/path/:nodeId`, `/onboarding`, `/session`, `/tools`.

`/path` map: active and past nodes link to the level. Future nodes are not links (**Bloqueado**, by design).

Level player (`student-node-player.tsx`):

| `pass_rule` | Student control | Advances? |
| --- | --- | --- |
| `none` (default for lesson/resource) | **Marcar como visto** → `markNodeSeen` | Yes, after the audit-branch fix, if service role is set. |
| `check_in` (default for practice) | **Fazer check-in em vídeo/texto** or **Confirmar que concluíste** → `/checkins/new?node=` | No. Mentor **Submeter Feedback** with **Avançar nível** does. |
| `quiz` | **Abrir quiz** → `/path/:id/quiz` → **Terminar** → `submitQuizAttempt` | Yes when score ≥ threshold (default 60) and the node is the active node on an active path. After the fix, the key is not returned to the client. |
| `mentor` (default for call/milestone) | No self-complete | Mentor **Ativar nível** or advance on the level review. |

Check-in insert is a real student write (`checkins_student_insert`, including `node_id is null` since `0020`). Video goes to R2 via presigned PUT. Failures throw.

Call: **Agendar sessão** embeds Cal.com when `can_book_sessions` is true; otherwise the button is disabled. **Entrar na call** is an external Meet URL when `meet_url` exists. Sync is best-effort (M7).

Practice is not a separate route. It is a node `kind=practice` on the same player, usually a video check-in.

Shell (every student screen): **Geral** `/home`, **Percurso** `/path`, **Mentor** `/session`, **Recursos** `/tools`, avatar → `/settings`, **Sair** → `logout`.

---

## Mentor flow (code)

`login` → `/studio`.

**Geral** lists upcoming sessions, pending check-ins, onboarding inbox. Rows deep-link to the level review, `/studio/intake/:id`, or the calendar.

**Alunos** → `/studio/students/:id` (notes, template apply, create draft, open journey, remove student, pending check-ins). Notes blur-save does not check the write (M4).

**Percursos** → view `/studio/journeys/:id` → **Editar**. Level rows (not future) open `/studio/journeys/:id/levels/:nodeId` with tabs **Feedback** | **Nível**.

Approve: **Avançar nível** + **Submeter Feedback** → `submitFeedback` (check-in) or `advanceLevel` (no check-in). After the fix, siblings are locked and the next node becomes `active`, or the path becomes `completed`.

**Prolongar prazo** + **Enviar Feedback** → H1.

**Biblioteca** `/studio/library`: categories, topics, items, archive/restore, template composer via `?compose=`.

**Finanças** `/studio/finance` (read-only KPIs and range tabs) → **Subscrições** (pause, resume, cancel, change plan, refund, complimentary, resync — all hit Stripe + admin sync when keys exist) → **Neuma 1:1** (create, copy, resend, revoke).

**Onboardings** `/studio/journeys/onboardings`: inbox, link orphan check-ins, **Aceitar 1:1** → `createOneToOneInvite`.

1:1 public redeem: **Criar conta e continuar** → `redeemOneToOneInvite` + password sign-in + Stripe URL. Existing email: H2.

---

## Route and button inventory

Verdicts describe the handler, not a live click.

### Public, auth, billing

| Route | Screen | Primary controls | Verdict |
| --- | --- | --- | --- |
| `/` | Role redirect | none | WORKING |
| `/login` | Login | **Entrar** `login`; **Esqueceste-te?** `/login/forgot`; **Criar conta** `/login/signup`; **Google** OAuth; **Apple** disabled | WORKING except **Apple** STUB |
| `/login/signup` | Wizard | **Continuar**, **Criar conta** `createSignupAccount`, **Voltar**, profile **Continuar** / **Saltar por agora**, plan cards, **Continuar para pagar** `createCheckoutSession`, Google, **Entrar** | WORKING except **Apple** STUB. Profile patch after signup ignores errors (M4). Billing off skips the plan step and goes to `/home?welcome=1`. |
| `/login/welcome` | Post-signup choice | **Onboarding Neuma 1:1** `/onboarding`; **Continuar para a app** `/home` | WORKING. Second link still hits the paywall. |
| `/login/forgot` | Reset request | **Enviar link** `requestPasswordReset`; **Voltar ao login** | WORKING |
| `/login/update-password` | New password | **Guardar** `updatePassword`; **Voltar ao login** | WORKING |
| `/auth/callback` | OAuth / magic link | redirects only | WORKING. Duplicate-email collision signs out and deletes the orphan via admin. |
| `/onboarding` | Native intake | **Começar**, **Seguinte**, **Enviar** `submitOnboarding`, **Ir para a app** / **Criar conta** | WORKING (admin insert). Public, no paywall (M10). |
| `/soundworks` | Tally embed `ODqoZM` | iframe only | WORKING if Tally is up |
| `/subscrever` | Paywall | plan cards; **Continuar para pagar** `createCheckoutSession`; **Terminar sessão** `logout` | WORKING. If already entitled and not in grace → `/home`. |
| `/subscrever/sucesso` | Post-checkout | auto `finalizeCheckoutSession`; **Tentar outra vez**; **Ir para a app** | WORKING / CONDITIONAL (M8) |
| `/1-1/[token]` | Invite redeem | **Criar conta e continuar**; **Entra na tua conta** `/login` | WORKING for a new email. BROKEN for an existing email (H2). Revoked/expired/paid: message only. |
| `/manifest.webmanifest` | PWA manifest | none | WORKING (static) |
| `/_not-found` | Next 404 | none | WORKING |

### Student `(student)/`

All of these require a student session and `hasAccess`.

| Route | Screen | Primary controls | Verdict |
| --- | --- | --- | --- |
| `/home` | Greeting, todos, active level | Todo links (`/onboarding`, `/session`, `/tools`, `/path/:id`, feedback); pagination **Itens anteriores** / **Próximos itens**; active level card; paused card → `/path` | WORKING. Pagination disabled at the ends. |
| `/path` | Map | **Explorar recursos** `/tools`; level rows | WORKING. Locked rows are not buttons. |
| `/path/[nodeId]` | Level | **Marcar como visto**; check-in links; **Abrir quiz**; **Agendar sessão** / **Alterar agendamento**; **Entrar na call**; attachment / video; activity **Continuar**; **Próximo nível**; check-in/feedback toggles | WORKING after C1 fix for mark-seen. Check-in button disabled with a reason when the slot is blocked. Call disabled when `can_book_sessions` is false. Feedback toggle disabled when there is no feedback. Future node redirects to `/path`. |
| `/path/[nodeId]/quiz` | Quiz | options; **Seguinte**; **Terminar** `submitQuizAttempt`; **Fechar** | WORKING. No questions: STUB (L3). |
| `/checkins` | History | row links; **Reenviar check-in** only if `needs_revision` | WORKING |
| `/checkins/new` | Wizard | **Seguinte**; **Enviar check-in** `submitCheckIn`; video drop zone | WORKING. No path → `/session`. Paused path → `/path`. |
| `/checkins/[id]` | Detail | **Reenviar check-in** (conditional); feedback **Continuar** | WORKING |
| `/session` | Mentor hub | header → `/session/mentor`; **Fazer check-in** / **Enviar notas**; **Abrir nível**; **Ver feedback**; **Agendar sessão de dúvidas**; **Ver histórico**; **WhatsApp**; **Deixar um feedback** | WORKING. Check-in and feedback buttons disable with copy when there is nothing to do (**Sem feedbacks de momento**). |
| `/session/mentor` | Mentor profile | Instagram / WhatsApp when set | CONDITIONAL on mentor fields |
| `/session/feedback` | Unseen feedback | cards → level or check-in | WORKING. Empty state has no CTA. |
| `/session/review` | App review | **App** / **Geral**; **Enviar feedback** `submitStudentReview` | WORKING |
| `/settings` | Profile + plan | **Escolher plano**; **Actualizar cartão** `createCardUpdateSession`; **Mudar plano** / **Confirmar mudança** `changeMyPlan`; cancel confirm / **Manter plano**; **Reactivar**; **Recibo**; avatar; **Guardar** `updateProfile`; social rows; **Terminar sessão** | WORKING when billing is on and Stripe answers. Email is read-only (L4). Subscription card hidden when billing is off. |
| `/tools` | Metronome, harmonic field, piano, guitar | local controls | WORKING (no server) |
| `(student)/error` | Error boundary | **Tentar outra vez** `reset()` | WORKING |
| `(student)/loading` | Loader | none | WORKING |

### Mentor `(mentor)/studio`

All require `role=mentor`.

| Route | Screen | Primary controls | Verdict |
| --- | --- | --- | --- |
| `/studio` | Dashboard | **Ver todos** (check-ins, onboardings, calendar); check-in rows; onboarding rows; **Aceitar 1:1**; **Vincular**; session rows | WORKING |
| `/studio/students` | List | search; row → ficha | WORKING. List is every student, not `mentor_id`-scoped (RLS `profiles_mentor_all`). |
| `/studio/students/[id]` | Ficha | notes; **Avaliar**; **Abrir Onboardings**; onboarding block; **Aplicar template**; **Criar percurso**; path card; claim unassigned; **Remover** | WORKING. Notes and template-apply refresh are CONDITIONAL (M3, M4). |
| `/studio/students/[id]/checkins` | Legacy redirect → ficha | none | WORKING |
| `/studio/journeys` | Path list + tabs | **Criar Percurso**; row; **Editar** / **Vincular** / template / **Remover**; **Rascunho Teoria Musical**; tabs **Percursos** **Check-ins** **Onboardings** | WORKING |
| `/studio/journeys/[id]` | Read-only map | **Editar**; **Ver ficha**; **Adicionar níveis**; level rows; claim form | WORKING. Future levels not clickable. |
| `/studio/journeys/[id]/edit` | Composer | **Ver percurso**; path dialog **Guardar** `upsertPath`; **+ Nível**; header **Guardar**; **Rascunho** / **Ativar** / **Pausar** / **Concluir**; **Eliminar**; **Subir** / **Descer**; **Ativar nível**; node save / delete | Header **Guardar** is STUB (H5). `setPathStatus`, `createNode`, `updateNode`, `deleteNode` do not check errors (M4) — CONDITIONAL. **Ativar nível** `activateNode` is WORKING for mentors. |
| `/studio/journeys/[id]/levels/[nodeId]` | Review | **Feedback** / **Nível**; **Descartar e escrever do zero**; video picker; **Avançar nível**; **Prolongar prazo**; **Submeter Feedback** / **Enviar Feedback**; edit **Guardar alterações** | Advance WORKING (and sibling-lock fixed on the audit branch). Extend BROKEN for the queue (H1). `updateFeedback` WORKING. |
| `/studio/journeys/checkins` | Queue + history | rows → level review | WORKING |
| `/studio/journeys/onboardings` | Inbox | rows; link actions; **Aceitar 1:1**; **Ver** | WORKING |
| `/studio/checkins` | Redirect → journeys check-ins | none | WORKING |
| `/studio/checkins/[id]` | Redirect → level review or list | none | WORKING |
| `/studio/intake` | Redirect → onboardings | none | WORKING |
| `/studio/intake/[id]` | Submission | **Marcar como tratado**; **Reabrir**; **Abrir ficha**; **Avaliar**; **Vincular**; social links; file link | WORKING. Processed/pending updates ignore errors (M4). |
| `/studio/inbox` | Redirect → `/studio/journeys` | none | WORKING |
| `/studio/library` | Library hub | **+ Categoria**; **+ Tópico**; item dialog; category query links; **Restaurar**; **Apagar** | WORKING |
| `/studio/library/templates/[id]` | Redirect → `?compose=` | none | WORKING |
| `/studio/paths` | Redirect into library | none | WORKING |
| `/studio/paths/templates/[id]` | Redirect → `?compose=` | none | WORKING |
| `/studio/library?compose=` | Template composer | meta save, status, node CRUD, delete template | WORKING with the same unchecked node writes as the journey composer (M4) |
| `/studio/finance` | KPIs | range tabs; **Dashboard** / **Subscrições** / **Neuma 1:1** | WORKING as a read model. Zeros when `0036` is missing (M5). MRR goal is not editable (L2). |
| `/studio/finance/subscriptions` | Stripe ops | **Pausar**; **Retomar**; **Cancelar fim período**; **Cancelar já**; **Mudar plano**; **Reembolsar último pagamento**; **Conceder cortesia** / **Revogar**; **Ressincronizar**; **Ver aluno** | WORKING when Stripe + service role are set. Rows with no subscription hide the Stripe actions. |
| `/studio/finance/one-to-one` | Invites | **Criar convite**; **Copiar link**; **Reenviar**; **Revogar** | Create WORKING if Stripe price + admin insert work. Email failure still returns ok (M4). Revoke always returns ok (M4). |
| `/studio/calendar` | Month grid | **Cal.com**; prev/next month; event links; create form; manual edit/delete | WORKING. Cal.com link is generic (L5). New event does not always refresh until navigation. |
| `/studio/agent` | Chat | **Inbox**; six chips; composer **Enviar**; ⌘J | CONDITIONAL on `AGENT_INTERNAL_URL` and the Python service. |
| `/studio/agent/inbox` | Proposals | **Aprovar** `approveProposal`; **Rejeitar** | `path_draft` CONDITIONAL (M2). `calendar_event`, `checkin_nudge`, `student_brief` WORKING. `path_edit` STUB (M1). |
| `/studio/settings` | Mentor profile | avatar; **Guardar**; **Sair** | WORKING |
| `/studio/tools` | Same tools as student + chord overrides | local + `getChordVoicingOverrides` | WORKING |
| `(mentor)/studio/error` | Error boundary | **Tentar outra vez** | WORKING |
| `(mentor)/studio/loading` | Loader | none | WORKING |

### Shell (both roles)

| Control | Handler | Verdict |
| --- | --- | --- |
| Mentor: Geral, Alunos, Percursos, Biblioteca, Calendário, Agents, Finanças, Recursos, Perfil | `href` as in `app-shell.tsx` | WORKING. Mobile bottom bar omits Calendário; it is in the drawer. |
| Student: Geral, Percurso, Mentor, Recursos, Perfil | `href` | WORKING |
| **Sair** | `logout` | WORKING |
| Back chevron | `shellBackHref` + journey leave guard | WORKING |
| Logo | `/home` or `/studio` | WORKING |

### API routes

| Route | Auth | Behaviour | Verdict |
| --- | --- | --- | --- |
| `POST /api/stripe/webhook` | Stripe signature | Sync subscription, paid invoices, refunds, 1:1 paid flag. 503 without Stripe or webhook secret. 400 on bad signature. | WORKING. Non-paid invoices no longer upsert after the audit-branch filter. `markInviteAsPaid` still does not check its update. |
| `POST /api/tally/webhook` | Optional HMAC | Admin insert of onboarding / check-in. | WORKING. Unsigned if secrets empty (H6). |
| `POST /api/cal/webhook` | Optional HMAC | Admin upsert of bookings. | WORKING. Unsigned if secret empty (H6). |
| `POST /api/agent/stream` | Session (proxy) | Proxies to the agent. | CONDITIONAL on the agent process. |
| `GET /api/agent/events/[runId]` | Session | SSE/events for a run. | CONDITIONAL on the agent process. |

---

## Migrations this branch expects

Apply in order. The app does not migrate itself.

| File | Needed for |
| --- | --- |
| `0001`–`0034` | Core product (paths, check-ins, library, quizzes, calendar, agent). |
| `0035_billing.sql` | Billing tables, RLS, `has_app_access()`, privileged-column trigger, `paywall_start_at` seed `null`. |
| `0036_finance_dashboard.sql` | `/studio/finance` numbers. |
| `0037_teoria_musical_path.sql` | **Rascunho Teoria Musical**. |
| `0038_quiz_hide_answer_key.sql` | **New on the audit branch.** Drops student read of quiz rows. Required for H3 to hold against the anon key. |

`supabase/tests/01_billing_access.sql` exercises the SQL access model. It was not executed here (no database).

Objects the billing code reads are created in `0035`/`0036`. No missing table name was found beyond “migration not applied”. `one_to_one_invites.source_submission_id` is a uuid without a foreign key.

---

## Env failures

| Variable | If missing |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Proxy does not authenticate (H7). Server client calls throw. |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, 1:1, invites, checkout sync, and (after the fix) student mark-seen / quiz unlock throw. Mentor advance still works via RLS. |
| `NEUMA_BILLING_ENABLED` not `true`/`1` | Paywall off. App behaves as before billing. |
| `NEUMA_PAYWALL_START_AT` and DB cutoff null | Billing on, but every account is grandfathered. |
| `STRIPE_SECRET_KEY` | Checkout and finance actions throw; webhook 503. |
| `STRIPE_WEBHOOK_SECRET` | Webhook 503. Payments never sync. Success page can still finalize if the user returns with `session_id`. |
| `STRIPE_PRICE_MONTHLY/QUARTERLY/ANNUAL` | Needed only when lookup keys `neuma_*` are absent. Error: price not configured. |
| `NEUMA_PAST_DUE_GRACE_DAYS` | Default 7. Does not read `finance_settings.past_due_grace_days` (H4). |
| `RESEND_API_KEY` | 1:1 “created” with no email (logged). |
| `R2_*` | Check-in and library video upload fails when the user picks a file. |
| `AGENT_INTERNAL_URL`, `NEUMA_AGENT_TOKEN` | Studio agent chips fail. Rest of Studio does not. |
| `CAL_WEBHOOK_SECRET`, `TALLY_*_SECRET` | Unsigned writes accepted (H6). |
| `NEXT_PUBLIC_SITE_URL` | Stripe return URLs and emails point at the wrong host. Dev forces localhost in `getAppOrigin`. |
| `NEXT_PUBLIC_CALCOM_USERNAME` | Booking embed has nobody to load. |
| `GOOGLE_GENERATIVE_AI_API_KEY` / `XAI_API_KEY` | Agenda falls back to a local briefing. |

---

## Tooling

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` in `apps/web` | Pass (after the fixes, re-run). |
| `npx eslint .` in `apps/web` | **Fail.** 56 errors, 10 warnings. Pre-existing. Edited files pass a targeted eslint run. |
| `npm run build` in `apps/web` | **Pass.** 42 static pages generated, all app routes dynamic except `/soundworks`, `/manifest.webmanifest`, `/_not-found`. Warning: `Nata Sans` fallback font. |
| `npm run test:e2e` | **Not run.** Would need a booted app plus Supabase. `e2e/smoke.spec.ts` only checks that public pages return &lt; 500 and that studio/student URLs redirect to `/login`. It does not cover buttons, Stripe, or RLS. |

---

## Live E2E still needed

The database role loops in **Real flow tests** are done and were rolled back. What is still missing is a browser session and Stripe. Do this on a **preview** with migrations `0035`–`0038` applied, Stripe **test** mode, `NEUMA_BILLING_ENABLED=true`, and the audit branch deployed so the buttons call the helper. The live database already has `paywall_start_at = 2026-09-01T00:00:00Z`; students cannot read it until the access fix is deployed. Use one new student and one mentor. Do not point webhooks at production.

Student

1. Signup → plan → Checkout test card → success screen → `/home` without a bounce back to `/subscrever`.
2. Grandfather: an older account still enters `/home`. A brand-new account without a subscription does not.
3. `past_due` inside grace sees the banner and can open **Actualizar cartão**. After grace, `/home` redirects to `/subscrever`.
4. Path map → lesson **Marcar como visto** → node becomes `completed` and the next becomes `active` (refresh and a second browser).
5. Quiz below 60 stays put. Quiz at or above 60 advances. View-source / a direct `node_quiz_questions` select from the student session returns **no** `correct_option_id` (proves `0038`).
6. Practice check-in with a short video lands `pending` on the mentor queue.
7. Call: book, see the row in `/studio/calendar`, cancel, see it disappear.
8. After mentor approval, the next node is the only `active` node.

Mentor

1. `/studio` badges and the three inbox sections match the database.
2. Apply template → land on the new path with node 1 active.
3. Edit a node via the node form (not only header **Guardar**) and reload.
4. Approve a check-in with **Avançar nível**. Confirm sibling nodes are `locked`.
5. **Prolongar prazo** — today this will **fail** the “queue clears” expectation (H1). Confirm before any UX patch.
6. Library create / archive / restore.
7. Finance: pause and resume a test subscription, refund, complimentary on/off, and see the student’s access change.
8. 1:1 invite email → redeem as a **new** user → pay → `is_one_to_one` and invite `paid`. Repeat with an **existing** email and expect H2 until it is fixed.
9. Agent inbox: approve `path_draft` and confirm whether node 1 is locked (M2).

Failure drills: webhook secret wrong (400), service role removed (student mark-seen errors), `0036` absent (finance must not look like a real €0).

---

## Merge and deploy

**Do not merge to `main`.** **Do not deploy.**

The audit branch is safe to review. It does not flip `NEUMA_BILLING_ENABLED`, does not change Vercel, and does not apply migrations. Shipping `neuma-stripe` as-is would leave student lesson/quiz completion as a silent no-op. That no-op was reproduced on the live database: a student update of `nodes` changes 0 rows. The database paywall cutoff is already `2026-09-01T00:00:00Z` and students cannot read it. Shipping the audit branch without `0038` and a live pass would still leave H1, H2, H5, and the webhook fail-open in place.

Recommended order when someone is ready, still not now:

1. Review this file and the four code fixes.
2. Apply `0035`–`0038` on a **staging** database.
3. Run the live script above.
4. Only then consider a release branch. Keep billing disabled in production until that script is green and H1/H2 are either fixed or explicitly accepted.
