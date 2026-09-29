# Contextos Neuma 1:1 (perfis pedagógicos)

Prompts / contextos pedagógicos para montar percursos dos alunos de teste.

## Alunos

| Ficheiro | Chave `load_student_context` | Nome |
|----------|------------------------------|------|
| `eduardo.md` | `eduardo` | Edu / Eduardo |
| `marcio.md` | `marcio` | Márcio |
| `bernardo.md` | `bernardo` | Bernardo |

## Wiring (activo)

- Tool `load_student_context` (`contexts/loader.py`) — disponível no **journey pipeline** e no **journey_specialist** do supervisor.
- Inject automático no system prompt do journey quando `placeholder_name` faz match ao nome/chave.
- Catálogo listado no system prompt do supervisor.

## Uso

O agent (ou o builder determinístico) cria o percurso `status=draft` no app.
HITL: o aluno só vê depois do mentor activar em Journeys.
