import { useState } from "react";
import { MessageSquare, Bot, Plug, History } from "lucide-react";
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

export default function Support() {
  const { user, currentTenant } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [listFilter, setListFilter] = useState<'needs_attention' | 'in_progress' | 'bot' | 'all'>('needs_attention');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showEventsPanel, setShowEventsPanel] = useState(false);

  const { conversations, isLoading: conversationsLoading, assignConversation, updateStatus, markAsRead } = useConversations();
  const { messages, isLoading: messagesLoading, sendMessage, sendAiResponse } = useMessages(selectedConversation?.id || null);
  const { quickReplies, incrementUseCount } = useQuickReplies();

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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-4 border-b">
        <PageHeader
          title="Atendimento"
          description="Central de atendimento unificada com IA"
        />
      </div>

      <Tabs defaultValue="inbox" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 border-b">
          <TabsList>
            <TabsTrigger value="inbox" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="h-4 w-4" />
              IA
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


        <TabsContent value="ai" className="flex-1 m-0 overflow-auto">
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
