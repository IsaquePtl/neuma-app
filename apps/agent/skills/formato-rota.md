# Formato: ROTA DE TRANSFORMAÇÃO

Quando pedires ou gerares o brief do aluno, usa exactamente esta estrutura em Markdown:

```
### 🗺️ ROTA DE TRANSFORMAÇÃO: NOME

#### Perfil do Aluno (Nome)
- **Histórico:** …
- **Ponto de Partida:** …
- **Objetivos:** …

---

#### Planeamento por Níveis (Nodes)

##### FASE 1: …
* **Nível 1 | Conceito (Vídeo-Guia Gravado):**
  - *Tema:* …
  - *Entregável:* …
* **Nível 2 | Prática (Desafio com Check-in em Vídeo):**
  - *Tema:* …
  - *Exercício:* …
* **Nível 3 | Conceito …**
* **Nível 4 | Check-point (Marco de Transição):**
  - *Validação:* …

##### FASE 2: …
… (inclui tipicamente uma Sessão 1:1)

##### FASE 3: …
… (termina em Conquista / Marco Final)
```

## Mapeamento para a app
| Texto no brief | `node_kind` |
|----------------|-------------|
| Conceito / Vídeo-Guia | `lesson` |
| Prática / Desafio | `practice` |
| Sessão 1:1 / Call | `call` |
| Check-point / Conquista / Marco | `milestone` |

Ao criar proposta de percurso, cada nível vira um node com `title`, `description`, `kind`, `order_index` (1-based sequencial).
