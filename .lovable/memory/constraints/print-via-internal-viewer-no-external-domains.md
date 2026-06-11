---
name: print-via-internal-viewer-no-external-domains
description: Impressão de DANFE e Etiqueta sempre via /imprimir (visualizador interno). PROIBIDO abrir URL de parceiro fiscal/logístico (Focus NFe, Correios) direto em window.open — causa ERR_BLOCKED_BY_CLIENT por extensões/proxies corporativos.
type: constraint
---

# Impressão sempre via visualizador interno (/imprimir)

## Regra (rev 2026-06-11)

Toda ação "Imprimir DANFE" e "Imprimir Etiqueta" no admin DEVE abrir o
visualizador interno em `/imprimir?source={danfe|etiqueta}&id={id}`. O
visualizador busca o PDF via backend (`fiscal-download-docs` para DANFE,
`shipping-get-label` + fetch para etiqueta), serve como Blob na origem do
próprio sistema e dispara `iframe.contentWindow.print()` automaticamente.

## Proibido

```ts
// ❌ NUNCA
window.open(invoice.danfe_url, '_blank');
window.open(data.label_url, '_blank');
window.open(`https://api.focusnfe.com.br/...`, '_blank');
```

Abrir URL de parceiro (Focus NFe, Correios CWS, Frenet, etc.) direto causa
`ERR_BLOCKED_BY_CLIENT` em ambientes com:
- AdBlock / uBlock / AdGuard
- Proxies corporativos (Cloudflare Gateway, Cisco Umbrella, Fortinet, Zscaler)
- DNS de segurança que bloqueia domínios "de API"
- Antivírus com filtro web

O usuário sempre acha que o sistema está quebrado. A causa nunca aparece em
console/logs do backend porque o request nem sai do browser.

## Correto

```ts
// ✅ DANFE
window.open(`/imprimir?source=danfe&id=${invoice.id}`, '_blank', 'noopener,noreferrer');

// ✅ Etiqueta
window.open(`/imprimir?source=etiqueta&id=${shipment.id}`, '_blank', 'noopener,noreferrer');
```

## Pontos de uso (varredura obrigatória ao adicionar nova impressão)

- `src/components/fiscal/InvoiceActionsDropdown.tsx` — DANFE individual
- `src/components/fiscal/EmitInvoiceButton.tsx` — DANFE pós-emissão
- `src/components/shipping/ShipmentDetailsCard.tsx` — Etiqueta
- `src/components/shipping/ShipmentGenerator.tsx` — Etiqueta + DANFE em massa
- `src/pages/PrintViewer.tsx` — visualizador (fonte única)

## Exceções

- **Declaração de Conteúdo**: PDF gerado localmente no browser via jsPDF
  (`reprintDeclarationByFiscalInvoiceId`). Não usa URL externa, então não
  precisa passar pelo visualizador.
- **Download em massa** (botão "Baixar"): mantém comportamento atual com
  `Content-Disposition: attachment` direto pelo backend. Download não tem
  problema de bloqueio (browser baixa e não navega).

## Marcação "Impressa"

Continua sendo feita pelo chamador no callback `onPrint` (regra
`fiscal-nf-status-and-print-uniqueness` preservada). O visualizador só
renderiza e imprime; não toca em `danfe_printed_at`.
