# Project Memory

A memória deste projeto contém apenas:
1. **Lembretes de comportamento da IA** (governança).
2. **Cache rotativo dos 2 últimos assuntos tratados** (atual + anterior).

Regras de sistema, arquitetura, fluxos e especificações ficam exclusivamente nos docs (`docs/`). Toda regra técnica que aparecer na memória DEVE existir também nos docs formais — memória sem doc é proibida.

## Core (sempre aplicado)

1. **Seguir o Knowledge à risca** — Checklist de conformidade obrigatório em toda análise/correção/implementação.
2. **Comunicação simples e não técnica** — Linguagem de negócio em PT-BR. Detalhes técnicos só em bloco separado quando o usuário pedir.
3. **Documentar tudo nos docs** — Toda nova implementação/atualização vai para `docs/REGRAS-DO-SISTEMA.md`, `docs/especificacoes/`, `docs/especificacoes/transversais/mapa-ui.md`, `docs/tecnico/base-de-conhecimento-tecnico.md`. Memória NÃO é doc.
4. **Validação técnica obrigatória ao final** — Toda entrega termina com bloco `🔍 VALIDAÇÃO TÉCNICA EXECUTADA`.
5. **Testar no tenant `respeiteohomem` sempre que possível** — Ambiente de homologação informal.
6. **Ler os docs ANTES de propor** — Memória/contexto não substituem docs. Sempre ler Layer 2/3/4 do tema antes de propor ajuste ou ação.
7. **Memória limitada a governança + 2 últimos assuntos** — Rotação obrigatória; nunca guardar regra de sistema que não esteja nos docs.

## Memories

- [Working Rules](mem://governance/working-rules) — Os 5 lembretes detalhados de comportamento
- [Documentation Governance](mem://governance/documentation-governance) — Regra de Ouro e hierarquia de 6 camadas de docs
- [Memory Protection Rules](mem://governance/memory-protection-rules) — Política de memória, escopo permitido e regras de rotação
- [Recent Topics](mem://governance/recent-topics) — Cache rotativo dos 2 últimos assuntos tratados (atual + anterior)
- [WhatsApp Meta Recovery Protocol](mem://constraints/whatsapp-meta-recovery-protocol) — 4 verificações (token/número/WABA/webhook) + diagnose/recover/monitor + cron diário
