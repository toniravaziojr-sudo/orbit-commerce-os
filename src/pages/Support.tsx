import { useState } from "react";
import { MessageSquare, Bot, Settings, Plug } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConversationList, ChatWindow, CustomerInfoPanel, AIConfigPanel, ChannelIntegrations } from "@/components/support";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useQuickReplies } from "@/hooks/useQuickReplies";
import { useAuth } from "@/hooks/useAuth";

export default function Support() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [listFilter, setListFilter] = useState<'needs_attention' | 'in_progress' | 'bot' | 'all'>('needs_attention');

  const { conversations, isLoading: conversationsLoading, assignConversation, updateStatus, markAsRead } = useConversations();
  const { messages, isLoading: messagesLoading, sendMessage, sendAiResponse } = useMessages(selectedConversation?.id || null);
  const { quickReplies } = useQuickReplies();

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
              Configurar IA
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
              onTransfer={() => {}}
              onAiRespond={() => sendAiResponse.mutate()}
            />
            <CustomerInfoPanel conversation={selectedConversation} />
          </div>
        </TabsContent>

        <TabsContent value="ai" className="flex-1 m-0 overflow-auto">
          <AIConfigPanel />
        </TabsContent>

        <TabsContent value="channels" className="flex-1 m-0 overflow-auto">
          <ChannelIntegrations />
        </TabsContent>
      </Tabs>
    </div>
  );
}
