import { useState, useMemo } from "react";
import { MessageSquare, Bot, Plug, History, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ConversationList, 
  ChatWindow, 
  CustomerInfoPanel, 
  AIConfigPanel, 
  ChannelIntegrations,
  ConversationEventsPanel,
  TransferDialog,
} from "@/components/support";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Support() {
  const { user, currentTenant } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [listFilter, setListFilter] = useState<'needs_attention' | 'in_progress' | 'bot' | 'all'>('needs_attention');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showEventsPanel, setShowEventsPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");

  const { conversations, isLoading: conversationsLoading, assignConversation, updateStatus, markAsRead } = useConversations();
  const { messages, isLoading: messagesLoading, sendMessage, sendAiResponse } = useMessages(selectedConversation?.id || null);
  const { quickReplies, incrementUseCount } = useQuickReplies();

  // Filter conversations for AI tab (status = 'bot' or 'new' without assignment)
  const aiConversations = useMemo(() => {
    return conversations.filter(c => 
      ['bot', 'new'].includes(c.status || '') && !c.assigned_to
    );
  }, [conversations]);

  // Filter conversations for inbox (human handled or needs attention)
  const inboxConversations = useMemo(() => {
    return conversations.filter(c => 
      c.assigned_to || ['waiting_agent', 'waiting_customer', 'open'].includes(c.status || '')
    );
  }, [conversations]);

  // AI conversation count for badge
  const aiConversationCount = aiConversations.length;

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    if (conv.unread_count > 0) {
      markAsRead.mutate(conv.id);
    }
  };

  const handleSendMessage = (content: string, options?: { isInternal?: boolean; isNote?: boolean }) => {
    sendMessage.mutate({ content, ...options });
  };

  const handleAssign = (userId: string | null) => {
    if (selectedConversation) {
      assignConversation.mutate({ conversationId: selectedConversation.id, userId });
    }
  };

  const handleResolve = () => {
    if (selectedConversation) {
      updateStatus.mutate({ conversationId: selectedConversation.id, status: 'resolved' });
      setSelectedConversation(null);
    }
  };

  const handleTransfer = async (toUserId: string, reason?: string) => {
    if (!selectedConversation || !currentTenant?.id) return;

    try {
      // Update conversation assignment
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          assigned_to: toUserId,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', selectedConversation.id);

      if (updateError) throw updateError;

      // Log transfer event
      await supabase
        .from('conversation_events')
        .insert({
          tenant_id: currentTenant.id,
          conversation_id: selectedConversation.id,
          event_type: 'transferred',
          actor_id: user?.id,
          actor_name: user?.email,
          actor_type: 'agent',
          old_value: { id: selectedConversation.assigned_to },
          new_value: { id: toUserId },
          metadata: reason ? { reason } : null,
        });

      toast.success('Conversa transferida com sucesso');
      setSelectedConversation(null);
    } catch (error) {
      console.error('Error transferring conversation:', error);
      toast.error('Erro ao transferir conversa');
    }
  };

  // Get conversations based on active tab
  const displayedConversations = activeTab === 'ai' ? aiConversations : (activeTab === 'inbox' ? conversations : []);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-4 border-b">
        <PageHeader
          title="Atendimento"
          description="Central de atendimento unificada com IA"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 border-b">
          <TabsList>
            <TabsTrigger value="inbox" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="h-4 w-4" />
              IA
              {aiConversationCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                  {aiConversationCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ai-settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Config. IA
            </TabsTrigger>
            <TabsTrigger value="channels" className="gap-2">
              <Plug className="h-4 w-4" />
              Canais
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inbox" className="flex-1 m-0 overflow-hidden">
          <div className="flex h-full">
            <div className="w-80 shrink-0">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversation?.id || null}
                onSelect={handleSelectConversation}
                filter={listFilter}
                onFilterChange={setListFilter}
              />
            </div>
            <ChatWindow
              conversation={selectedConversation}
              messages={messages}
              quickReplies={quickReplies}
              isLoading={messagesLoading}
              onSendMessage={handleSendMessage}
              onAssign={handleAssign}
              onResolve={handleResolve}
              onTransfer={() => setShowTransferDialog(true)}
              onAiRespond={() => sendAiResponse.mutate()}
            />
            <div className="w-72 shrink-0 border-l flex flex-col">
              <CustomerInfoPanel conversation={selectedConversation} />
              
              {/* Events Panel Toggle */}
              {selectedConversation && (
                <Sheet open={showEventsPanel} onOpenChange={setShowEventsPanel}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="m-2 gap-2"
                      onClick={() => setShowEventsPanel(true)}
                    >
                      <History className="h-4 w-4" />
                      Ver histórico de eventos
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[400px]">
                    <SheetHeader>
                      <SheetTitle>Histórico de eventos</SheetTitle>
                    </SheetHeader>
                    <ConversationEventsPanel conversationId={selectedConversation.id} />
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </TabsContent>

        {/* AI Inbox - shows conversations being handled by AI */}
        <TabsContent value="ai" className="flex-1 m-0 overflow-hidden">
          <div className="flex h-full">
            <div className="w-80 shrink-0 border-r">
              <div className="p-4 border-b">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Conversas atendidas pela IA
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {aiConversationCount} {aiConversationCount === 1 ? 'conversa ativa' : 'conversas ativas'}
                </p>
              </div>
              <div className="overflow-y-auto h-[calc(100%-73px)]">
                {aiConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                    <Bot className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma conversa sendo atendida pela IA
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Novas conversas aparecerão aqui
                    </p>
                  </div>
                ) : (
                  aiConversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedConversation?.id === conv.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">
                          {conv.customer_name || conv.customer_phone || conv.customer_email || 'Cliente'}
                        </span>
                        <Badge variant={conv.status === 'bot' ? 'default' : 'secondary'} className="text-xs">
                          {conv.status === 'bot' ? 'IA' : 'Novo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.channel_type === 'whatsapp' ? '📱 WhatsApp' : 
                         conv.channel_type === 'email' ? '📧 Email' : 
                         String(conv.channel_type) === 'chat' ? '💬 Chat' : conv.channel_type}
                      </p>
                      {conv.unread_count > 0 && (
                        <Badge variant="destructive" className="mt-1 text-xs">
                          {conv.unread_count} nova{conv.unread_count > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Chat window for selected AI conversation */}
            <div className="flex-1 flex">
              <div className="flex-1">
                <ChatWindow
                  conversation={selectedConversation}
                  messages={messages}
                  quickReplies={quickReplies}
                  isLoading={messagesLoading}
                  onSendMessage={handleSendMessage}
                  onAssign={handleAssign}
                  onResolve={handleResolve}
                  onTransfer={() => setShowTransferDialog(true)}
                  onAiRespond={() => sendAiResponse.mutate()}
                />
              </div>
              {selectedConversation && (
                <div className="w-64 shrink-0 border-l">
                  <CustomerInfoPanel conversation={selectedConversation} />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai-settings" className="flex-1 m-0 overflow-auto">
          <AIConfigPanel />
        </TabsContent>

        <TabsContent value="channels" className="flex-1 m-0 overflow-auto">
          <ChannelIntegrations />
        </TabsContent>
      </Tabs>

      {/* Transfer Dialog */}
      {selectedConversation && (
        <TransferDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          conversationId={selectedConversation.id}
          currentAssignee={selectedConversation.assigned_to}
          onTransfer={handleTransfer}
        />
      )}
    </div>
  );
}
