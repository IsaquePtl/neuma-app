# Neuma Stripe — E2E retest

Branch: `cursor/neuma-stripe-e2e-fixes-c91c` (continues `cursor/neuma-stripe-e2e-audit-3f45`).
Base for the pull request: `neuma-stripe`.
Date: 2026-09-28.
Database: Neuma App `gkxvlduobwvwarqfxyuh` (eu-west-1).

This retest repeats the audit’s bar: live role sessions, every level kind, evaluation per pass rule, prolongar prazo, quiz keys, and Stripe linking. It does not replace a browser click-through. This VM still has no app `.env.local`, no GoTrue passwords, and no Stripe secret. Stripe MCP is unauthenticated. No Checkout session was opened, and nothing was deployed.

There is no separate `admin` role. Studio is the mentor surface.

---

## Verdict

**Critical and High from `AUDIT_NEUMA_STRIPE_E2E.md` are cleared** in code and in rolled-back database loops.

**Do not merge to `main`. Do not deploy production.**

Merging this branch into `neuma-stripe` is the recommendation. Medium and Low items from the audit stay open, except the review button (M6), which is now on the mentor panel. A new Stripe Checkout was not executed here; the linking rule was executed in SQL and then rolled back. The six live subscriptions stay `profile_id` null because their accounts no longer exist.

---

## What was re-run

| Check | Result |
| --- | --- |
| `tsc --noEmit` in `apps/web` | Pass |
| `node --experimental-strip-types scripts/retest-evaluation.mjs` | Pass (“evaluation checks passed for 5 kinds”) |
| Live role loop, 5 kinds × 4 pass rules × 3 check-in kinds | 60/60 inserted, then `RAISE` so the transaction rolled back |
| Follow-up read | `users_left = 0`, throwaway subscriptions `0`, throwaway payments `0` |
| Browser click-through | Not run |
| Stripe API (Checkout, webhook replay, 4242) | Not run |

The role loop is `apps/web/scripts/retest-rls.sql`. Variable names do not match column names. An earlier draft used `#variable_conflict use_variable`, which made `node_id = node_id` true for every row and made the “one active node” count meaningless. That draft also raised, and the follow-up read showed the throwaway users were gone. The numbers below are from the corrected script only.

Exception text (the success path; the error aborts the transaction):

```json
{
  "who": "authenticated",
  "rows": 60,
  "insert_fail": 0,
  "visible": 60,
  "visible_fail": 0,
  "student_writes": 0,
  "quiz_key_rows": 0,
  "quiz_attempts": 15,
  "attempt_fail": 0,
  "checkins": 15,
  "checkin_fail": 0,
  "self_approve": 0,
  "student_settings_rows": 0,
  "other_student_paths": 0,
  "service_role_active": 1,
  "week_extensions": "0->1",
  "due": "2026-10-04",
  "pending_left": 0,
  "needs_revision_on_node": 1,
  "mentor_bad_active": 0,
  "cutoff": "2026-09-01T00:00:00Z",
  "grace": "7",
  "link_existing_profile": true,
  "link_deleted_profile_stays_null": true,
  "link_payment": true
}
```

Migrations already applied on the live database before this retest: `node_week_extensions`, `quiz_hide_answer_key`, `link_subscription_profiles`. The link migration updated 0 of the 6 existing subscriptions, which is the correct result (see Stripe).

---

## Critical and High

| ID | Audit | Retest |
| --- | --- | --- |
| C1 | Student `none` / `quiz` advance wrote 0 rows and the UI pretended success | Student `UPDATE` still writes **0** (RLS, SELECT only). `completeCurrentAndActivateNext` retries with the service role and **throws** if `SUPABASE_SERVICE_ROLE_KEY` is missing. The same write, run as the table owner (RLS bypass, which is what the service role does), completed `lesson none video` and left **exactly 1** active node (`service_role_active = 1`). The Node helper itself was not invoked: this VM has no service-role key. |
| C2 | Students cannot read `finance_settings`, so a null cutoff grandfathered everyone | Student session still sees **0** settings rows. `getAccessState` reads `paywall_start_at` and `past_due_grace_days` with the service role and throws if the key is missing. Live values: cutoff `2026-09-01T00:00:00Z`, grace `7`. `NEUMA_PAYWALL_START_AT` still overrides the cutoff. A null cutoff remains grandfather, on purpose. |
| H1 | Prolongar prazo left the check-in pending and never incremented `week_extensions` | On the practice / check-in / video node: `week_extensions` **0 → 1**, due date **2026-10-04**, pending on that node **0**, `needs_revision` on that node **1**. The app does this in `extendLevelWeek` (one increment, then pending → `needs_revision`). A written note on the same action goes through `saveCheckInFeedbackOnly`, which does not increment again. |
| H2 | 1:1 redeem dead-ended when the email already existed | Logged-in visitor whose email matches the invite gets **Continuar para o pagamento**, which calls `startOneToOneCheckoutForSession` and does not call `createUser`. Login accepts `next=/1-1/<token>` for students. Mentors are rejected. Not executed against Stripe. |
| H3 | Student `SELECT` returned `correct_option_id` | Policy “Students read own node_quiz_questions” is gone. Authenticated student `quiz_key_rows = 0`. The player loads questions with the service role after an ownership check and strips the key. |
| H4 | App grace ignored `finance_settings.past_due_grace_days` | App grace now comes from that row (live value **7**), same source as `has_app_access()`. `NEUMA_PAST_DUE_GRACE_DAYS` is no longer the source. |
| H5 | Journey header **Guardar** toasted a save it did not write | Header label is **Concluído**. The leave dialog says **Manter**. Toasts no longer claim a new write. Dialogs remain the writers. |
| H6 | Empty Cal/Tally secrets accepted any body | `webhookMustBeSigned()` requires a secret when `NODE_ENV=production` or when `NEXT_PUBLIC_SITE_URL` is not localhost / 127.0.0.1. Unsigned bodies stay allowed only for local dev with no site URL or a localhost URL. |
| H7 | Missing Supabase env called `NextResponse.next()` | The proxy returns **503** with “Serviço indisponível: configuração Supabase em falta.” |

