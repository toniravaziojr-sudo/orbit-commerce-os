---
name: AI Test Sandbox Mirror Only
description: Sandbox de teste da IA de Atendimento deve ser espelho automático da IA de produção, nunca cópia paralela com manutenção independente
type: constraint
---

# IA de Teste = Espelho Automático da IA de Atendimento

## Regra

A "IA Teste" exposta em `/atendimento` aba "IA Teste" **NÃO é uma cópia** da IA de Atendimento. É a **mesma IA**, executada através de uma camada fina de sandbox.

- **Backend:** a edge `ai-test-sandbox` apenas cria uma conversa marcada com `metadata.is_sandbox=true`, insere a mensagem do usuário e **invoca a edge `ai-support-chat` original** (mesma pipeline, prompts, tools, configurações do tenant, modelo).
- **Frontend:** o componente `AISandboxChat` é só uma janela de chat — não contém lógica de IA.

## É PROIBIDO

- Duplicar arquivos da pasta `_shared/sales-pipeline/` para uma versão "test" ou "sandbox".
- Criar uma `ai-support-chat-test/` com cópia da pipeline.
- Adicionar lógica de prompt, tools, ou regras de negócio dentro de `ai-test-sandbox/index.ts` ou `AISandboxChat.tsx`.
- Manter "configurações de IA" separadas para o teste — a config é única (`ai_support_config` do tenant).

## Por quê

O propósito do sandbox é permitir que o usuário teste **exatamente** o que vai acontecer em produção. Qualquer divergência derrota o objetivo. Manutenção dupla = bug garantido.

## O que `ai-test-sandbox` PODE fazer

- Criar/apagar conversa marcada como sandbox.
- Inserir mensagens do usuário no banco com `metadata.is_sandbox=true`.
- Chamar a `ai-support-chat` via fetch interno.
- Retornar as mensagens da IA para o front.
- Validar acesso do usuário ao tenant.

## Agent Mode (exceção controlada — apenas Respeite o Homem)

Para permitir que o backend execute roteiros automatizados de teste sem JWT de usuário, a função aceita um "Agent Mode" com **dois gates obrigatórios**:

1. Header `x-agent-mode: true` **+** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (só o backend tem).
2. `tenant_id` do body **deve ser exatamente** `d1a4d0ed-8842-495e-b741-540a9a345b25` (Respeite o Homem). Qualquer outro tenant retorna 403.

Regras:
- Agent Mode **NÃO** muda nada da pipeline da IA — continua chamando `ai-support-chat` original.
- Conversas criadas em Agent Mode mantêm `is_sandbox=true` (isolamento total de métricas/aprendizado).
- É PROIBIDO estender Agent Mode para outros tenants sem nova autorização explícita do usuário e atualização desta memória.
- É PROIBIDO usar Agent Mode para qualquer coisa fora de testes da IA de atendimento (ex.: gravar produtos, disparar webhooks externos, etc.).

## Isolamento obrigatório

Toda query que alimenta métricas, funil, aprendizado da IA, ou listagem de atendimento **DEVE** filtrar `metadata->>is_sandbox != 'true'`. Já aplicado em:

- `useConversations` (lista de atendimento)

Quando criar novos hooks/agregadores que leiam `conversations` ou `messages`, aplicar o mesmo filtro.

## Como mudar a IA de teste

**Você não muda a IA de teste.** Você muda a IA de Atendimento (`ai-support-chat`, `_shared/sales-pipeline/`, `ai_support_config`) e a mudança aparece automaticamente no sandbox no próximo turno.
