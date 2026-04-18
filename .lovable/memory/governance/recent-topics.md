---
name: recent-topics
description: Cache rotativo dos 2 últimos assuntos tratados — atual e anterior. Toda regra técnica aqui DEVE existir também nos docs formais.
type: preference
---

# Assuntos Recentes (rotação obrigatória, máx 2)

## Slot 1 — Assunto ATUAL

**Tema:** Reorganização da política de memória da IA + auditoria contra docs

**Resumo:**
- Memória passou a aceitar apenas governança + cache rotativo dos 2 últimos assuntos.
- Toda regra técnica na memória precisa estar também nos docs formais (Layer 2/3/4).
- Auditoria executada: a regra técnica do Worker `shops-router` (sanitização de `Set-Cookie`/`Vary`/`Pragma` antes do cache, HTML <2KB = bypass, anti-stale via `metadata.storefront_html_version`) foi migrada para os docs antes de a memória técnica ser removida.
- Knowledge atualizado com a seção "POLÍTICA DA MEMÓRIA OPERACIONAL DA IA".

**Docs formais relacionados:**
- `docs/especificacoes/transversais/padroes-operacionais.md` §7 (Padrão Cache Edge no Worker — atualizado com sanitização de headers e validação MISS→HIT)
- `docs/tecnico/base-de-conhecimento-tecnico.md` §9.1 (anti-stale automático via `VERSION` bump)
- `.lovable/memory/governance/memory-protection-rules.md` (nova política)

---

## Slot 2 — Assunto ANTERIOR

**Tema:** Ciclo de vida do token Meta + hidratação WhatsApp pós-reconexão

**Resumo:**
- Discussão sobre quebra silenciosa: ativação de WhatsApp pós-reconexão Meta deve hidratar token, business_id e validade do grant ativo. Toggle sem token = quebra silenciosa proibida.
- Cascade cleanup na desconexão Meta precisa cobrir credenciais derivadas (WhatsApp Business, Pixel, Catalog).
- Pendência aberta: correção do tenant `respeiteohomem` (WhatsApp sem token após reconexão) — plano de 5 passos aprovado conceitualmente, retomar após esta reorganização.

**Docs formais relacionados:**
- `mem://auth/meta/unified-v4-5-standard` (Arquitetura Meta v4.5)
- `mem://infrastructure/whatsapp-meta-integration-standard-v3-2` (UI e arquitetura WhatsApp)

---

## Regra de rotação

Quando um terceiro assunto entrar em pauta:
1. Auditar Slot 2 contra os docs (atualizar docs se houver lacuna).
2. Descartar Slot 2.
3. Slot 1 vira Slot 2.
4. Novo assunto entra como Slot 1.
