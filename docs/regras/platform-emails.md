# Emails da Plataforma — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Visão Geral

Módulo exclusivo para **Platform Operators (Superadmins)** configurarem emails transacionais do sistema. Gerencia domínio de envio (SendGrid), templates de email e agendamento de envios.

**IMPORTANTE:** Este módulo é diferente de `/integrations` (configuração de email do tenant). Este é para emails do **sistema/plataforma**.

---

## Controle de Acesso

| Regra | Descrição |
|-------|-----------|
| **Acesso restrito** | Apenas `platform_admins` com `is_active = true` |
| **Verificação** | Via hook `usePlatformOperator` |
| **Redirect** | Usuários não-admin são redirecionados para `/` |

---

## Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Página Principal** | `src/pages/SystemEmails.tsx` | Container com verificação de acesso |
| **Configuração SendGrid** | `src/components/integrations/SystemEmailSettings.tsx` | Domínio, DNS, remetente |
| **Templates** | `src/components/integrations/SystemEmailTemplates.tsx` | CRUD de templates |
| **Editor WYSIWYG** | `src/components/integrations/EmailRichTextEditor.tsx` | Editor HTML para templates |
| **Hook de Acesso** | `src/hooks/usePlatformOperator.ts` | Verifica se é superadmin |

---

## Tabelas do Banco

| Tabela | Responsabilidade |
|--------|------------------|
| `system_email_config` | Configuração do domínio, remetente, status de verificação |
| `system_email_templates` | Templates HTML por trigger (auth, convites, tutoriais) |
| `system_email_logs` | Log de todos os emails enviados/falhos |
| `scheduled_system_emails` | Fila de emails agendados (ex: tutoriais com delay) |
| `platform_admins` | Lista de superadmins com acesso ao módulo |

---

## Configuração de Domínio

### Campos de `system_email_config`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sending_domain` | TEXT | Domínio verificado (ex: mail.meuapp.com) |
| `from_name` | TEXT | Nome do remetente |
| `from_email` | TEXT | Email do remetente |
| `reply_to` | TEXT | Email de resposta |
| `dns_records` | JSON | Records DNS para verificação |
| `verification_status` | TEXT | `pending`, `verified`, `failed` |
| `verified_at` | TIMESTAMP | Data da verificação |
| `provider_type` | TEXT | Provider (SendGrid) |

### Fluxo de Verificação

```
1. Admin insere domínio
2. system-email-domain-upsert provisiona no SendGrid
3. Retorna records DNS (CNAME, TXT)
4. Admin configura DNS no provedor
5. system-email-domain-verify checa propagação
6. verification_status muda para 'verified'
```

---

## Templates de Email

### Campos de `system_email_templates`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `template_key` | TEXT | Identificador único (ex: `welcome`, `invite`, `tutorials`) |
| `name` | TEXT | Nome amigável |
| `subject` | TEXT | Assunto do email |
| `body_html` | TEXT | Corpo HTML do email |
| `variables` | TEXT[] | Variáveis disponíveis (ex: `{{user_name}}`) |
| `is_active` | BOOLEAN | Template ativo |
| `auto_send` | BOOLEAN | Envio automático habilitado |
| `send_delay_minutes` | INT | Delay para envio (tutoriais) |

### Templates Padrão

| Key | Trigger | Descrição |
|-----|---------|-----------|
| `welcome` | Novo cadastro | Boas-vindas ao sistema |
| `invite` | Convite de membro | Convite para equipe do tenant |
| `password_reset` | Reset de senha | Link de recuperação |
| `tutorials` | Pós-cadastro | Tutoriais/onboarding (com delay) |

### Variáveis Suportadas

| Variável | Descrição |
|----------|-----------|
| `{{user_name}}` | Nome do usuário |
| `{{user_email}}` | Email do usuário |
| `{{action_url}}` | URL de ação (ex: link de confirmação) |
| `{{store_name}}` | Nome da loja (quando aplicável) |

---

## Edge Functions

| Function | Responsabilidade |
|----------|------------------|
| `system-email-domain-upsert` | Provisiona domínio no SendGrid |
| `system-email-domain-verify` | Verifica DNS do domínio |
| `send-system-email` | Envia email usando config e template |
| `schedule-tutorial-email` | Agenda email de tutorial com delay |
| `process-scheduled-emails` | Processa fila de emails agendados |

---

## Fluxo de Envio

```
┌─────────────────────────────────────────────────────────────┐
│  1. Trigger ocorre (cadastro, convite, etc)                  │
├─────────────────────────────────────────────────────────────┤
│  2. Sistema busca system_email_config                        │
│     → Verifica se domínio está verified                      │
├─────────────────────────────────────────────────────────────┤
│  3. Sistema busca template por template_key                  │
│     → Verifica se is_active = true                           │
├─────────────────────────────────────────────────────────────┤
│  4. Se template tem send_delay_minutes > 0                   │
│     → Insere em scheduled_system_emails                      │
│     → process-scheduled-emails envia depois                  │
├─────────────────────────────────────────────────────────────┤
│  5. Se delay = 0 ou null                                     │
│     → send-system-email envia imediatamente                  │
├─────────────────────────────────────────────────────────────┤
│  6. Resultado é logado em system_email_logs                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Emails Agendados

### Campos de `scheduled_system_emails`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `user_id` | UUID | ID do usuário destinatário |
| `email` | TEXT | Email do destinatário |
| `user_name` | TEXT | Nome do destinatário |
| `template_key` | TEXT | Template a ser usado |
| `scheduled_for` | TIMESTAMP | Horário de envio |
| `status` | TEXT | `scheduled`, `sent`, `failed` |
| `attempts` | INT | Tentativas de envio |

### RLS

| Regra | Descrição |
|-------|-----------|
| **Service role only** | Apenas service role pode acessar (uso interno) |

---

## Logs de Email

### Campos de `system_email_logs`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `recipient` | TEXT | Email do destinatário |
| `subject` | TEXT | Assunto enviado |
| `email_type` | TEXT | Tipo/template |
| `status` | TEXT | `sent`, `failed` |
| `error_message` | TEXT | Erro se falhou |
| `provider_message_id` | TEXT | ID do provider (SendGrid) |

---

## UI do Módulo

### Seção 1: Configuração de Remetente

- Domínio de envio
- Records DNS para verificação
- Botão "Verificar DNS"
- Status de verificação
- Nome e email do remetente

### Seção 2: Templates

- Lista de templates
- Editor WYSIWYG (visual/HTML)
- Preview do template
- Enviar email de teste
- Toggle ativo/inativo
- Configuração de delay (tutoriais)

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Domínio obrigatório** | Emails só são enviados se domínio verificado |
| **Template ativo** | Apenas templates com `is_active = true` são usados |
| **Único por user+template** | `scheduled_system_emails` tem UNIQUE(user_id, template_key) |
| **Retry limitado** | Emails falhos tentam N vezes antes de marcar como failed |
| **Log obrigatório** | Todo envio (sucesso ou falha) gera log |
