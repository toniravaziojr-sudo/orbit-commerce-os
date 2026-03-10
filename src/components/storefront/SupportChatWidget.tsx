// =============================================
// STOREFRONT SUPPORT WIDGET - Floating support widget
// Reads config from themeSettings.supportWidget
// Supports: Chat interno, WhatsApp button, or both
// Excludes checkout pages
// =============================================

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { usePublicThemeSettings } from "@/hooks/usePublicThemeSettings";
import { DEFAULT_SUPPORT_WIDGET, SupportWidgetConfig } from "@/hooks/useThemeSettings";
import { getWhatsAppHref } from "@/lib/contactHelpers";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

interface Message {
  id: string;
  content: string;
  direction: "inbound" | "outbound";
  sender_type: string;
  created_at: string;
}

interface SupportChatWidgetProps {
  tenantSlug: string;
  bootstrapTemplate?: any;
}

export function SupportChatWidget({ tenantSlug, bootstrapTemplate }: SupportChatWidgetProps) {
  const { tenantId } = useStorefrontConfig();
  const location = useLocation();
  const { themeSettings } = usePublicThemeSettings(tenantSlug, bootstrapTemplate);
  
  const config: SupportWidgetConfig = {
    ...DEFAULT_SUPPORT_WIDGET,
    ...themeSettings?.supportWidget,
  };

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

  // Hide on checkout pages
  const isCheckoutPage = location.pathname.includes('/checkout');

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
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
          tenant_id: tenantId,
          channel_type: "chat" as "whatsapp",
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

      localStorage.setItem(`support_conversation_${tenantId}`, conversation.id);
      localStorage.setItem(`support_customer_name_${tenantId}`, customerName);
      localStorage.setItem(`support_customer_email_${tenantId}`, customerEmail);

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

      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_customer_message_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

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

  // Don't render if disabled, no tenantId, or on checkout
  if (!tenantId || !config.enabled || isCheckoutPage) return null;

  const showChat = config.type === 'chat' || config.type === 'both';
  const showWhatsApp = (config.type === 'whatsapp' || config.type === 'both') && config.whatsappNumber;
  const positionClass = config.position === 'left' ? 'left-4' : 'right-4';
  const buttonStyle = { backgroundColor: config.buttonColor || '#25D366' };

  // WhatsApp href
  const whatsappHref = showWhatsApp
    ? getWhatsAppHref(config.whatsappNumber!, config.whatsappMessage)
    : null;

  return (
    <>
      {/* Floating Buttons - only when chat is closed */}
      {!isOpen && (
        <div className={cn("fixed bottom-4 z-50 flex flex-col gap-3", positionClass)}>
          {/* WhatsApp Button */}
          {showWhatsApp && whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
              style={buttonStyle}
              title="WhatsApp"
            >
              <Phone className="h-6 w-6 text-white" />
            </a>
          )}

          {/* Chat Button */}
          {showChat && (
            <button
              onClick={() => setIsOpen(true)}
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
              style={showWhatsApp ? { backgroundColor: 'hsl(var(--primary))' } : buttonStyle}
              title="Chat"
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </button>
          )}
        </div>
      )}

      {/* Chat Window */}
      {isOpen && showChat && (
        <div
          className={cn(
            "fixed bottom-4 z-50 flex w-80 flex-col rounded-lg border bg-background shadow-xl transition-all sm:w-96",
            positionClass,
            isMinimized ? "h-14" : "h-[500px]"
          )}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between rounded-t-lg px-4 py-3"
            style={{ backgroundColor: config.buttonColor || 'hsl(var(--primary))', color: '#fff' }}
          >
            <span className="font-medium">Atendimento</span>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
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
                    style={buttonStyle}
                    className="text-white"
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
                                ? "self-end text-white"
                                : "self-start bg-muted"
                            )}
                            style={msg.direction === "inbound" ? buttonStyle : undefined}
                          >
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

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
                      style={buttonStyle}
                      className="text-white"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

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
