// =============================================
// USE MODULE TUTORIALS HOOK
// Fetches tutorial video URL for current module
// =============================================

import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface ModuleTutorial {
  id: string;
  module_key: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  is_active: boolean;
}

// Map routes to module keys
const routeToModuleMap: Record<string, string> = {
  '/command-center': 'command-center',
  '/orders': 'orders',
  '/abandoned-checkouts': 'abandoned-checkouts',
  '/products': 'products',
  '/customers': 'customers',
  '/storefront': 'storefront',
  '/categories': 'categories',
  '/menus': 'menus',
  '/pages': 'pages',
  '/blog': 'blog',
  '/marketing': 'marketing',
  '/email-marketing': 'email-marketing',
  '/quizzes': 'quizzes',
  '/discounts': 'discounts',
  '/offers': 'offers',
  '/reviews': 'reviews',
  '/media': 'media',
  '/campaigns': 'campaigns',
  '/notifications': 'notifications',
  '/support': 'support',
  '/emails': 'emails',
  '/fiscal': 'fiscal',
  '/finance': 'finance',
  '/purchases': 'purchases',
  '/shipping': 'shipping',
  '/influencers': 'influencers',
  '/suppliers': 'suppliers',
  '/affiliates': 'affiliates',
  '/integrations': 'integrations',
  '/import': 'import',
  '/system/users': 'users',
  '/files': 'files',
  '/reports': 'reports',
  '/support-center': 'support-center',
};

/**
 * Get module key from current route
 */
export function getModuleKeyFromRoute(pathname: string): string | null {
  // Check exact matches first
  if (routeToModuleMap[pathname]) {
    return routeToModuleMap[pathname];
  }
  
  // Check for partial matches (e.g., /orders/123 should match /orders)
  for (const [route, key] of Object.entries(routeToModuleMap)) {
    if (pathname.startsWith(route)) {
      return key;
    }
  }
  
  return null;
}

/**
 * Fetch tutorial for current module
 */
export function useModuleTutorial() {
  const location = useLocation();
  const moduleKey = getModuleKeyFromRoute(location.pathname);
  
  return useQuery({
    queryKey: ['module-tutorial', moduleKey],
    queryFn: async (): Promise<ModuleTutorial | null> => {
      if (!moduleKey) return null;
      
      const { data, error } = await supabase
        .from('module_tutorials')
        .select('*')
        .eq('module_key', moduleKey)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching module tutorial:', error);
        return null;
      }
      
      return data as ModuleTutorial | null;
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    enabled: !!moduleKey,
  });
}
