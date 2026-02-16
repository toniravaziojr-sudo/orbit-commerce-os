// =============================================
// USE ADS BALANCE MONITOR
// Hook for monitoring ad account balances
// Used by Central de Execuções for low-balance alerts
// =============================================

import { useMemo } from "react";
import { useMetaAds } from "@/hooks/useMetaAds";

const LOW_BALANCE_THRESHOLD_CENTS = 5000; // R$50

function isCreditCardFunding(fundingType: string | number | undefined): boolean {
  return fundingType === 1 || fundingType === "1" || fundingType === "CREDIT_CARD";
}

export function useAdsBalanceMonitor() {
  const meta = useMetaAds();

  const summary = useMemo(() => {
    const balances = meta.accountBalances || [];
    
    const prepaidAccounts = balances.filter(b => !isCreditCardFunding(b.funding_source_type));
    const creditCardAccounts = balances.filter(b => isCreditCardFunding(b.funding_source_type));
    
    const lowBalanceAccounts = prepaidAccounts.filter(
      a => a.balance_cents > 0 && a.balance_cents < LOW_BALANCE_THRESHOLD_CENTS
    );

    const zeroBalanceAccounts = prepaidAccounts.filter(a => a.balance_cents <= 0);

    // Active campaigns count
    const activeCampaigns = (meta.campaigns || []).filter(
      (c: any) => (c.effective_status || c.status) === "ACTIVE"
    ).length;

    return {
      totalAccounts: balances.length,
      prepaidCount: prepaidAccounts.length,
      creditCardCount: creditCardAccounts.length,
      lowBalanceCount: lowBalanceAccounts.length,
      zeroBalanceCount: zeroBalanceAccounts.length,
      lowBalanceAccounts,
      zeroBalanceAccounts,
      activeCampaigns,
      isLoading: meta.balanceLoading || meta.campaignsLoading,
      hasData: balances.length > 0,
    };
  }, [meta.accountBalances, meta.campaigns, meta.balanceLoading, meta.campaignsLoading]);

  return summary;
}
