
-- =============================================
-- Fase 7: Google Meu Negócio (Business Profile)
-- =============================================

-- Tabela para armazenar avaliações do Google Business Profile
CREATE TABLE public.google_business_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  reviewer_name TEXT,
  reviewer_photo_url TEXT,
  star_rating INTEGER,
  comment TEXT,
  review_reply TEXT,
  reply_updated_at TIMESTAMPTZ,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_google_business_review UNIQUE(tenant_id, location_id, review_id)
);

-- Tabela para armazenar posts do Google Business Profile
CREATE TABLE public.google_business_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  post_id TEXT,
  topic_type TEXT NOT NULL DEFAULT 'STANDARD',
  summary TEXT,
  media_url TEXT,
  call_to_action_type TEXT,
  call_to_action_url TEXT,
  event_title TEXT,
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  offer_coupon_code TEXT,
  offer_redeem_url TEXT,
  state TEXT DEFAULT 'LIVE',
  search_url TEXT,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_google_business_post UNIQUE(tenant_id, location_id, post_id)
);

-- Índices
CREATE INDEX idx_gbr_tenant_location ON public.google_business_reviews(tenant_id, location_id);
CREATE INDEX idx_gbr_rating ON public.google_business_reviews(star_rating);
CREATE INDEX idx_gbp_tenant_location ON public.google_business_posts(tenant_id, location_id);

-- RLS Reviews
ALTER TABLE public.google_business_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view business reviews"
  ON public.google_business_reviews FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role can manage business reviews"
  ON public.google_business_reviews FOR ALL
  USING (true) WITH CHECK (true);

-- RLS Posts
ALTER TABLE public.google_business_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view business posts"
  ON public.google_business_posts FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role can manage business posts"
  ON public.google_business_posts FOR ALL
  USING (true) WITH CHECK (true);

-- Triggers updated_at
CREATE TRIGGER update_google_business_reviews_updated_at
  BEFORE UPDATE ON public.google_business_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_business_posts_updated_at
  BEFORE UPDATE ON public.google_business_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
