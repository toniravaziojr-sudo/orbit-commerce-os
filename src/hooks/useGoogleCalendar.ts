import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  status: string;
  htmlLink?: string;
  creator?: { email: string };
  attendees?: Array<{ email: string; responseStatus?: string }>;
}

export interface CalendarInfo {
  id: string;
  summary: string;
  timeZone: string;
  primary?: boolean;
}

async function callCalendar(action: string, tenantId: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: { action, tenantId, ...params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data;
}

export function useGoogleCalendar() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const calendarsQuery = useQuery({
    queryKey: ["google-calendar", "calendars", tenantId],
    queryFn: () => callCalendar("calendars", tenantId!),
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000,
  });

  const eventsQuery = useQuery({
    queryKey: ["google-calendar", "events", tenantId],
    queryFn: () => callCalendar("events", tenantId!),
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: () => callCalendar("sync", tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar"] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (params: { summary: string; description?: string; start: string; end: string; location?: string; attendees?: string[] }) =>
      callCalendar("create", tenantId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar", "events"] });
    },
  });

  return {
    calendarsQuery,
    eventsQuery,
    syncMutation,
    createEventMutation,
  };
}
