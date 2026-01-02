
-- =============================================
-- MÓDULO FISCAL / NF-e - Estrutura de Dados
-- =============================================

-- 1. Configurações Fiscais por Tenant
CREATE TABLE public.fiscal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Dados do Emitente
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  ie_isento BOOLEAN DEFAULT FALSE,
  cnae TEXT,
  
  -- Endereço do Emitente
  endereco_logradouro TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_municipio TEXT,
  endereco_municipio_codigo TEXT,
  endereco_uf TEXT,
  endereco_cep TEXT,
  
  -- Regime e Parâmetros Fiscais
  crt INTEGER DEFAULT 1,
  cfop_intrastadual TEXT DEFAULT '5102',
  cfop_interestadual TEXT DEFAULT '6102',
  csosn_padrao TEXT,
  cst_padrao TEXT,
  
  -- Série e Numeração
  serie_nfe INTEGER DEFAULT 1,
  numero_nfe_atual INTEGER DEFAULT 1,
  
  -- Provedor Fiscal
  provider TEXT DEFAULT 'focusnfe',
  provider_token TEXT,
  ambiente TEXT DEFAULT 'homologacao',
  
  -- Automação
  emissao_automatica BOOLEAN DEFAULT FALSE,
  emitir_apos_status TEXT DEFAULT 'paid',
  
  -- Metadados
  is_configured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fiscal_settings_tenant_unique UNIQUE(tenant_id)
);

-- 2. Dados Fiscais dos Produtos
CREATE TABLE public.fiscal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  ncm TEXT,
  cest TEXT,
  origem INTEGER DEFAULT 0,
  unidade_comercial TEXT DEFAULT 'UN',
  
  cfop_override TEXT,
  csosn_override TEXT,
  cst_override TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fiscal_products_product_unique UNIQUE(product_id)
);

-- 3. Notas Fiscais
CREATE TABLE public.fiscal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  
  -- Identificação
  numero INTEGER NOT NULL,
  serie INTEGER NOT NULL,
  chave_acesso TEXT,
  protocolo TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  status_motivo TEXT,
  
  -- Dados da NF
  natureza_operacao TEXT DEFAULT 'VENDA DE MERCADORIA',
  cfop TEXT,
  valor_total NUMERIC NOT NULL,
  valor_produtos NUMERIC NOT NULL,
  valor_frete NUMERIC DEFAULT 0,
  valor_desconto NUMERIC DEFAULT 0,
  
  -- Destinatário (snapshot)
  dest_nome TEXT NOT NULL,
  dest_cpf_cnpj TEXT NOT NULL,
  dest_inscricao_estadual TEXT,
  dest_endereco_logradouro TEXT,
  dest_endereco_numero TEXT,
  dest_endereco_complemento TEXT,
  dest_endereco_bairro TEXT,
  dest_endereco_municipio TEXT,
  dest_endereco_municipio_codigo TEXT,
  dest_endereco_uf TEXT,
  dest_endereco_cep TEXT,
  
  -- Artefatos
  xml_autorizado TEXT,
  danfe_url TEXT,
  
  -- Observações
  observacoes TEXT,
  
  -- Auditoria
  emitido_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fiscal_invoices_numero_unique UNIQUE(tenant_id, serie, numero)
);

-- 4. Itens da NF
CREATE TABLE public.fiscal_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id),
  
  numero_item INTEGER NOT NULL,
  codigo_produto TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ncm TEXT NOT NULL,
  cfop TEXT NOT NULL,
  unidade TEXT DEFAULT 'UN',
  quantidade NUMERIC NOT NULL,
  valor_unitario NUMERIC NOT NULL,
  valor_total NUMERIC NOT NULL,
  
  origem INTEGER DEFAULT 0,
  csosn TEXT,
  cst TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Eventos/Auditoria
CREATE TABLE public.fiscal_invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  event_data JSONB,
  
  request_payload JSONB,
  response_payload JSONB,
  
  user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_fiscal_settings_tenant ON public.fiscal_settings(tenant_id);
CREATE INDEX idx_fiscal_products_tenant ON public.fiscal_products(tenant_id);
CREATE INDEX idx_fiscal_products_product ON public.fiscal_products(product_id);
CREATE INDEX idx_fiscal_invoices_tenant ON public.fiscal_invoices(tenant_id);
CREATE INDEX idx_fiscal_invoices_order ON public.fiscal_invoices(order_id);
CREATE INDEX idx_fiscal_invoices_status ON public.fiscal_invoices(status);
CREATE INDEX idx_fiscal_invoices_chave ON public.fiscal_invoices(chave_acesso);
CREATE INDEX idx_fiscal_invoice_items_invoice ON public.fiscal_invoice_items(invoice_id);
CREATE INDEX idx_fiscal_invoice_events_invoice ON public.fiscal_invoice_events(invoice_id);
CREATE INDEX idx_fiscal_invoice_events_tenant ON public.fiscal_invoice_events(tenant_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoice_events ENABLE ROW LEVEL SECURITY;

-- fiscal_settings: apenas usuários do tenant
CREATE POLICY "Users can view own tenant fiscal settings"
  ON public.fiscal_settings FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own tenant fiscal settings"
  ON public.fiscal_settings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own tenant fiscal settings"
  ON public.fiscal_settings FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- fiscal_products: usuários do tenant
CREATE POLICY "Users can view own tenant fiscal products"
  ON public.fiscal_products FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage own tenant fiscal products"
  ON public.fiscal_products FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- fiscal_invoices: usuários do tenant
CREATE POLICY "Users can view own tenant invoices"
  ON public.fiscal_invoices FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own tenant invoices"
  ON public.fiscal_invoices FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own tenant invoices"
  ON public.fiscal_invoices FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- fiscal_invoice_items: via invoice
CREATE POLICY "Users can view invoice items"
  ON public.fiscal_invoice_items FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM public.fiscal_invoices 
    WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Users can manage invoice items"
  ON public.fiscal_invoice_items FOR ALL
  USING (invoice_id IN (
    SELECT id FROM public.fiscal_invoices 
    WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  ));

-- fiscal_invoice_events: usuários do tenant
CREATE POLICY "Users can view own tenant invoice events"
  ON public.fiscal_invoice_events FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert invoice events"
  ON public.fiscal_invoice_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- =============================================
-- TRIGGERS para updated_at
-- =============================================

CREATE TRIGGER update_fiscal_settings_updated_at
  BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fiscal_products_updated_at
  BEFORE UPDATE ON public.fiscal_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fiscal_invoices_updated_at
  BEFORE UPDATE ON public.fiscal_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
