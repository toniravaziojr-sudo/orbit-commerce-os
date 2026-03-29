📋 CHECKLIST DE CONFORMIDADE:

- ✅ Doc lido: `docs/regras/integracoes.md` (já lido nesta sessão e revalidado agora)
- ✅ Proposta no formato correto (Como funciona hoje / O problema / O que eu faria / Resultado final)
- ✅ Aguardando confirmação do usuário

**Como funciona hoje:**
Hoje o sistema tenta concluir o registro do número de forma incompleta/inconsistente:
1) Em um fluxo, tenta registrar automaticamente com PIN fixo (`123456`).
2) No botão manual, o PIN pode ir vazio.
3) Quando falha, a mensagem ainda orienta desativar 2 etapas.
4) O erro atual visto no banco é: `Invalid parameter phone_number_id`.

**O problema:**
O fluxo está misturando etapas diferentes de validação do número:
- O código que chega por SMS é da validação do número.
- O PIN de 6 dígitos é da segurança da conta (2 etapas).
Sem separar essas etapas, o registro quebra e gera erro confuso para o cliente.

**O que eu faria:**
1) **Corrigir o fluxo para 3 etapas reais no app (sem pedir para desativar segurança):**
   - Etapa A: solicitar código por SMS/voz.
   - Etapa B: validar esse código.
   - Etapa C: registrar o número para uso oficial.
2) **Ajustar a experiência na tela Meta:**
   - “Ação necessária” com passo a passo simples.
   - Campo “Código recebido por SMS”.
   - Campo “PIN de segurança (6 dígitos)” com texto claro (criar novo ou usar o já existente).
3) **Remover comportamentos incorretos atuais:**
   - eliminar PIN fixo.
   - impedir tentativa de registro sem PIN válido.
   - trocar mensagem de erro para orientação correta (sem mandar desligar 2 etapas).
4) **Melhorar os status e avisos:**
   - diferenciar “aguardando validação por SMS” de “aguardando registro final”.
   - no card “Integrações com erro”, mostrar mensagem objetiva e ação direta para concluir.
5) **Atualizar documentação de regras do módulo de integrações** com o novo fluxo oficial.

**Resultado final:**
O cliente conclui a ativação sem reduzir segurança da conta, com etapas claras (SMS + confirmação), e o número conecta de forma previsível.

---

### Detalhes técnicos (implementação)

- **Fluxo backend a ajustar**
  - `supabase/functions/meta-whatsapp-onboarding-callback/index.ts`
    - remover tentativa automática com PIN fixo.
  - `supabase/functions/meta-whatsapp-register-phone/index.ts`
    - validar entrada obrigatória de PIN no registro final.
    - mapear erros de negócio com mensagens corretas.
  - criar ações/funções para:
    - solicitar código (SMS/voz),
    - validar código,
    - então registrar número.

- **UI a ajustar**
  - `src/components/integrations/MetaUnifiedSettings.tsx`
    - transformar botão atual em mini fluxo guiado.
    - separar claramente “código SMS” vs “PIN de segurança”.
    - manter badge “Ação necessária”.

- **Monitoramento**
  - `src/components/dashboard/IntegrationErrorsCard.tsx`
    - mostrar estado/erro correto de validação vs registro.

- **Docs**
  - `docs/regras/integracoes.md`
    - substituir regra antiga de 2FA por fluxo oficial de verificação + registro.