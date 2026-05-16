# Plano (rev 2) — Módulo Fiscal 100% em Produção (tenant Respeite o Homem)

## Diagnóstico atual (conferido no banco hoje)

| Item | Estado hoje | Precisa para produção |
|---|---|---|
| Ambiente fiscal | Homologação | Produção (após validação) |
| Empresa no provedor fiscal | Existe, mas status "desconhecido" | Sincronizada e ativa |
| Certificado A1 | Válido até 16/fev/2027 | OK |
| CNPJ certificado vs emitente | **Comparação atual diz "divergente", mas os dois CNPJs são iguais** (mesma numeração, formatação diferente: com x sem pontuação) | Comparar normalizado (só dígitos) |
| Recebimento automático de retornos | Endereço gerado, nunca validado o 1º retorno | Validado em homologação E em produção |
| Token de emissão de produção | Já salvo | OK |
| Reconciliação proativa de notas "processando" | **Não existe** (Lote 1.D pendente) | Necessária antes da virada |
| Declaração de Conteúdo dos Correios | Pronta e documentada | — |

**Conclusão:** o tenant está mais perto do que parecia. Não há divergência real de CNPJ — é bug de comparação. Faltam 4 frentes objetivas + 1 frente técnica nova (reconciliação) que decidi incluir.

---

## Princípios da execução

1. **Nada de emissão real antes do smoke test em homologação passar.** (regra anti-regressão já registrada)
2. **Documentar enquanto se executa**, não depois. Cada onda atualiza o doc fiscal no mesmo movimento.
3. **Cada onda só começa depois que a anterior for aprovada por você.**
4. **Linguagem de negócio na UI** — termos técnicos continuam fora do fluxo do lojista.
5. **Decisões técnicas e de fluxo são minhas; decisões de UI/UX e regra de negócio passam por você.**

---

## Perguntas que dependem de você antes de começar

**Pergunta A — UI/Negócio:** hoje a UI proíbe o lojista comum de trocar o ambiente fiscal (Homologação ↔ Produção); a virada é manual, feita por admin de plataforma. **Mantemos essa regra?** Se sim, cada novo tenant futuro vai precisar de pedido seu para virar. Se não, abrimos um botão "Solicitar liberação para produção" para o lojista (com aprovação no painel de plataforma). Sugestão minha: manter como está.

**Pergunta B — Negócio:** o smoke test em produção precisa de **1 venda real de baixo valor**. Quer que use:
- (i) um pedido seu pessoal,
- (ii) um cliente piloto pré-combinado por você,
- (iii) outro caminho que você definir?

---

## Onda 1 — Saneamento (corrigir o que está travando)

**Objetivo:** zerar pendências técnicas para liberar o smoke test em homologação.

1. **Corrigir comparação de CNPJ** (certificado x emitente) para sempre normalizar (só dígitos). Hoje o card de prontidão acusa divergência falsa só pela formatação.
2. **Ressincronizar a empresa** no provedor fiscal — sair de "desconhecido" e voltar para "ativa". Captura automática dos tokens de homologação e produção (sem campo manual para o lojista).
3. **Ativar e validar o recebimento automático de retornos em homologação** (envia ping, confirma que chegou validado).
4. **Confirmar segredo de recebimento de retornos cadastrado no painel do provedor fiscal** (do nosso lado já está; preciso de você para confirmar do lado do provedor, ou me autoriza a fazer a chamada que valida isso por amostragem).
5. **Validação técnica obrigatória:** Cartão de Prontidão Fiscal mostra "Pronto para teste" sem nenhum item em vermelho.

**Saída esperada:** tenant em homologação, tudo verde no card, pronto para emitir nota de teste.

---

## Onda 2 — Smoke test em homologação (validação real com a Receita)

**Objetivo:** provar ponta a ponta que o fluxo funciona com a Receita no ambiente de teste, **incluindo o gancho com o módulo de Remessas**.

1. Preparar 1 pedido de teste com cliente, endereço, itens com peso/NCM/origem corretos.
2. **Criar Nota Fiscal** (validação local, não transmite) → confirmar que vira "Pronta para Emitir".
3. **Emitir Nota Fiscal de teste** → aguardar autorização da Receita → conferir XML e DANFE de teste.
4. **Verificar a amarração com Remessas:** ao autorizar a nota, o rascunho logístico do mesmo pedido deve receber a chave da nota e ficar elegível para virar etiqueta.
5. **Cancelar a nota de teste** com justificativa válida → confirmar status "cancelada".
6. (Recomendado) Enviar 1 Carta de Correção de teste → confirmar autorização.
7. Emitir 1 Declaração de Conteúdo dos Correios para outro pedido (caminho sem nota) → confirmar PDF gerado correto, com peso preenchido.

**Validação técnica:** os eventos (autorização, cancelamento, CC-e) chegaram pelo recebimento automático sem intervenção manual no banco. Banco consistente.

**Critério de sucesso:** todos os passos passaram automaticamente.

---

## Onda 3 — Implantação da reconciliação proativa (rede de segurança antes da produção)

**Objetivo:** garantir que nenhuma nota fica "processando" indefinidamente caso o retorno do provedor falhe. **Decisão minha:** isso é pré-requisito da virada para produção, não pode ficar para depois.

1. Criar rotina automática que, a cada poucos minutos, varre notas em estado intermediário ("processando", "pendente") há mais de X minutos e consulta diretamente o provedor.
2. Se a Receita já autorizou/rejeitou, atualizar o status no banco e disparar os efeitos colaterais (chave de acesso, XML, DANFE, vínculo com remessa).
3. Respeitar a regra anti-regressão: **status terminal nunca é sobrescrito**.
4. Painel mínimo no Centro de Comando (cartão de execuções) já mostrando contagem de notas em estado intermediário acima do limite — para visibilidade do operador.