---

## Level kinds and evaluation

Live enums are unchanged: kinds `lesson`, `resource`, `practice`, `call`, `milestone`; pass rules `none`, `quiz`, `check_in`, `mentor`; check-in kinds `video`, `text`, `call`.

The player used to hide mark-seen, check-in, and quiz on `call`, and to hide quiz on every kind except `milestone`. `GateControls` is now on all four layouts (session, recording, practice, checkpoint). Quiz opens for `pass_rule=quiz` on any kind, and still opens on a milestone that does not use the quiz gate. The editor offers check-in kind **call**. The check-in form posts `kind=call`. Only a video check-in consumes the one-slot allowance.

| Pass rule | Who finishes the level | Retest |
| --- | --- | --- |
| `none` | Student **Marcar como visto**, via the service-role helper | Student RLS write 0. Owner write leaves 1 active node. |
| `quiz` | Score ≥ `pass_score` (default 60) unlocks. A fail stays active. Mentor advance also requires that score. | Pure checks: 59 holds, 60 unlocks, 70 against 80 holds, and 70 against 80 is headline `low` (not “Bom trabalho”). Mentor `mentorMayComplete` returns not ok for a missing or failing attempt. A quiz score does not unlock a `mentor` rule. |
| `check_in` | Student submits. Mentor approval is the pass. **Avançar** with zero approved submissions is refused. **Pedir revisão** sets `needs_revision` and grants one extra slot. | 15 check-ins inserted (video, text, and call). Student self-approve wrote 0. Server `advance` mode requires an approved row; `approve_check_in` mode is the approval itself. |
| `mentor` | Mentor may advance. A quiz score does not pass the level. | `quizUnlocksPath` is false for `mentor`. `mentorMayComplete` allows advance. |

Mentor sibling lock, qualified per path: **58 paths, `mentor_bad_active = 0`** (the extended practice node and the service-role lesson were left out of that loop on purpose). A raw mentor SQL update can still ignore the quiz rule, because mentors have `ALL` on `nodes`. The product path is `advanceLevel` / `submitFeedback`, which call `assertMentorMayCompleteNode` before the write.

---

## Stripe test mode

All **6** live subscriptions and **6** payments are `livemode: false` and still have `profile_id` null. Each subscription’s `raw.metadata.neuma_profile_id` is a UUID. **None** of those UUIDs exist in `auth.users` or `profiles`, and **none** of the customer emails exist on a profile. `0039` therefore updated 0 rows. Deleted accounts must stay null (`on delete set null`). The backfill does not invent a link.

Inside the rolled-back loop, the same SQL linked a subscription and its payment when the metadata UUID was the throwaway student (`link_existing_profile = true`, `link_payment = true`) and left a second row null when the UUID was not a profile (`link_deleted_profile_stays_null = true`).

New Checkout code sets `client_reference_id`, subscription metadata `neuma_profile_id`, and `integration_identifier`. `syncSubscription` resolves the explicit id, then subscription metadata, then the previous row, then the customer, and only if that profile still exists. It does not overwrite a known `profile_id` with null. A metadata UUID for a deleted user no longer upserts `billing_customers` (that upsert used to throw on the foreign key and fail the webhook).

What this retest did **not** do: open Checkout, send a webhook, pause, resume, or cancel. Those calls need a Stripe key this environment does not have. Treat one preview Checkout, after this branch is deployed to a preview, as the remaining observation. It is not an open code defect in the six historical rows.

---

## Still open (not Critical / High)

Unchanged from the audit, and not blocking this pull request:

- M1 cosmetic approve of `path_edit`
- M2 agent `path_draft` inserts every node locked
- M3 template apply does not redirect
- M4 several mentor writes still ignore `{ error }`
- M5 finance dashboard can show zeros when the RPC is missing
- M7 Cal chip can paint a booking before sync returns
- M8 checkout success can bounce to the paywall before sync
- M10 `/onboarding` stays outside the paywall
- L1 Apple stub, L2 no finance-settings UI, L3 empty quiz has no advance, L4 email change unused, L5 generic Cal link, L6 default mentor email fallback, L7 lint (56 errors, pre-existing), L8 Nata Sans font warning, L9 actions with no screen

M6 (no “pedir revisão”) is implemented: the panel has a third decision that posts `submitFeedback` without `approved`.

---

## Ship

Merge into **`neuma-stripe`**. Do not merge into **`main`**. Do not deploy production from this retest. Billing stays off until `NEUMA_BILLING_ENABLED` is turned on with the service role key, the webhook secret, and the cutoff already stored for 1 Sep 2026.
