import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
  labelIds: string[];
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

async function callGmail(action: string, tenantId: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-gmail", {
    body: { action, tenantId, ...params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data;
}

export function useGoogleGmail() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["google-gmail", "profile", tenantId],
    queryFn: () => callGmail("profile", tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const inboxQuery = useQuery({
    queryKey: ["google-gmail", "inbox", tenantId],
    queryFn: () => callGmail("inbox", tenantId!),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: () => callGmail("sync", tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-gmail"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (params: { to: string; subject: string; body: string; replyToMessageId?: string }) =>
      callGmail("send", tenantId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-gmail", "inbox"] });
    },
  });

  return {
    profileQuery,
    inboxQuery,
    syncMutation,
    sendMutation,
  };
}
