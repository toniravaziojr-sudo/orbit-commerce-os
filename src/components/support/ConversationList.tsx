import { useState, useMemo } from "react";
import { MessageSquare, Search, Filter, Inbox, Bot, User, Mail, Globe, ShoppingCart, Music, Instagram } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Conversation, ConversationStatus, SupportChannelType } from "@/hooks/useConversations";
import { cn } from "@/lib/utils";

import { formatDateBR } from "@/lib/date-format";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  filter: 'needs_attention' | 'in_progress' | 'bot' | 'resolved' | 'all';
  onFilterChange: (filter: 'needs_attention' | 'in_progress' | 'bot' | 'resolved' | 'all') => void;
}

// Channel icon components for visual distinction
// WhatsApp SVG icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function ChannelIcon({ channel, className }: { channel: SupportChannelType; className?: string }) {
  const iconClass = cn("h-3.5 w-3.5", className);
  switch (channel) {
    case 'whatsapp':
      return <WhatsAppIcon className={cn(iconClass, "text-green-500")} />;
    case 'email':
      return <Mail className={cn(iconClass, "text-blue-500")} />;
    case 'facebook_messenger':
      return <MessageSquare className={cn(iconClass, "text-blue-600")} />;
    case 'instagram_dm':
      return <Instagram className={cn(iconClass, "text-pink-500")} />;
    case 'instagram_comments':
      return <Instagram className={cn(iconClass, "text-pink-400")} />;
    case 'facebook_comments':
      return <MessageSquare className={cn(iconClass, "text-blue-500")} />;
    case 'mercadolivre':
      return <ShoppingCart className={cn(iconClass, "text-yellow-500")} />;
    case 'shopee':
      return <ShoppingCart className={cn(iconClass, "text-orange-500")} />;
    case 'tiktokshop':
      return <Music className={cn(iconClass, "text-foreground")} />;
    case 'chat':
      return <Globe className={cn(iconClass, "text-primary")} />;
    default:
      return <MessageSquare className={iconClass} />;
  }
}

/** Format date as "Hoje", "Ontem", or dd/mm/yyyy */
function formatConversationDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return format(date, "EEEE", { locale: ptBR }); // dia da semana
  return formatDateBR(date);
}

const statusColors: Record<ConversationStatus, string> = {
  new: 'bg-blue-500',
  open: 'bg-green-500',
  waiting_customer: 'bg-yellow-500',
  waiting_agent: 'bg-orange-500',
  bot: 'bg-purple-500',
  resolved: 'bg-gray-400',
  spam: 'bg-red-500',
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
            <SelectItem value="instagram_dm">📸 Instagram DM</SelectItem>
            <SelectItem value="instagram_comments">💬 Comentários IG</SelectItem>
            <SelectItem value="facebook_comments">💬 Comentários FB</SelectItem>
            <SelectItem value="mercadolivre">🛒 Mercado Livre</SelectItem>
            <SelectItem value="shopee">🧡 Shopee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs — rótulos sempre visíveis (Fase 0) */}
      <div className="flex border-b">
        <button
          onClick={() => onFilterChange('needs_attention')}
          className={cn(
            "flex-1 min-w-0 py-2 px-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors whitespace-nowrap",
            filter === 'needs_attention' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span className="truncate">Em aberto</span>
          {counts.needs_attention > 0 && (
            <Badge variant="destructive" className="ml-0.5 h-5 px-1.5 shrink-0">
              {counts.needs_attention}
            </Badge>
          )}
        </button>
        <button
          onClick={() => onFilterChange('in_progress')}
          className={cn(
            "flex-1 min-w-0 py-2 px-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors whitespace-nowrap",
            filter === 'in_progress' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate">Atendimento</span>
          {counts.in_progress > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 shrink-0">
              {counts.in_progress}
            </Badge>
          )}
        </button>
        <button
          onClick={() => onFilterChange('bot')}
          className={cn(
            "flex-1 min-w-0 py-2 px-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors whitespace-nowrap",
            filter === 'bot' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Bot className="h-4 w-4 shrink-0" />
          <span className="truncate">IA</span>
          {counts.bot > 0 && (
            <Badge className="ml-0.5 h-5 px-1.5 bg-purple-500 shrink-0">
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
                    <span className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                      <ChannelIcon channel={conversation.channel_type} />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + unread badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate text-sm">
                        {conversation.customer_name || conversation.customer_email || conversation.customer_phone || 'Desconhecido'}
                      </span>
                      {conversation.unread_count > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 shrink-0">
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </div>
                    {/* Row 2: Last message preview */}
                    {conversation.summary && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conversation.summary}
                      </p>
                    )}
                    {/* Row 3: Status dot + date */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", statusColors[conversation.status])} />
                      <span className="text-[11px] text-muted-foreground">
                        {formatConversationDate(conversation.last_message_at)}
                      </span>
                    </div>
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