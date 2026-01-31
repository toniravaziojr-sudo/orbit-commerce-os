// =============================================
// NEWSLETTER POPUP LOADER
// Loads popup config from newsletter_popup_configs and renders the popup
// Used in storefront layouts to show the popup based on trigger settings
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NewsletterPopupBlock } from '@/components/builder/blocks/interactive/NewsletterPopupBlock';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

interface NewsletterPopupLoaderProps {
  tenantId: string;
}

interface PopupConfig {
  id: string;
  tenant_id: string;
  is_active: boolean;
  list_id: string | null;
  title: string;
  subtitle: string;
  button_text: string;
  success_message: string;
  show_name: boolean;
  show_phone: boolean;
  show_birth_date: boolean;
  name_required: boolean;
  phone_required: boolean;
  birth_date_required: boolean;
  layout: string;
  image_url: string | null;
  icon_image_url: string | null;
  trigger_type: string;
  trigger_delay_seconds: number;
  trigger_scroll_percent: number;
  show_on_pages: string[] | null;
  exclude_pages: string[] | null;
  background_color: string;
  text_color: string;
  button_bg_color: string;
  button_text_color: string;
  show_once_per_session: boolean;
}

export function NewsletterPopupLoader({ tenantId }: NewsletterPopupLoaderProps) {
  const location = useLocation();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['newsletter-popup-active', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_popup_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading popup config:', error);
        return null;
      }
      
      return data as PopupConfig | null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!tenantId,
  });

  // Determine current page type from URL
  const currentPageType = useMemo(() => {
    const path = location.pathname;
    
    if (path === '/' || path.endsWith('/')) {
      return 'home';
    }
    if (path.includes('/c/') || path.includes('/categoria/')) {
      return 'category';
    }
    if (path.includes('/p/') || path.includes('/produto/')) {
      return 'product';
    }
    if (path.includes('/cart') || path.includes('/carrinho')) {
      return 'cart';
    }
    if (path.includes('/blog')) {
      return 'blog';
    }
    
    return 'other';
  }, [location.pathname]);

  // Get showOnPages from config (array stored in DB)
  const showOnPages = useMemo(() => {
    if (!config || !config.show_on_pages) return ['home', 'category', 'product'];
    return config.show_on_pages;
  }, [config]);

  // Don't render if loading, no config, or not active
  if (isLoading || !config || !config.is_active) {
    return null;
  }

  // Don't render if current page is not in showOnPages
  if (showOnPages.length > 0 && !showOnPages.includes(currentPageType)) {
    return null;
  }

  // Cast layout and trigger_type to expected union types
  const layout = (config.layout || 'centered') as 'centered' | 'side-image' | 'corner' | 'fullscreen';
  const triggerType = (config.trigger_type || 'delay') as 'delay' | 'scroll' | 'exit_intent' | 'immediate';

  return (
    <NewsletterPopupBlock
      popupConfigId={config.id}
      listId={config.list_id || undefined}
      title={config.title}
      subtitle={config.subtitle}
      buttonText={config.button_text}
      successMessage={config.success_message}
      showName={config.show_name}
      showPhone={config.show_phone}
      showBirthDate={config.show_birth_date}
      nameRequired={config.name_required}
      phoneRequired={config.phone_required}
      birthDateRequired={config.birth_date_required}
      layout={layout}
      imageUrl={config.image_url || undefined}
      showBanner={!!config.icon_image_url}
      bannerImageUrl={config.icon_image_url || undefined}
      triggerType={triggerType}
      triggerDelaySeconds={config.trigger_delay_seconds}
      triggerScrollPercent={config.trigger_scroll_percent}
      showOnPages={showOnPages}
      backgroundColor={config.background_color}
      textColor={config.text_color}
      buttonBgColor={config.button_bg_color}
      buttonTextColor={config.button_text_color}
      showOncePerSession={config.show_once_per_session}
      tenantId={tenantId}
      currentPageType={currentPageType}
      isEditing={false}
    />
  );
}