**Critério de sucesso:** simular nota "presa" em homologação e ver a rotina destravar sozinha em menos de 1 ciclo.

---

## Onda 4 — Virada para produção real

**Objetivo:** habilitar emissão fiscal de verdade para o tenant.

1. **Sua aprovação explícita** por escrito autorizando a virada (regra anti-regressão obriga).
2. Trocar o ambiente do tenant para Produção (operação técnica, controlada).
3. **Ressincronizar empresa no provedor em produção** + **cadastrar o recebimento automático de retornos novamente, agora no endereço de produção** (não é o mesmo endereço de homologação).
4. Validar o primeiro retorno em produção (sem emitir ainda — só ping/validação do canal).
5. **Smoke test mínimo em produção** com a venda real definida na Pergunta B → emitir → conferir autorização real → conferir DANFE real → cancelar se for o caso.
6. Liberar emissão automática para os pedidos pagos.

**Validação técnica:** o primeiro pedido pago real após a liberação entra na fila, vira rascunho, é emitido, autorizado e o cliente recebe o DANFE.

---

## Onda 5 — Monitoramento ativo nas primeiras 72h

**Objetivo:** garantir que não há falha silenciosa.

1. Acompanhamento diário: notas presas, rejeições, divergências de total, falhas de envio de DANFE por e-mail.
2. A rotina de reconciliação da Onda 3 cuida da maioria; eu monitoro o painel de execuções para flagrar padrão de erro recorrente.
3. Ajustes finos de mensagem na UI conforme padrões reais que aparecerem (qualquer mudança de texto visível ao lojista vem aprovar com você).
4. **Relatório executivo de fechamento** ao final dos 3 dias: nº de notas emitidas, autorizadas, rejeitadas, taxa de sucesso, tempo médio de autorização, qualquer incidente.

---

## Onda 6 — Documentação final consolidada

**Objetivo:** registrar o módulo como "pronto para produção" de forma definitiva.

1. Atualizar o doc fiscal principal marcando o módulo como "Produção liberada" e removendo menções a "piloto" / "smoke test pendente".
2. Atualizar o mapa de UI com qualquer ajuste feito nas Ondas 1–5.
3. Atualizar o doc da Declaração de Conteúdo confirmando integração com produção.
4. Criar/atualizar regras anti-regressão para:
   - comparação de CNPJ sempre normalizada,
   - ativação automática de retornos como única forma suportada,
   - ordem oficial da virada de ambiente (sync → cadastrar recebimento → validar → liberar),
   - reconciliação proativa como rede de segurança obrigatória.
5. Registro do teste fim-a-fim (data, pedido usado, evidências) como anexo do doc fiscal.
6. **Checklist replicável "como virar outro tenant para produção fiscal"** — base para os próximos lojistas.

---

## Critério de fechamento (quando o módulo é considerado 100% pronto)

- Tenant Respeite o Homem emitindo nota real em produção, sem intervenção manual, por 72h consecutivas.
- Zero notas presas em "processando" no fim do período (a reconciliação da Onda 3 destrava sozinha).
- Doc fiscal, mapa de UI e doc da Declaração de Conteúdo atualizados.
- Checklist replicável para outros tenants publicado.

---

## Fora do escopo (explícito)

- Mudança de provedor fiscal.
- NFC-e, NFS-e, NFe de devolução automática.
- Liberação de outros tenants para produção (será feito tenant a tenant, usando o checklist da Onda 6).
- Padronização final dos fluxos de Carta de Correção e Inutilização (pendência herdada — não bloqueia emissão de NF; entra em onda separada se você priorizar).

---

## Detalhes técnicos (bloco opcional, abrir só se quiser ver)

<details>
<summary>O que está por trás de cada onda</summary>

- **Onda 1:** ajuste em `useFiscalReadiness` + `fiscal-integration-validate` para normalizar `certificado_cnpj` vs `cnpj` (só dígitos). Chamar `fiscal-sync-focus-nfe` para sair de `focus_company_status='unknown'`. Acionar `fiscal-webhook-register` em homologação. Confirmar `webhook_status='validated'`.
- **Onda 2:** rascunho → `fiscal-prepare-invoice` → `fiscal-submit` → polling/`fiscal-webhook` → `authorized`. Conferir `nfe-shipment-link` populando `shipments.nfe_key`/`invoice_id`. Depois `fiscal-cancel`. Opcional `fiscal-cce`. DC-e via `correios-content-declaration-issue`.
- **Onda 3:** novo cron (escopo Lote 1.D) — varredura em `fiscal_invoices.status IN ('processing','pending')` com idade > N min → `fiscal-check-status` por nota → respeita guarda de status terminal. Card no `/command-center?tab=executions` para visibilidade.
- **Onda 4:** `UPDATE fiscal_settings SET ambiente='producao', focus_ambiente='producao'`. Re-rodar `fiscal-sync-focus-nfe` e `fiscal-webhook-register` em produção (endereço diferente). Confirmar `ready_for_production=true` no validate.
- **Onda 5:** monitorar `fiscal_invoices` por 72h. A reconciliação da Onda 3 cobre a maior parte. Apenas leitura/observação.
- **Onda 6:** atualizar `docs/especificacoes/erp/erp-fiscal.md`, `docs/especificacoes/transversais/mapa-ui.md`, `docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md`. Criar memórias `mem://constraints/fiscal-cnpj-comparison-normalized`, `mem://features/fiscal/production-rollout-checklist` e `mem://features/fiscal/processing-reconciliation-cron`.

</details>

---

## 📌 Status: Plano revisado proposto. Aguardando:
1. **Sua resposta às Perguntas A e B** acima.
2. **Sua aprovação** para iniciar pela Onda 1.