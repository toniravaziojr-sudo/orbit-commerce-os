
ALTER TABLE public.service_pricing DROP CONSTRAINT IF EXISTS service_pricing_category_check;
ALTER TABLE public.service_pricing ADD CONSTRAINT service_pricing_category_check
  CHECK (category = ANY (ARRAY[
    'ai_text','ai_image','ai_video','ai_audio','embedding',
    'fiscal','email','whatsapp','scrape','platform_internal','other'
  ]));
