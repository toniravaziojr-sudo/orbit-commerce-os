// =============================================
// ADS CHAT TAB
// Chat interface for the AI Traffic Manager
// Multimodal: supports image/file upload + URL analysis
// =============================================

import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Paperclip, X, Image as ImageIcon, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Square } from "lucide-react";
import { useAdsChat, AdsChatAttachment } from "@/hooks/useAdsChat";
import { useSystemUpload } from "@/hooks/useSystemUpload";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ChatMessageBubble, ChatTypingIndicator, ChatEmptyState, ChatConversationList } from "@/components/chat";
import { cn } from "@/lib/utils";

interface AdsChatTabProps {
  scope: "global" | "account";
  adAccountId?: string;
  channel?: string;
}

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf", "text/csv", "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function AdsChatTab({ scope, adAccountId, channel }: AdsChatTabProps) {
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    messagesLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStreaming,
    createConversation,
  } = useAdsChat({ scope, adAccountId, channel });

  const { upload, isUploading } = useSystemUpload({
    source: "ads_chat_attachment",
    subPath: "ads-chat",
  });

  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<AdsChatAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} excede ${MAX_FILE_SIZE_MB}MB`);
        continue;
      }

      const result = await upload(file);
      if (result?.publicUrl) {
        setPendingAttachments(prev => [...prev, {
          url: result.publicUrl,
          filename: file.name,
          mimeType: file.type,
        }]);
      } else {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isStreaming) return;
    const msg = input;
    const atts = [...pendingAttachments];
    setInput("");
    setPendingAttachments([]);
    try {
      await sendMessage(msg, atts.length > 0 ? atts : undefined);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = async () => {
    setIsCreating(true);
    try {
      await createConversation();
    } finally {
      setIsCreating(false);
    }
  };

  const scopeLabel = scope === "account"
    ? `Chat IA — ${adAccountId}`
    : "Chat IA — Global";

  return (
    <div className="grid gap-3 lg:grid-cols-[280px_1fr] h-[calc(100vh-380px)] min-h-[400px]">
      {/* Sidebar */}
      <div className="bg-card border rounded-xl overflow-hidden flex flex-col">
        <ChatConversationList
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={setCurrentConversationId}
          onNew={handleNewConversation}
          isCreating={isCreating}
          className="flex-1"
        />
      </div>

      {/* Chat Area */}
      <div className="bg-card border rounded-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold">{scopeLabel}</p>
            <p className="text-[10px] text-muted-foreground">Converse com a IA sobre suas campanhas</p>
          </div>
        </div>

        {currentConversationId ? (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-5">
                {messages.map((msg) => (
                  <ChatMessageBubble
                    key={msg.id}
                    role={msg.role as "user" | "assistant"}
                    content={msg.content}
                    avatarIcon={msg.role === "user" ? "user" : "bot"}
                    avatarClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                    attachments={msg.attachments?.map(a => ({
                      url: a.url,
                      filename: a.filename,
                      mimeType: a.mimeType,
                    }))}
                    timestamp={msg.created_at ? new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined}
                  />
                ))}

                {isStreaming && streamingContent && (
                  <ChatMessageBubble
                    role="assistant"
                    content={streamingContent}
                    avatarClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                  />
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                      <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="pt-1.5">
                      <ChatTypingIndicator label="Analisando" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Pending Attachments Preview */}
            {pendingAttachments.length > 0 && (
              <div className="border-t px-5 py-2 flex flex-wrap gap-2 bg-muted/20">
                {pendingAttachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border/40 text-xs group"
                  >
                    {att.mimeType?.startsWith("image/") ? (
                      <img src={att.url} alt={att.filename} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[100px] truncate">{att.filename}</span>
                    <button
                      onClick={() => removeAttachment(idx)}
                      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="border-t p-3 px-4">
              <div className={cn(
                "flex items-end gap-1 rounded-2xl border border-border/60 bg-muted/20 p-1.5",
                "focus-within:border-primary/30 focus-within:bg-background transition-all duration-200",
                "shadow-sm"
              )}>
                {/* File upload button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || isUploading}
                  type="button"
                >
                  {isUploading ? (
                    <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ALLOWED_TYPES.join(",")}
                  multiple
                  onChange={handleFileSelect}
                />

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte sobre suas campanhas..."
                  className={cn(
                    "flex-1 min-h-[36px] max-h-[120px] resize-none bg-transparent text-[13px] leading-relaxed",
                    "placeholder:text-muted-foreground/50 focus:outline-none py-2 px-1"
                  )}
                  rows={1}
                  disabled={isStreaming}
                />
                {isStreaming ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelStreaming}
                    className="shrink-0 rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() && pendingAttachments.length === 0}
                    className="shrink-0 rounded-xl h-8 w-8"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <ChatEmptyState
            icon={<MessageCircle className="h-7 w-7 text-primary" />}
            title={scope === "account" ? "Chat da Conta" : "Chat Global de Tráfego"}
            description="Converse com a IA sobre estratégias, envie imagens de anúncios para análise, cole links de concorrentes ou peça relatórios."
            onNewConversation={handleNewConversation}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  );
}
