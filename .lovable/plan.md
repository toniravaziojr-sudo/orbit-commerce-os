

📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras do Sistema: ✅ lido (governance/working-rules + memórias auth/meta/unified-v4-5)
- Doc formal do tema: ⚠️ Lacuna parcial — `docs/especificacoes/sistema/hub-integracoes.md` cobre estrutura, mas **não documenta ciclo de vida do token Meta** (refresh, expiração, invalidação 190/460). Será criado.
- Fluxo afetado: OAuth Meta → Long-lived token → Refresh automático → Detecção de invalidação
- Fonte de verdade: `tenant_meta_auth_grants` (status, token_expires_at)
- Módulos impactados: Integrações Meta, WhatsApp, Pixel, CAPI, Publicação FB/IG, Anúncios
- Impacto cruzado: todas as integrações que dependem do token Meta caem juntas se o token invalidar
- mapa-ui.md: ✅ a atualizar (remoção do botão "Atualizar")
- Situação: Aguardando confirmação do usuário

---

## 🎯 Diagnóstico

**Sintoma:** Tenant respeiteohomem com WhatsApp pendente. Reconectar não resolve. Token Meta de 31/03 ainda marcado `active` no banco, mas Meta retorna erro 190/460 (sessão invalidada).

**Causa raiz (3 problemas combinados):**

1. **Não há refresh automático rodando.** Existe a função `meta-token-refresh` pronta para renovar tokens long-lived (60 dias), mas **nenhum cron está agendando ela**. Tokens vencem ou ficam stale silenciosamente.
2. **O botão "Reconectar" não força nova autorização.** A URL OAuth não envia `auth_type=reauthorize`, então o Facebook reusa a sessão antiga em vez de gerar token novo. Por isso "reconectar" várias vezes não trocou o grant ativo (último é de 18 dias atrás).
3. **Sistema não detecta token invalidado.** Quando a Meta invalida (troca de senha, revogação, mudança de segurança), o banco continua marcando como `active`. O usuário só descobre quando algo para de funcionar.

**Por que "Atualizar" não faz nada visível:** ele só recarrega o cache local do React. Não chama a Meta. Como o banco diz "active", a tela continua mostrando "Conectado". É um botão inútil que confunde.

---

## 🛠️ Plano de Solução (definitivo, sem remendo)

### 1. Refresh automático real (resolve 90% dos casos)
- Ativar **cron diário** chamando `meta-token-refresh` com `refreshAll: true`.
- A função já existe e renova qualquer grant que expira nos próximos 7 dias, estendendo por mais 60 dias.
- **Resultado:** enquanto o token estiver válido na Meta, ele se renova sozinho indefinidamente. Usuário nunca mais precisa reconectar por expiração natural.

### 2. Detecção ativa de token inválido (resolve troca de senha / revogação)
- Criar **health check diário** (cron) que chama `/me` na Graph API para todo grant ativo.
- Se Meta responder com erro 190 (qualquer subcode: 460 senha trocada, 458 app removido, etc.), marcar grant como `expired` no banco automaticamente.
- **Resultado:** banco reflete a realidade. UI mostra "Expirado" assim que detectar, com instrução clara de reconectar.

### 3. Reconexão que realmente funciona
- Adicionar `auth_type=reauthorize` na URL OAuth quando o usuário clicar "Reconectar".
- Isso força o Facebook a apresentar a tela de permissões de novo e gerar token fresco, mesmo com sessão Facebook ativa.
- **Resultado:** um clique em "Reconectar" sempre resolve. Sem precisar remover app no Business Manager.

### 4. UI limpa (sem botões inúteis)
- **Remover** o botão "Atualizar" (não tem função real — UI já recarrega sozinha).
- **Manter** "Reconectar" e "Desconectar".
- Quando grant for marcado `expired`, exibir alerta destacado com botão "Reconectar" único e claro.
- Mostrar status de saúde do token (última verificação, próxima renovação).

### 5. Validação técnica + E2E (obrigatório antes de fechar)
- **Validação técnica (eu executo):**
  - Confirmar cron criado e ativo.
  - Disparar `meta-token-refresh` manual no tenant problema → confirmar grant atualizado.
  - Disparar health check manual → confirmar que detecta o erro 190 atual e marca grant como expired.
  - Validar que nova URL OAuth contém `auth_type=reauthorize`.
- **E2E (você executa, eu instruo):**
  - Reconectar Meta no respeiteohomem → confirmar grant novo no banco (granted_at = hoje).
  - Reativar WhatsApp → confirmar status connected.
  - Enviar mensagem teste pela API.

### 6. Documentação completa
- Atualizar `docs/especificacoes/sistema/hub-integracoes.md` com seção nova: **"Ciclo de Vida do Token Meta"** (refresh, health check, invalidação, reconexão).
- Criar memória anti-regressão `mem://constraints/meta-token-lifecycle` com a regra: *"Toda integração OAuth long-lived precisa de cron de refresh + health check + auth_type=reauthorize no botão de reconectar"*.
- Atualizar `mapa-ui.md` registrando remoção do botão "Atualizar".
- Bloco "Problema × Solução" no doc do hub explicando os 3 cenários (expiração natural, invalidação por segurança, revogação manual) e como o sistema responde a cada um.

---

## 📦 Resultado final

| Cenário | Hoje | Depois |
|---|---|---|
| Token vai expirar em <7 dias | Quebra silenciosa | Renovado automaticamente |
| Usuário troca senha do Facebook | UI mostra "conectado" mas tudo quebra | Detectado em <24h, badge "Expirado", botão claro |
| Usuário clica "Reconectar" | Reusa sessão velha, não troca token | Sempre força token novo |
| Usuário clica "Atualizar" | Não faz nada útil | Botão removido |

**Confirma que aplico esse plano completo (1+2+3+4+5+6)?**

