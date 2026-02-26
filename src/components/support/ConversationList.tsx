import { useState, useMemo } from "react";
import { MessageSquare, Search, Filter, Inbox, Bot, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Conversation, ConversationStatus, SupportChannelType } from "@/hooks/useConversations";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  filter: 'needs_attention' | 'in_progress' | 'bot' | 'resolved' | 'all';
  onFilterChange: (filter: 'needs_attention' | 'in_progress' | 'bot' | 'resolved' | 'all') => void;
}

const channelIcons: Record<SupportChannelType, string> = {
  whatsapp: '💬',
  email: '✉️',
  facebook_messenger: '📘',
  instagram_dm: '📸',
  mercadolivre: '🛒',
  shopee: '🧡',
  tiktokshop: '🎵',
  chat: '🌐',
};

const statusColors: Record<ConversationStatus, string> = {
  new: 'bg-blue-500',
  open: 'bg-green-500',
  waiting_customer: 'bg-yellow-500',
  waiting_agent: 'bg-orange-500',
  bot: 'bg-purple-500',
  resolved: 'bg-gray-400',
  spam: 'bg-red-500',
};

const statusLabels: Record<ConversationStatus, string> = {
  new: 'Nova',
  open: 'Em atendimento',
  waiting_customer: 'Aguardando cliente',
  waiting_agent: 'Aguardando agente',
  bot: 'IA',
  resolved: 'Resolvida',
  spam: 'Spam',
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<SupportChannelType | 'all'>('all');

  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Filter by tab
    if (filter === 'needs_attention') {
      filtered = filtered.filter(c => c.status === 'new' || c.status === 'waiting_agent');
    } else if (filter === 'in_progress') {
      filtered = filtered.filter(c => c.status === 'open' || c.status === 'waiting_customer');
    } else if (filter === 'bot') {
      filtered = filtered.filter(c => c.status === 'bot' || c.status === 'resolved');
    } else if (filter === 'resolved') {
      filtered = filtered.filter(c => c.status === 'resolved');
    }

    // Filter by channel
    if (channelFilter !== 'all') {
      filtered = filtered.filter(c => c.channel_type === channelFilter);
    }

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c =>
        c.customer_name?.toLowerCase().includes(searchLower) ||
        c.customer_email?.toLowerCase().includes(searchLower) ||
        c.customer_phone?.includes(search)
      );
    }

    return filtered;
  }, [conversations, filter, channelFilter, search]);

  const counts = useMemo(() => {
    return {
      needs_attention: conversations.filter(c => c.status === 'new' || c.status === 'waiting_agent').length,
      in_progress: conversations.filter(c => c.status === 'open' || c.status === 'waiting_customer').length,
      bot: conversations.filter(c => c.status === 'bot' || c.status === 'resolved').length,
      resolved: conversations.filter(c => c.status === 'resolved').length,
      all: conversations.length,
    };
  }, [conversations]);

  return (
    <div className="flex flex-col h-full border-r">
      {/* Filters */}
      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as SupportChannelType | 'all')}>
          <SelectTrigger className="w-full">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
            <SelectItem value="email">✉️ Email</SelectItem>
            <SelectItem value="facebook_messenger">📘 Messenger</SelectItem>
            <SelectItem value="instagram_dm">📸 Instagram</SelectItem>
            <SelectItem value="mercadolivre">🛒 Mercado Livre</SelectItem>
            <SelectItem value="shopee">🧡 Shopee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => onFilterChange('needs_attention')}
          className={cn(
            "flex-1 py-2 px-3 text-sm font-medium flex items-center justify-center gap-1 border-b-2 transition-colors",
            filter === 'needs_attention' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Inbox className="h-4 w-4" />
          <span className="hidden sm:inline">Em aberto</span>
          {counts.needs_attention > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5">
              {counts.needs_attention}
            </Badge>
          )}
        </button>
        <button
          onClick={() => onFilterChange('in_progress')}
          className={cn(
            "flex-1 py-2 px-3 text-sm font-medium flex items-center justify-center gap-1 border-b-2 transition-colors",
            filter === 'in_progress' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Atendendo</span>
          {counts.in_progress > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {counts.in_progress}
            </Badge>
          )}
        </button>
        <button
          onClick={() => onFilterChange('bot')}
          className={cn(
            "flex-1 py-2 px-3 text-sm font-medium flex items-center justify-center gap-1 border-b-2 transition-colors",
            filter === 'bot' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">IA</span>
          {counts.bot > 0 && (
            <Badge className="ml-1 h-5 px-1.5 bg-purple-500">
              {counts.bot}
            </Badge>
          )}
        </button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={cn(
                  "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                  selectedId === conversation.id && "bg-muted"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conversation.customer_avatar_url || undefined} />
                      <AvatarFallback>
                        {conversation.customer_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 text-sm">
                      {channelIcons[conversation.channel_type]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">
                        {conversation.customer_name || conversation.customer_email || conversation.customer_phone || 'Desconhecido'}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {conversation.last_message_at
                          ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true, locale: ptBR })
                          : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", statusColors[conversation.status])} />
                      <span className="text-xs text-muted-foreground truncate">
                        {statusLabels[conversation.status]}
                      </span>
                      {conversation.unread_count > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 ml-auto">
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </div>
                    {conversation.subject && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {conversation.subject}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
