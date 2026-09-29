# VALIDATION — Ana path full system

Percurso QA da Ana Ribeiro (`ana.ribeiro.teste@neuma.test` / `neuma123`) + gates do produto. **Não activa Eduardo / Márcio / Bernardo.**

Seed (apps/web):

```bash
node --experimental-strip-types --env-file=.env.local scripts/seed-qa-ana-path.mjs
# recria o path da Ana (apaga check-ins desse path):
node --experimental-strip-types --env-file=.env.local scripts/seed-qa-ana-path.mjs --reset
```

Studio: Jornadas → **Seed QA Ana Ribeiro**. Template `QA — Percurso Completo` fica `ready` no picker `/studio/library`.

Migrations: `0037_teoria_musical_path.sql` (pass_rule / phase_key / node_code) e `0038_node_duration_weeks.sql` (`duration_weeks` nos nós live). Aplicar no Supabase do ambiente **neuma-stripe**, não em main/prod.

## Smoke (9 cenários)

| # | Cenário | Verificado neste PR | Precisa walkthrough localhost |
|---|---------|---------------------|-------------------------------|
| 1 | Marcar visto (QA-L1 lesson / `none`) | Player mostra CTA «Marcar como visto»; `markNodeSeen` usa `completeCurrentAndActivateNext` via service role (RLS aluno só SELECT). | Login Ana → `/path` → abrir L1 → visto → P1 fica active, futuros locked. |
| 2 | Check-in vídeo → pending → approve → next | P1 `check_in`+vídeo; approve em `feedbacks.ts` chama o mesmo helper (locking de irmãos). | Enviar vídeo; Studio Check-ins approve; P2 active. |
| 3 | Check-in texto → approve | P2 `check_in_kind=text`; form de 2 passos; texto não consome slot de vídeo. | Enviar texto; approve → M1 active. |
| 4 | Quiz fail &lt; 60 / pass ≥ 60 | M1 e END com 2 MC reais; `submitQuizAttempt` só avança se `pass_rule=quiz` e nota ≥ limiar. | Falhar de propósito; repetir e passar → C1 / completed. |
| 5 | Call sem self-complete; mentor advance | C1 mostra booking + aviso «só o mentor avança». Home não trata call como check-in. | Marcar sessão; confirmar que o nível não muda; Studio `advanceLevel`. |
| 6 | Milestone mentor-only | M2 **não** mostra quiz gate; aviso de espera pelo mentor. | Abrir M2; só avança com Studio. |
| 7 | Reject vídeo → needs_revision → novo slot | Reject incrementa `week_extensions` (já existia); P3 é o 2.º vídeo para slot/revisão. | Reject P1 ou P3; CTA volta a permitir envio. |
| 8 | Mapa: locked futuros; phase headers | `isPhaseBoundary` + `phase_key` A (1–5) / B (6–10). | `/path` mostra «Fase A» / «Fase B»; cadeado nos futuros. |
| 9 | Path `completed` no fim | Último avanço (quiz END ou mentor) faz `paths.status=completed`. | Passar QA-END; ficha Ana + `/path` mostram concluído. |

## Biblioteca mínima

Categoria **QA Teste** (`qa-teste`) / tópico Stubs, todos `content_status=ready`:

- aula vídeo (Big Buck Bunny mp4)
- prática vídeo (Elephants Dream mp4)
- texto stub

Só assets `ready` entram no picker (já era a regra). Snapshot URL/body no apply — **não** há `library_asset_id` vivo no nó.

## O que não foi verificado aqui

- Browser E2E autenticado (Ana + mentor) neste ambiente: sem sessão de utilizador / app a correr contra o Supabase do preview.
- Upload R2 de check-in vídeo e Cal.com real.
- Aplicar migration 0037/0038 na base remota (o PR só adiciona os ficheiros).

## Riscos residuais (RLS / authz)

- Alunos **continuam sem** política `UPDATE` em `nodes`/`paths`. O avanço do aluno (`markNodeSeen`, quiz ≥ limiar) e o approve de check-in passam pelo **service role** em `completeCurrentAndActivateNext`. Sem `SUPABASE_SERVICE_ROLE_KEY` no server, self-advance falha alto (em vez de no-op silencioso).
- Check-ins, quizzes e leitura do path usam RLS normal (aluno INSERT/SELECT nas próprias linhas).
- Agent `path_draft` apply agora grava `pass_rule` via `defaultPassRule(kind)` — práticas deixam de nascer presas em `mentor`.
- Kind `resource` no QA-R1: o editor de Studio ainda mapeia resource→lesson na UI; o seed grava `resource` de propósito para o enum legado.
- `duration_weeks` null no template passa a 1 no resegment **se** houver pelo menos uma duração custom; se todas forem null, mantém o auto-split.

Correr testes locais (sem DB):

```bash
node --experimental-strip-types --test apps/web/lib/path-period.test.ts apps/web/lib/nodes/pass-rule.test.ts apps/web/lib/qa-path/curriculum.test.ts
```
