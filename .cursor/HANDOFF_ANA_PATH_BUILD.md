# HANDOFF — Isaque pediu BUILD AGORA (via Dev / Grok Bot)

## Objectivo
Executar o plan **Ana path full system** (`ana_path_full_system_e3722cb8`) na branch `neuma-stripe`.

Meta de produto: percursos 100% funcionais para, via agents no Grok Bot, criar um percurso de cliente novo do zero — **só** falta conteúdo real (vídeos/textos) que o Isaque preenche depois. Placeholders/`ready` stubs OK.

## Não fazer
- Não merge/deploy a `main`/prod
- Não activar Eduardo/Márcio/Bernardo nem paths beta live
- Não inventar conteúdo pedagógico rico — shells/stubs bastam

## Ordem (do plan)
1. Harden gates: `path_draft` defaults (`defaultPassRule(kind)` + check_in_kind/phase/node_code); unificar advance no approve feedback → `completeCurrentAndActivateNext`
2. Biblioteca mínima ready: 1 vídeo lesson, 1 vídeo practice, 1 texto (picker `/studio/library`)
3. Seed path QA Ana Ribeiro: template `QA — Percurso Completo` (10 nós da tabela do plan) + apply + active + 1º nó active + quizzes reais nos milestones quiz
4. Corrigir UI/edges ao percorrer
5. Deixar checklist dos 9 smoke scenarios verdes em localhost

## Cobertura mínima do path QA (ver plan completo)
QA-L1 lesson/none → QA-P1 practice/check_in video → QA-P2 practice/check_in text → QA-M1 milestone/quiz → QA-C1 call/mentor → QA-L2 lesson/none → QA-M2 milestone/mentor → QA-R1 resource→lesson/none → QA-P3 practice/check_in video (revision/extend) → QA-END milestone/quiz → path completed. Phases A (1–5) / B (6–10).

## Done quando
- PR (ou commits) em `neuma-stripe` / branch de trabalho com gates + seed
- Ana consegue percorrer todos os gates; mentor approve/advance funciona
- Report curto: ficheiros tocados + o que falta para o grupo Neuma validar E2E

Plan local: `~/.cursor/plans/ana_path_full_system_e3722cb8.plan.md`
