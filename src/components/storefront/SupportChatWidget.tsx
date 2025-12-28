import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  direction: "inbound" | "outbound";
  sender_type: string;
  created_at: string;
}

export function SupportChatWidget() {
  const { tenantId } = useStorefrontConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [showForm, setShowForm] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing conversation from localStorage
  useEffect(() => {
    const savedConversationId = localStorage.getItem(`support_conversation_${tenantId}`);
    const savedCustomerName = localStorage.getItem(`support_customer_name_${tenantId}`);
    const savedCustomerEmail = localStorage.getItem(`support_customer_email_${tenantId}`);
    
    if (savedConversationId) {
      setConversationId(savedConversationId);
      setShowForm(false);
    }
    if (savedCustomerName) setCustomerName(savedCustomerName);
    if (savedCustomerEmail) setCustomerEmail(savedCustomerEmail);
  }, [tenantId]);

  // Load messages when conversation exists
  useEffect(() => {
    if (!conversationId || !isOpen) return;

    const loadMessages = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("id, content, direction, sender_type, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data as Message[]);
      }
      setIsLoading(false);
    };

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`widget-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startConversation = async () => {
    if (!customerName.trim() || !customerEmail.trim() || !tenantId) return;

    setIsLoading(true);
    try {
      // Create conversation
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
          tenant_id: tenantId,
          channel_type: "chat" as const,
          status: "open" as const,
          customer_name: customerName,
          customer_email: customerEmail,
          subject: "Chat do site",
        })
        .select("id")
        .single();

      if (error) throw error;

      setConversationId(conversation.id);
      setShowForm(false);

      // Save to localStorage
      localStorage.setItem(`support_conversation_${tenantId}`, conversation.id);
      localStorage.setItem(`support_customer_name_${tenantId}`, customerName);
      localStorage.setItem(`support_customer_email_${tenantId}`, customerEmail);

      // Log event
      await supabase.from("conversation_events").insert({
        conversation_id: conversation.id,
        tenant_id: tenantId,
        event_type: "conversation_started",
        description: "Cliente iniciou conversa via widget",
      });
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !tenantId) return;

    const messageContent = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    try {
      // Insert message
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        content: messageContent,
        direction: "inbound",
        sender_type: "customer",
        sender_name: customerName,
        delivery_status: "delivered",
      });

      if (error) throw error;

      // Update conversation
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_customer_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      // Try to get AI response
      try {
        await supabase.functions.invoke("ai-support-chat", {
          body: {
            conversation_id: conversationId,
            message: messageContent,
          },
        });
      } catch {
        // AI response is optional
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showForm) {
        startConversation();
      } else {
        sendMessage();
      }
    }
  };

  const endConversation = () => {
    localStorage.removeItem(`support_conversation_${tenantId}`);
    setConversationId(null);
    setMessages([]);
    setShowForm(true);
    setIsOpen(false);
  };

  if (!tenantId) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 flex w-80 flex-col rounded-lg border bg-background shadow-xl transition-all sm:w-96",
            isMinimized ? "h-14" : "h-[500px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-lg bg-primary px-4 py-3 text-primary-foreground">
            <span className="font-medium">Atendimento</span>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Form or Messages */}
              {showForm ? (
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <p className="text-sm text-muted-foreground">
                    Olá! Para iniciar o atendimento, preencha seus dados:
                  </p>
                  <Input
                    placeholder="Seu nome"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Input
                    type="email"
                    placeholder="Seu e-mail"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Button
                    onClick={startConversation}
                    disabled={!customerName.trim() || !customerEmail.trim() || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Iniciar conversa"
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    {isLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground">
                        Envie uma mensagem para começar
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                              msg.direction === "inbound"
                                ? "self-end bg-primary text-primary-foreground"
                                : "self-start bg-muted"
                            )}
                          >
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Input */}
                  <div className="flex gap-2 border-t p-3">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isSending}
                    />
                    <Button
                      size="icon"
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || isSending}
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* End conversation */}
                  <button
                    onClick={endConversation}
                    className="border-t px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Encerrar conversa
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
