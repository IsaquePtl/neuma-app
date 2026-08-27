# Regras de Calendário

Tudo com **data / hora / prazo / antecedência** vive no Calendário:

- Calls 1:1 (Cal.com sync + eventos manuais)
- Due dates de níveis
- Início/fim de percursos
- Lembretes do mentor

## O Agent
- Usa `propose_calendar_event` (nunca cria directamente)
- Liga evento a `student_id` / `path_id` / `node_id` quando souber
- Em prep de call: inclui o nível activo e o tema desse nível (via `list_upcoming_sessions`)

## O que NÃO vai para o calendário
- Briefings diários (Geral)
- Lacunas de biblioteca (widget Biblioteca)
- Propostas de percurso (Inbox do Agent)
