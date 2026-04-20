

# Plano: identificar e corrigir o silêncio total de mensagens recebidas

## Diagnóstico atualizado (com base no cruzamento de hoje)

O que está **comprovado funcionando**:
- Conexão do número ativa, qualidade verde, modo de produção
- Nosso receptor (webhook) responde corretamente quando a Meta testa
- O App está inscrito no canal de mensagens com a URL correta
- Token do tenant válido até junho/2026

O que está **comprovadamente quebrado**:
- Última mensagem real entrando no nosso sistema foi em **13/02/2026** (2 meses atrás)
- O painel de análise da própria Meta confirma **zero conversas iniciadas por cliente** nos últimos 7 dias para esse número
- Ou seja: a Meta também não vê inbound — não é nosso receptor que está perdendo

## A hipótese real (nova, ainda não testada)

Existe uma camada de inscrição que vive **na conta WhatsApp Business (WABA)**, separada da inscrição do App. Essa camada pode ficar "fantasma": aparece como conectada mas não entrega mais nada. Os sintomas batem 100% com isso:
- Outbound funciona (não depende dessa camada)
- Inbound desaparece silenciosamente
- Diagnóstico interno marca tudo verde porque só checa o nível App

A correção exige re-criar essa inscrição na WABA do zero (não apenas re-postar) e instalar um teste real de "ping inbound" para nunca mais ficar 2 meses no escuro.

## O que vou fazer

### Etapa 1 — Reset cirúrgico da inscrição WhatsApp (sem mexer em código)
1. **Remover** o vínculo atual do App com a WABA do tenant (DELETE em subscribed_apps)
2. **Aguardar 30s** para a Meta limpar o cache interno
3. **Recriar** o vínculo enviando explicitamente o campo `messages` no body
4. **Confirmar** consultando o endpoint de override (que mostra fields ativos)

Esse passo é reversível e não altera nada do tenant nem do nosso código. Se a hipótese estiver certa, mensagens voltam a chegar imediatamente.

### Etapa 2 — Teste end-to-end real
- Disparar template aprovado para o seu número (reabre janela 24h)
- Você responde "oi"
- Eu verifico em tempo real se chegou na auditoria bruta

### Etapa 3 — Se Etapa 1 não resolver: investigar Business Manager
A última camada possível é o status do **Business Manager** (nível acima da WABA). Há um caso documentado em que uma alteração no Business Manager pausa silenciosamente as entregas. Vou consultar via Graph API:
- Status de verificação do business
- Se há alguma restrição/pause aplicada
- Se o número foi recentemente migrado entre WABAs (causa conhecida de silêncio)

Se encontrarmos algo aqui, será resolvido no painel da Meta com instruções claras.

### Etapa 4 — Defesa permanente (após confirmação de que voltou)
Instalar um **canário de inbound**: a cada 6h, um job verifica se houve QUALQUER mensagem recebida no sistema (qualquer tenant). Se ficar mais de 24h sem nenhuma, abre incidente automaticamente. Isso evita que o silêncio se prolongue por meses como aconteceu agora.

## Por que esse plano é diferente das tentativas anteriores

| Tentativa anterior | Este plano |
|---|---|
| Re-postar inscrição no nível App | Resetar inscrição no nível WABA (camada diferente) |
| Confiar em "está verde" no diagnóstico | Provar com analytics da própria Meta que ela não vê inbound |
| Pedir aprovação de display name | Descartado — não bloqueia inbound, só limita outbound |
| Endurecer monitor existente | Adicionar canário de inbound real (não confia em status, confia em fato) |

## O que preciso de você
Apenas **confirmar** que posso executar a Etapa 1 (reset da inscrição). Ela não interrompe o serviço — outbound continua normal, e se inbound estiver mesmo "fantasma", ele só pode melhorar.

## Bloco técnico (opcional)
- DELETE → POST sequence em `/{WABA_ID}/subscribed_apps` com `subscribed_fields=["messages",...]` no body
- Consulta a `conversation_analytics` da WABA para validação independente
- Verificação do Business Manager via `/{BUSINESS_ID}?fields=verification_status,primary_page,is_disabled_for_integrity_reasons`
- Novo cron `whatsapp-inbound-canary-6h` checando `MAX(timestamp) FROM whatsapp_inbound_messages` global

