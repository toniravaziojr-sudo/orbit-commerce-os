# Project Memory

A memória deste projeto contém APENAS lembretes de comportamento da IA. Regras do sistema, arquitetura, fluxos e especificações estão exclusivamente nos docs (`docs/`).

## Core (sempre aplicado)
1. **Seguir o Knowledge à risca** — Checklist de conformidade obrigatório em toda análise/correção/implementação.
2. **Comunicação simples e não técnica** — Linguagem de negócio em PT-BR. Detalhes técnicos só em bloco separado quando o usuário pedir.
3. **Documentar tudo nos docs** — Toda nova implementação/atualização vai para `docs/REGRAS-DO-SISTEMA.md`, `docs/especificacoes/`, `docs/especificacoes/transversais/mapa-ui.md`, `docs/tecnico/base-de-conhecimento-tecnico.md`. Memória NÃO é doc.
4. **Validação técnica obrigatória ao final** — Toda entrega termina com bloco `🔍 VALIDAÇÃO TÉCNICA EXECUTADA`.
5. **Testar no tenant `respeiteohomem` sempre que possível** — Ambiente de homologação informal para novos ajustes.
6. **Ler os docs ANTES de propor** — Memória/contexto não substituem docs. Sempre ler Layer 2/3/4 do tema antes de propor ajuste ou ação.

## Memories (governança apenas)
- [Working Rules](mem://governance/working-rules) — Os 5 lembretes detalhados de comportamento
- [Documentation Governance](mem://governance/documentation-governance) — Regra de Ouro e hierarquia de 6 camadas de docs
- [Memory Protection Rules](mem://governance/memory-protection-rules) — Escopo permitido e memórias protegidas
- [Storefront Worker Prerender Bypass](mem://constraints/storefront-worker-prerender-bypass) — Anti-regressão: HTML <2KB do Worker = bypass do pré-render, investigar imediatamente
