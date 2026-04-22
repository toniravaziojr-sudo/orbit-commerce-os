---
name: Contexto de Teste Ativo — Agente IA Suporte
description: Número e tenant usados para validar ajustes no fluxo de saudação do ai-support-chat
type: reference
scope: session
---

**Tenant de teste:** respeiteohomem
**Número WhatsApp de teste:** 73 991681425 (formato E.164: 5573991681425)

**Contexto do trabalho em andamento:**
Validação dos 3 reforços de saudação no `ai-support-chat`:
1. Eco de saudação (espelhar "Oi/Bom dia/Boa noite" do usuário)
2. Identificação da loja (apenas no primeiro contato)
3. Fechamento cordial (proibido encerrar de forma seca; sempre incluir frase amigável tipo "estou aqui para ajudar")

Aplicado tanto no branch de **primeiro contato** quanto no de **reabertura** (este último sem a regra 2).

Histórico do número foi limpo para permitir testes do zero (primeira mensagem + reabertura).
