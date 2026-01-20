import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Inbox, 
  Send, 
  FileText, 
  Trash2, 
  AlertCircle,
  RefreshCw,
  PenSquare,
  Star,
  Mail,
  Search
} from "lucide-react";
import { useMailboxFolders, useMailboxes } from "@/hooks/useMailboxes";
import { useEmailMessages } from "@/hooks/useEmailMessages";
import { EmailList } from "./EmailList";
import { EmailViewer } from "./EmailViewer";
import { EmailComposer } from "./EmailComposer";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MailboxInboxProps {
  mailboxId: string;
  onBack: () => void;
}

const folderIcons: Record<string, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  trash: Trash2,
  spam: AlertCircle,
};

export function MailboxInbox({ mailboxId, onBack }: MailboxInboxProps) {
  const { mailboxes } = useMailboxes();
  const { data: folders, isLoading: foldersLoading } = useMailboxFolders(mailboxId);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const mailbox = mailboxes.find(m => m.id === mailboxId);
  const inboxFolder = folders?.find(f => f.slug === 'inbox');
  const currentFolderId = selectedFolderId || inboxFolder?.id || null;

  const { data: messages, isLoading: messagesLoading, refetch } = useEmailMessages(mailboxId, currentFolderId);

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!messages || !searchQuery.trim()) return messages || [];
    
    const query = searchQuery.toLowerCase().trim();
    return messages.filter(msg => 
      msg.subject?.toLowerCase().includes(query) ||
      msg.from_name?.toLowerCase().includes(query) ||
      msg.from_email?.toLowerCase().includes(query) ||
      msg.snippet?.toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  const handleReply = (messageId: string) => {
    setReplyToMessage(messageId);
    setIsComposing(true);
  };

  const handleCloseComposer = () => {
    setIsComposing(false);
    setReplyToMessage(null);
  };

  if (foldersLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] gap-4">
        <div className="w-48 space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Sidebar - Folders */}
      <div className="w-48 flex-shrink-0 space-y-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start mb-4"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Button
          className="w-full"
          onClick={() => setIsComposing(true)}
        >
          <PenSquare className="h-4 w-4 mr-2" />
          Novo Email
        </Button>

        <div className="pt-4 space-y-1">
          {folders?.map(folder => {
            const Icon = folderIcons[folder.slug] || Mail;
            const isActive = folder.id === currentFolderId;

            return (
              <Button
                key={folder.id}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-secondary"
                )}
                onClick={() => {
                  setSelectedFolderId(folder.id);
                  setSelectedMessageId(null);
                }}
              >
                <Icon className="h-4 w-4 mr-2" />
                {folder.name}
                {folder.unread_count > 0 && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                    {folder.unread_count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-w-0">
        {/* Email list */}
        <div className={cn(
          "flex flex-col border rounded-lg bg-card",
          selectedMessageId ? "w-1/3" : "w-full"
        )}>
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-medium text-sm">
              {folders?.find(f => f.id === currentFolderId)?.name || 'Entrada'}
            </h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Search input */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por assunto, remetente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <EmailList
            messages={filteredMessages}
            isLoading={messagesLoading}
            selectedId={selectedMessageId}
            onSelect={setSelectedMessageId}
          />
        </div>

        {/* Email viewer */}
        {selectedMessageId && (
          <div className="flex-1 border rounded-lg bg-card overflow-hidden">
            <EmailViewer
              messageId={selectedMessageId}
              onClose={() => setSelectedMessageId(null)}
              onReply={() => handleReply(selectedMessageId)}
            />
          </div>
        )}
      </div>

      {/* Composer dialog */}
      {isComposing && mailbox && (
        <EmailComposer
          mailbox={mailbox}
          replyToMessageId={replyToMessage}
          onClose={handleCloseComposer}
        />
      )}
    </div>
  );
}
