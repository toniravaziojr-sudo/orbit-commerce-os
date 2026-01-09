-- =====================================================
-- MÓDULO 1: BUSCA DE INFLUENCERS
-- =====================================================

-- Tabela principal de leads de influencers
CREATE TABLE public.influencer_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram', -- instagram, tiktok, youtube, other
  profile_url TEXT,
  handle TEXT,
  location TEXT,
  follower_range TEXT, -- ex: '10k-50k', '50k-100k', etc
  niche TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'prospect', -- prospect, contacted, negotiating, closed, discarded
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para influencer_leads
CREATE INDEX idx_influencer_leads_tenant ON public.influencer_leads(tenant_id);
CREATE INDEX idx_influencer_leads_status ON public.influencer_leads(tenant_id, status);
CREATE INDEX idx_influencer_leads_platform ON public.influencer_leads(tenant_id, platform);

-- RLS para influencer_leads
ALTER TABLE public.influencer_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view influencer leads"
ON public.influencer_leads FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can create influencer leads"
ON public.influencer_leads FOR INSERT
WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update influencer leads"
ON public.influencer_leads FOR UPDATE
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete influencer leads"
ON public.influencer_leads FOR DELETE
USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Tabela de interações com influencers
CREATE TABLE public.influencer_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES public.influencer_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note', -- note, call, email, meeting, dm
  summary TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_influencer_interactions_influencer ON public.influencer_interactions(influencer_id);

ALTER TABLE public.influencer_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage influencer interactions"
ON public.influencer_interactions FOR ALL
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =====================================================
-- MÓDULO 2: BUSCA DE FORNECEDORES (supplier_leads)
-- Nota: Já existe tabela 'suppliers', criamos 'supplier_leads' para não conflitar
-- =====================================================

CREATE TABLE public.supplier_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT,
  category TEXT, -- cosméticos, embalagens, logística, matéria-prima, etc
  location TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_person TEXT,
  status TEXT NOT NULL DEFAULT 'prospect', -- prospect, contacted, negotiating, approved, discarded
  moq TEXT, -- minimum order quantity (texto livre)
  lead_time_days INTEGER,
  price_notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_leads_tenant ON public.supplier_leads(tenant_id);
CREATE INDEX idx_supplier_leads_status ON public.supplier_leads(tenant_id, status);
CREATE INDEX idx_supplier_leads_category ON public.supplier_leads(tenant_id, category);

ALTER TABLE public.supplier_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view supplier leads"
ON public.supplier_leads FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can create supplier leads"
ON public.supplier_leads FOR INSERT
WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update supplier leads"
ON public.supplier_leads FOR UPDATE
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete supplier leads"
ON public.supplier_leads FOR DELETE
USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Interações com fornecedores
CREATE TABLE public.supplier_lead_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.supplier_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  summary TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_interactions_supplier ON public.supplier_lead_interactions(supplier_id);

ALTER TABLE public.supplier_lead_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage supplier interactions"
ON public.supplier_lead_interactions FOR ALL
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =====================================================
-- MÓDULO 3: PROGRAMA DE AFILIADOS
-- =====================================================

-- Configuração do programa por tenant
CREATE TABLE public.affiliate_programs (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  attribution_window_days INTEGER NOT NULL DEFAULT 30,
  commission_type TEXT NOT NULL DEFAULT 'percent', -- percent, fixed
  commission_value_cents INTEGER NOT NULL DEFAULT 1000, -- 10% ou R$10,00
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage affiliate program"
ON public.affiliate_programs FOR ALL
USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant members can view affiliate program"
ON public.affiliate_programs FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Afiliados cadastrados
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, blocked
  payout_notes TEXT, -- método de pagamento (pix, banco, etc)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_affiliates_tenant ON public.affiliates(tenant_id);
CREATE INDEX idx_affiliates_status ON public.affiliates(tenant_id, status);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view affiliates"
ON public.affiliates FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage affiliates"
ON public.affiliates FOR ALL
USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Links de afiliados
CREATE TABLE public.affiliate_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  target_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_affiliate_links_affiliate ON public.affiliate_links(affiliate_id);
CREATE INDEX idx_affiliate_links_code ON public.affiliate_links(tenant_id, code);

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage affiliate links"
ON public.affiliate_links FOR ALL
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Cliques registrados
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  link_id UUID REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  landing_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_clicks_affiliate ON public.affiliate_clicks(affiliate_id);
CREATE INDEX idx_affiliate_clicks_created ON public.affiliate_clicks(tenant_id, created_at DESC);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view affiliate clicks"
ON public.affiliate_clicks FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Anyone can insert affiliate clicks"
ON public.affiliate_clicks FOR INSERT
WITH CHECK (true); -- cliques são registrados anonimamente via edge function

-- Conversões (vendas atribuídas)
CREATE TABLE public.affiliate_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_total_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, paid
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, order_id)
);

CREATE INDEX idx_affiliate_conversions_affiliate ON public.affiliate_conversions(affiliate_id);
CREATE INDEX idx_affiliate_conversions_status ON public.affiliate_conversions(tenant_id, status);

ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view affiliate conversions"
ON public.affiliate_conversions FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage affiliate conversions"
ON public.affiliate_conversions FOR ALL
USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Pagamentos aos afiliados
CREATE TABLE public.affiliate_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, paid
  paid_at TIMESTAMPTZ,
  proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_payouts_affiliate ON public.affiliate_payouts(affiliate_id);
CREATE INDEX idx_affiliate_payouts_status ON public.affiliate_payouts(tenant_id, status);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view affiliate payouts"
ON public.affiliate_payouts FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage affiliate payouts"
ON public.affiliate_payouts FOR ALL
USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_influencer_leads_updated_at
  BEFORE UPDATE ON public.influencer_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_leads_updated_at
  BEFORE UPDATE ON public.supplier_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_programs_updated_at
  BEFORE UPDATE ON public.affiliate_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();