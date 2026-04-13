# Memory: infrastructure/base-conhecimento-tecnico
Updated: 2026-04-13

Base de Conhecimento Técnico do sistema (doc completo em docs/tecnico/base-de-conhecimento-tecnico.md). Registra problemas→soluções, anti-patterns e decisões arquiteturais. DEVE ser consultado antes de qualquer correção ou implementação.

## Lições Registradas (resumo):
1. **useEffect + array derivado** → loop infinito, UI não responde → usar useMemo + useRef flag
2. **Valores hardcoded em edge functions** → buscar do banco por tenant
3. **CHECK constraint com now()** → usar triggers de validação
4. **PIX/Boleto expiração** → 100% via API (Pagar.me: expires_in, MP: date_of_expiration)
5. **Parcelamento cartão** → 100% via API em ambos gateways
6. **Schemas reservados Supabase** → nunca alterar (auth, storage, realtime, etc)
7. **Cron** → fallback apenas, nunca fluxo primário
8. **Memória IA** → nunca memorizar diagnósticos da IA, só fatos explícitos do usuário
9. **payment_method_discounts** → fonte unificada de descontos + parcelas + expiração
10. **WhatsApp Meta** → sempre System User Token, verificar WABA produção vs teste, Cloudflare Worker sincronizado
11. **Builder defaults** → templates salvos no DB sobrescrevem defaults novos do código
12. **Queries de menu** → nunca usar .limit() arbitrário
13. **Formulários de entidade** → sempre incluir campo de upload se a tabela tem coluna de imagem
14. **Frete com valor zero** → logar falhas dos provedores claramente, nunca retornar R$0 silenciosamente
15. **Fluxos de campanha** → Blog e Mídia Social devem ser separados (prop campaignType)
16. **free_installments no hook público** → campo OBRIGATÓRIO; nunca adicionar config na tabela/admin sem propagar para o hook público do storefront. Descrição do PaymentMethodSelector deve ser dinâmica. ✅ Validado em 2026-04-13.
17. **Frenet peso em KG vs gramas** → O agregador shipping-quote usa gramas internamente (Correios). O adaptador do Frenet DEVE converter para KG (÷1000). Sempre logar respostas de APIs externas. Nunca exibir termos técnicos como "(fallback)" em labels visíveis ao cliente. ✅ Validado em 2026-04-13.
18. **Checkout Links sem processamento de URL** → Links de checkout (direto e personalizado) geravam URLs mas o checkout não processava os params ?product= e ?link=. Hook useCheckoutLinkLoader criado para ler params, buscar produtos, popular carrinho, aplicar cupom/frete/preço override. RLS pública adicionada para checkout_links ativos. Regra: sempre implementar emissor + receptor simultaneamente.
19. **Geração de imagens de produto — contrato assíncrono ignorado** → AIImageGeneratorDialog tratava resposta da creative-image-generate como síncrona, mas a função retorna 202 + job_id e processa em background. Frontend nunca recebia as URLs geradas. Corrigido com polling na creative_jobs (4s, max 5min) + insert em product_images ao concluir. Regra: todo consumidor de edge function assíncrona DEVE implementar polling ("submit → poll → reconcile").

## Correções Validadas (2026-04-13):
- **Frete (tenant respeiteohomem):** Frenet recebia peso em gramas (300) em vez de KG (0.3), rejeitava silenciosamente. Corrigido no adaptador + log adicionado + label "(fallback)" removido.
- **Pagamentos (tenant respeiteohomem):** free_installments não era propagado para o hook público, causando "sem juros" em todas as parcelas. Corrigido no hook + descrição dinâmica no PaymentMethodSelector.
- **Geração de imagens de produto:** AIImageGeneratorDialog reescrito para padrão assíncrono com polling. ✅ Validado tecnicamente em 2026-04-13.
