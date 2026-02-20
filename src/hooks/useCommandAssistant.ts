import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { triggerMemoryExtraction } from "@/lib/triggerMemoryExtraction";

export interface CommandMessage {
  id: string;
  conversation_id: string;
  tenant_id: string;
  user_id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  metadata: {
    proposed_actions?: ProposedAction[];
    tool_result?: any;
    action_id?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface CommandConversation {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ProposedAction {
  id: string;
  tool_name: string;
  tool_args: Record<string, any>;
  description: string;
  requires_permission?: string;
}

export function useCommandAssistant() {
  const { user, currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ["command-conversations", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from("command_conversations")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as CommandConversation[];
    },
    enabled: !!currentTenant?.id && !!user,
  });

  // Fetch messages for current conversation
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["command-messages", currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      
      const { data, error } = await supabase
        .from("command_messages")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as CommandMessage[];
    },
    enabled: !!currentConversationId,
  });

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (title?: string) => {
      if (!currentTenant?.id || !user?.id) throw new Error("Missing tenant or user");

      const { data, error } = await supabase
        .from("command_conversations")
        .insert({
          tenant_id: currentTenant.id,
          user_id: user.id,
          title: title || "Nova conversa",
        })
        .select()
        .single();

      if (error) throw error;
      return data as CommandConversation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["command-conversations"] });
      setCurrentConversationId(data.id);
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("command_conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-conversations"] });
      if (currentConversationId === deleteConversationMutation.variables) {
        setCurrentConversationId(null);
      }
    },
  });

  // Rename conversation
  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("command_conversations")
        .update({ title })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-conversations"] });
    },
  });

  // Send message with streaming
  const sendMessage = useCallback(async (
    message: string, 
    attachments?: { url: string; filename: string; mimeType: string }[]
  ) => {
    if (!currentTenant?.id || !user?.id) {
      toast.error("Usuário ou tenant não identificado");
      return;
    }

    let conversationId = currentConversationId;

    // Create conversation if needed
    if (!conversationId) {
      const newConv = await createConversationMutation.mutateAsync(message.slice(0, 50));
      conversationId = newConv.id;
    }

    // Optimistically add user message
    const userMessage: CommandMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      tenant_id: currentTenant.id,
      user_id: user.id,
      role: "user",
      content: message,
      metadata: attachments?.length ? { attachments } : {},
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData<CommandMessage[]>(
      ["command-messages", conversationId],
      (old = []) => [...old, userMessage]
    );

    setIsStreaming(true);
    setStreamingContent("");
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/command-assistant-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            message,
            tenant_id: currentTenant.id,
            attachments: attachments || [],
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
      let proposedActions: ProposedAction[] = [];

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
            
            // Check for proposed actions in the response
            if (parsed.proposed_actions) {
              proposedActions = parsed.proposed_actions;
            }
            
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
      const assistantMessage: CommandMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        tenant_id: currentTenant.id,
        user_id: user.id,
        role: "assistant",
        content: assistantContent,
        metadata: proposedActions.length > 0 ? { proposed_actions: proposedActions } : {},
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<CommandMessage[]>(
        ["command-messages", conversationId],
        (old = []) => [...old, assistantMessage]
      );

      // Update conversation title if first message
      if (messages.length === 0) {
        renameConversationMutation.mutate({
          id: conversationId,
          title: message.slice(0, 50),
        });
      }

      // Refresh from server
      queryClient.invalidateQueries({ queryKey: ["command-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["command-conversations"] });

      // Trigger async memory extraction (fire-and-forget)
      const allMsgs = queryClient.getQueryData<CommandMessage[]>(["command-messages", conversationId]) || [];
      triggerMemoryExtraction({
        tenant_id: currentTenant.id,
        user_id: user.id,
        ai_agent: "command_assistant",
        conversation_id: conversationId,
        messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
      });

    } catch (error: any) {
      if (error.name === "AbortError") {
        // User cancelled
        return;
      }
      console.error("Chat error:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  }, [currentConversationId, currentTenant?.id, user?.id, messages.length, queryClient]);

  // Execute proposed action
  const executeAction = useCallback(async (action: ProposedAction) => {
    if (!currentConversationId || !currentTenant?.id) {
      toast.error("Conversa não encontrada");
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/command-assistant-execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            conversation_id: currentConversationId,
            action_id: action.id,
            tool_name: action.tool_name,
            tool_args: action.tool_args,
            tenant_id: currentTenant.id,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || "Erro ao executar ação");
        return;
      }

      toast.success(data.message || "Ação executada com sucesso!");
      
      // Refresh messages to show tool result
      queryClient.invalidateQueries({ queryKey: ["command-messages", currentConversationId] });

    } catch (error: any) {
      console.error("Execute action error:", error);
      toast.error(error.message || "Erro ao executar ação");
    }
  }, [currentConversationId, currentTenant?.id, queryClient]);

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
    executeAction,
    cancelStreaming,
  };
}
