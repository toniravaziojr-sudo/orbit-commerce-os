import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ensureMediaMonthFolder } from '@/lib/ensureMediaMonthFolder';

/**
 * Hook that ensures the media month folder exists for a campaign's start date.
 * Returns the folder ID to be used with useSystemUpload({ folderId }).
 */
export function useMediaMonthFolder(campaignStartDate: string | undefined) {
  const { currentTenant, user } = useAuth();
  const [folderId, setFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant?.id || !user?.id || !campaignStartDate) return;

    let cancelled = false;

    ensureMediaMonthFolder(currentTenant.id, user.id, campaignStartDate).then((id) => {
      if (!cancelled) setFolderId(id);
    });

    return () => { cancelled = true; };
  }, [currentTenant?.id, user?.id, campaignStartDate]);

  return folderId;
}
