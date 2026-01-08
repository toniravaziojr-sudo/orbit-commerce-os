import { useSearchParams } from 'react-router-dom';

export type PlanKey = 'free' | 'standard' | 'scale' | 'enterprise' | 'custom';

export interface PlanUrlParams {
  plan: PlanKey | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

const VALID_PLANS: PlanKey[] = ['free', 'standard', 'scale', 'enterprise', 'custom'];

export function usePlanFromUrl(): PlanUrlParams {
  const [searchParams] = useSearchParams();
  
  const planParam = searchParams.get('plan')?.toLowerCase();
  const plan = planParam && VALID_PLANS.includes(planParam as PlanKey) 
    ? (planParam as PlanKey) 
    : null;
  
  return {
    plan,
    utm_source: searchParams.get('utm_source'),
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign'),
    utm_content: searchParams.get('utm_content'),
    utm_term: searchParams.get('utm_term'),
  };
}

export function savePlanSelectionToStorage(params: PlanUrlParams) {
  if (params.plan) {
    sessionStorage.setItem('selected_plan', params.plan);
  }
  
  const utm = {
    source: params.utm_source,
    medium: params.utm_medium,
    campaign: params.utm_campaign,
    content: params.utm_content,
    term: params.utm_term,
  };
  
  if (Object.values(utm).some(v => v)) {
    sessionStorage.setItem('signup_utm', JSON.stringify(utm));
  }
}

export function getStoredPlanSelection(): { plan: PlanKey | null; utm: Record<string, string | null> } {
  const plan = sessionStorage.getItem('selected_plan') as PlanKey | null;
  const utmStr = sessionStorage.getItem('signup_utm');
  const utm = utmStr ? JSON.parse(utmStr) : {};
  
  return { plan, utm };
}

export function clearPlanSelectionStorage() {
  sessionStorage.removeItem('selected_plan');
  sessionStorage.removeItem('signup_utm');
}
