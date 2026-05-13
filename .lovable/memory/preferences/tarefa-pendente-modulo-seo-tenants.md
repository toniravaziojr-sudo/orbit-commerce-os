---
name: Tarefa Pendente — Módulo de SEO próprio para tenants
description: Backlog registrado pelo usuário; iniciar somente quando solicitado
type: preference
---

# Tarefa Pendente — Módulo "Saúde de SEO" para tenants

## Status
**Backlog declarado pelo usuário em conversa.** NÃO iniciar implementação até pedido explícito. Outras prioridades estão na frente.

## Contexto
O verificador de SEO da Lovable cobre apenas o site da plataforma (`app.comandocentral.com.br`). Os tenants já possuem campos de SEO por entidade (produto, categoria, página, blog), geração de SEO com IA, sitemap e robots por loja, Open Graph e favicon multi-tenant — mas não possuem um **diagnóstico consolidado** com nota, lista de problemas e correção rápida.

## Escopo da tarefa futura
Construir, dentro do Comando Central, um módulo "Saúde de SEO" por tenant com:
- Nota geral da loja
- Lista de problemas agrupados por tipo (loja, páginas, produtos, categorias, blog)
- Botão de correção rápida via IA reaproveitando a geração de SEO já existente
- Re-scan sob demanda
- Em ondas: começar pelo essencial (título, descrição, imagem OG, sitemap, robots, alt) e crescer para Schema.org de produto, breadcrumb, performance, links quebrados
- Aproveitar como referência o que aprendermos usando o verificador da Lovable na plataforma

## Regra
Não iniciar, não propor implementação, não sugerir prazo. Apenas lembrar deste backlog quando o assunto SEO de tenants voltar à mesa, ou quando o usuário pedir explicitamente.
