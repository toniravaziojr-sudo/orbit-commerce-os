import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { ChatMode } from "@/components/chatgpt";

export type { ChatMode };

export interface ChatGPTMessage {
  id: string;
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ChatGPTConversation {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useChatGPT() {
  const { user, currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ["chatgpt-conversations", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from("chatgpt_conversations")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as ChatGPTConversation[];
    },
    enabled: !!currentTenant?.id && !!user,
  });

  // Fetch messages for current conversation
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["chatgpt-messages", currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      
      const { data, error } = await supabase
        .from("chatgpt_messages")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ChatGPTMessage[];
    },
    enabled: !!currentConversationId,
  });

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (title?: string) => {
      if (!currentTenant?.id || !user?.id) throw new Error("Missing tenant or user");

      const { data, error } = await supabase
        .from("chatgpt_conversations")
        .insert({
          tenant_id: currentTenant.id,
          user_id: user.id,
          title: title || "Nova conversa",
        })
        .select()
        .single();

      if (error) throw error;
      return data as ChatGPTConversation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chatgpt-conversations"] });
      setCurrentConversationId(data.id);
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("chatgpt_conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatgpt-conversations"] });
      if (currentConversationId === deleteConversationMutation.variables) {
        setCurrentConversationId(null);
      }
    },
  });

  // Rename conversation
  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("chatgpt_conversations")
        .update({ title })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatgpt-conversations"] });
    },
  });

  // Send message with streaming
  const sendMessage = useCallback(async (
    message: string, 
    attachments?: { url: string; filename: string; mimeType: string }[],
    mode: ChatMode = "chat"
  ) => {
    if (!currentTenant?.id || !user?.id) {
      toast.error("Usuário ou tenant não identificado");
      return;
    }

    let conversationId = currentConversationId;

    // Create conversation if needed
    if (!conversationId) {
      const title = message ? message.slice(0, 50) : (attachments?.[0]?.filename || "Nova conversa");
      const newConv = await createConversationMutation.mutateAsync(title);
      conversationId = newConv.id;
    }

    // Build metadata with attachments and mode
    const metadata: Record<string, any> = { mode };
    if (attachments && attachments.length > 0) {
      metadata.attachments = attachments;
    }

    // Optimistically add user message
    const userMessage: ChatGPTMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      tenant_id: currentTenant.id,
      user_id: user.id,
      role: "user",
      content: message || (attachments ? `[${attachments.length} anexo(s)]` : ""),
      metadata,
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData<ChatGPTMessage[]>(
      ["chatgpt-messages", conversationId],
      (old = []) => [...old, userMessage]
    );

    // Save user message to DB
    await supabase.from("chatgpt_messages").insert({
      conversation_id: conversationId,
      tenant_id: currentTenant.id,
      user_id: user.id,
      role: "user",
      content: message || (attachments ? `[${attachments.length} anexo(s)]` : ""),
      metadata,
    });

    setIsStreaming(true);
    setStreamingContent("");
    abortControllerRef.current = new AbortController();

    try {
      // Build messages array for API (include history)
      const currentMessages = queryClient.getQueryData<ChatGPTMessage[]>(["chatgpt-messages", conversationId]) || [];
      
      // Build API messages with multimodal content support
      const apiMessages = currentMessages
        .filter(m => m.role !== "system")
        .map(m => {
          const msgAttachments = m.metadata?.attachments as { url: string; mimeType: string }[] | undefined;
          
          // If message has image attachments, use multimodal format
          if (msgAttachments && msgAttachments.some(a => a.mimeType.startsWith("image/"))) {
            const content: any[] = [];
            
            // Add text content if present
            if (m.content && !m.content.startsWith("[")) {
              content.push({ type: "text", text: m.content });
            }
            
            // Add image attachments
            for (const att of msgAttachments) {
              if (att.mimeType.startsWith("image/")) {
                content.push({
                  type: "image_url",
                  image_url: { url: att.url }
                });
              } else if (att.mimeType.startsWith("audio/")) {
                // Add audio description for context
                content.push({
                  type: "text",
                  text: `[Áudio anexado: ${att.url}]`
                });
              }
            }
            
            return { role: m.role, content };
          }
          
          // Regular text message
          return { role: m.role, content: m.content || "" };
        });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatgpt-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ 
            messages: apiMessages,
            hasAttachments: !!attachments && attachments.length > 0,
            mode,
            attachments: attachments || [],
            tenant_id: currentTenant?.id,
            user_id: user?.id,
            conversation_id: currentConversationId,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao enviar mensagem");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setStreamingContent(assistantContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Finalize assistant message
      const assistantMessage: ChatGPTMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        tenant_id: currentTenant.id,
        user_id: user.id,
        role: "assistant",
        content: assistantContent,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatGPTMessage[]>(
        ["chatgpt-messages", conversationId],
        (old = []) => [...old, assistantMessage]
      );

      // Save assistant message to DB
      await supabase.from("chatgpt_messages").insert({
        conversation_id: conversationId,
        tenant_id: currentTenant.id,
        user_id: user.id,
        role: "assistant",
        content: assistantContent,
        metadata: {},
      });

      // Update conversation title if first message
      if (messages.length === 0) {
        renameConversationMutation.mutate({
          id: conversationId,
          title: message.slice(0, 50),
        });
      }

      // Update conversation updated_at
      await supabase
        .from("chatgpt_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      // Refresh from server
      queryClient.invalidateQueries({ queryKey: ["chatgpt-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chatgpt-conversations"] });

    } catch (error: any) {
      if (error.name === "AbortError") {
        return;
      }
      console.error("ChatGPT error:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  }, [currentConversationId, currentTenant?.id, user?.id, messages.length, queryClient]);

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    conversations,
    messages,
    currentConversationId,
    isLoadingConversations,
    isLoadingMessages,
    isStreaming,
    streamingContent,
    setCurrentConversationId,
    createConversation: createConversationMutation.mutateAsync,
    deleteConversation: deleteConversationMutation.mutateAsync,
    renameConversation: renameConversationMutation.mutateAsync,
    sendMessage,
    cancelStreaming,
  };
}
