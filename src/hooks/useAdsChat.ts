// =============================================
// USE ADS CHAT
// Hook for the dedicated Ads Traffic AI chat
// =============================================

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerMemoryExtraction } from "@/lib/triggerMemoryExtraction";

export interface AdsChatAttachment {
  url: string;
  filename: string;
  mimeType: string;
}

export interface AdsChatMessage {
  id: string;
  conversation_id: string;
  tenant_id: string;
  role: "user" | "assistant" | "system";
  content: string | null;
  attachments?: AdsChatAttachment[] | null;
  created_at: string;
}

export interface AdsChatConversation {
  id: string;
  tenant_id: string;
  scope: string;
  ad_account_id: string | null;
  channel: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

interface UseAdsChatOptions {
  scope: "global" | "account";
  adAccountId?: string;
  channel?: string;
}

export function useAdsChat({ scope, adAccountId, channel }: UseAdsChatOptions) {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversations for this scope
  const conversationsQuery = useQuery({
    queryKey: ["ads-chat-conversations", tenantId, scope, adAccountId],
    queryFn: async () => {
      let query = supabase
        .from("ads_chat_conversations" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("scope", scope)
        .order("updated_at", { ascending: false });

      if (scope === "account" && adAccountId) {
        query = query.eq("ad_account_id", adAccountId);
      } else if (scope === "global") {
        query = query.is("ad_account_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AdsChatConversation[];
    },
    enabled: !!tenantId,
  });

  // Fetch messages for current conversation
  const messagesQuery = useQuery({
    queryKey: ["ads-chat-messages", currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      const { data, error } = await supabase
        .from("ads_chat_messages" as any)
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AdsChatMessage[];
    },
    enabled: !!currentConversationId,
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!currentConversationId) return;
    const ch = supabase
      .channel(`ads-chat-${currentConversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ads_chat_messages",
        filter: `conversation_id=eq.${currentConversationId}`,
      }, () => {
        if (!isStreaming) {
          queryClient.invalidateQueries({ queryKey: ["ads-chat-messages", currentConversationId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentConversationId, isStreaming, queryClient]);

  // Send message with streaming (supports attachments)
  const sendMessage = useCallback(async (message: string, attachments?: AdsChatAttachment[]) => {
    if (!tenantId || (!message.trim() && (!attachments || attachments.length === 0))) return;

    // Optimistically add user message to the cache
    const optimisticMsg: AdsChatMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: currentConversationId || "",
      tenant_id: tenantId,
      role: "user",
      content: message,
      attachments: attachments || null,
      created_at: new Date().toISOString(),
    };

    const convIdForCache = currentConversationId;
    if (convIdForCache) {
      queryClient.setQueryData<AdsChatMessage[]>(
        ["ads-chat-messages", convIdForCache],
        (old) => [...(old || []), optimisticMsg]
      );
    }

    setIsStreaming(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ads-chat`;
      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          conversation_id: currentConversationId,
          message,
          tenant_id: tenantId,
          scope,
          ad_account_id: adAccountId,
          channel,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error: ${resp.status}`);
      }

      // Get conversation ID from header
      const newConvId = resp.headers.get("X-Conversation-Id");
      if (newConvId && !currentConversationId) {
        setCurrentConversationId(newConvId);
        // Move optimistic message to the new conversation cache
        queryClient.setQueryData<AdsChatMessage[]>(
          ["ads-chat-messages", newConvId],
          [{ ...optimisticMsg, conversation_id: newConvId }]
        );
        queryClient.invalidateQueries({ queryKey: ["ads-chat-conversations"] });
      }

      // Stream response
      if (!resp.body) throw new Error("No response body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIdx);
          textBuffer = textBuffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setStreamingContent(fullContent);
            }
          } catch { /* partial */ }
        }
      }

      // Refresh messages after stream completes
      const finalConvId = newConvId || currentConversationId;
      queryClient.invalidateQueries({ queryKey: ["ads-chat-messages", finalConvId] });
      queryClient.invalidateQueries({ queryKey: ["ads-chat-conversations"] });

      // Trigger async memory extraction
      if (tenantId && user && finalConvId) {
        const allMsgs = queryClient.getQueryData<AdsChatMessage[]>(["ads-chat-messages", finalConvId]) || [];
        triggerMemoryExtraction({
          tenant_id: tenantId,
          user_id: user.id,
          ai_agent: "ads_chat",
          conversation_id: finalConvId,
          messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
        });
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[useAdsChat] Error:", err);
      // Remove optimistic message on error
      if (convIdForCache) {
        queryClient.setQueryData<AdsChatMessage[]>(
          ["ads-chat-messages", convIdForCache],
          (old) => (old || []).filter(m => m.id !== optimisticMsg.id)
        );
      }
      throw err;
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  }, [tenantId, currentConversationId, scope, adAccountId, channel, queryClient]);

  const cancelStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent("");
  }, []);

  const createConversation = useCallback(async () => {
    if (!tenantId || !user) return;
    const { data, error } = await supabase
      .from("ads_chat_conversations" as any)
      .insert({
        tenant_id: tenantId,
        scope,
        ad_account_id: scope === "account" ? adAccountId : null,
        channel: scope === "account" ? channel : null,
        title: "Nova conversa",
        created_by: user.id,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    const newId = (data as any)?.id;
    setCurrentConversationId(newId);
    queryClient.invalidateQueries({ queryKey: ["ads-chat-conversations"] });
    return newId;
  }, [tenantId, user, scope, adAccountId, channel, queryClient]);

  return {
    conversations: conversationsQuery.data || [],
    conversationsLoading: conversationsQuery.isLoading,
    currentConversationId,
    setCurrentConversationId,
    messages: messagesQuery.data || [],
    messagesLoading: messagesQuery.isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStreaming,
    createConversation,
  };
}
