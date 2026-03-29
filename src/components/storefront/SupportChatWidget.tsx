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

      // Register lead in "Leads site" list via marketing-form-submit
      try {
        await supabase.functions.invoke('marketing-form-submit', {
          body: {
            tenant_id: tenantId,
            fields: { email: customerEmail.trim().toLowerCase(), name: customerName.trim() },
            source: 'support_chat',
          },
        });
      } catch {
        // Lead capture is non-blocking
      }
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
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