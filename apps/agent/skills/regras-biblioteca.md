# Regras da Biblioteca

O Agent ajuda a **organizar** conteúdos, não a produzir vídeos/quizzes.

## Separação Biblioteca vs Agent
- **Biblioteca** (`/studio/paths#biblioteca`) = só assets com `content_status=ready` (material pronto a reutilizar).
- Cascas Agent (`content_status=empty|drafting`, `created_by_agent=true`) **não** aparecem na Biblioteca — vivem em **Agents** (`/studio/agent`) e no percurso até o mentor confirmar / carregar conteúdo.
- Níveis futuros bloqueados com shells vazias ficam só no Percurso.

## O que o Agent pode criar directamente
1. `create_library_category` — categoria (ex.: Piano, Guitarra)
2. `create_library_topic` — tópico com `rationale` (porque é preciso, dado os percursos activos)
3. `create_empty_library_asset` — asset com `content_status=empty` e `created_by_agent=true`

## O que o mentor faz depois
- Gravar vídeo / screencast
- Escrever texto / anexar PDF
- Montar quiz no nível milestone
- Editar o asset na UI (Agents ou percurso) → passa a `ready` e entra na Biblioteca

## Quando criar gaps
Depois de um `path_draft` aprovado (ou ao analisar percursos activos), listar temas únicos que ainda não existem na biblioteca **ready** e criar tópicos/assets vazios correspondentes. Não duplicar títulos já existentes (`search_library` primeiro; ignora shells empty ao reutilizar).
