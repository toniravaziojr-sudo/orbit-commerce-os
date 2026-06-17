---
name: Saídas da IA exibidas ao lojista são SEMPRE PT-BR
description: Todo texto livre gerado por IA e exibido na UI (rationale, diagnóstico, descrição de público, copy, headline, justificativa, título de aprendizado) deve estar em Português do Brasil simples e executivo. Inglês, jargão técnico e nomes internos são proibidos. Aprendizado da IA mostra APENAS o texto do usuário, nunca o raciocínio da IA.
type: constraint
---

## Regra (inegociável)

Qualquer campo de texto livre produzido pela IA e exibido ao lojista DEVE estar em **Português do Brasil**, em linguagem simples e executiva. Vale para:

- Justificativa da proposta ("Por que a IA recomendou…")
- Diagnóstico do plano estratégico
- Descrição de público / motivo de exclusão
- Copy, headline, descrição de anúncio
- Mensagens do chat da IA
- Título e descrição de Aprendizado da IA
- Avisos, sugestões e insights

**Proibido**: inglês, anglicismos, jargão técnico ("rationale", "scaling", "retargeting" sem tradução), nomes internos de campos/funções/tabelas, código.

## Mecanismos de garantia

1. **Prompts do Estrategista (Meta/Google/TikTok)** contêm bloco explícito proibindo inglês em qualquer campo livre, com exemplos do que NÃO fazer.
2. **Descrições do schema JSON** (rationale, audience_description, etc.) reforçam "OBRIGATÓRIO em PT-BR".
3. **Aprendizado da IA**: o título e a descrição vêm SOMENTE do texto que o usuário escreveu no feedback. O raciocínio/diagnóstico da IA fica apenas em metadata (auditoria), nunca aparece no card. Misturar os dois — como acontecia antes da Onda 3.3 — é regressão.
4. **Saneamento retroativo**: quando texto em inglês for detectado em produção, reescrever o conteúdo via migração determinística (sem custo adicional de IA quando o volume for pequeno).

## Anti-regressão

- Quem adicionar novo campo livre gerado por IA exibido na UI DEVE reforçar a instrução de PT-BR no prompt correspondente.
- Proibido concatenar `observation` (raciocínio da IA) com `reason_text` (texto do usuário) para formar título de aprendizado.
- Toda PR que toca prompts da IA precisa responder no checklist: "campos livres exibidos ao lojista estão garantidos em PT-BR? Sim/Não".

Doc oficial: `docs/especificacoes/marketing/gestor-trafego.md` — seção "Onda 3.3 (2026-06-17) — Saídas da IA são sempre PT-BR".
