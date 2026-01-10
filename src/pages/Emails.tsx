import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Inbox, Send, Headphones, Info, ExternalLink } from "lucide-react";
import { MailboxList } from "@/components/emails/MailboxList";
import { MailboxInbox } from "@/components/emails/MailboxInbox";
import { EmailNotificationsSettings } from "@/components/emails/EmailNotificationsSettings";
import { EmailSupportSettings } from "@/components/emails/EmailSupportSettings";
import { useMailboxes } from "@/hooks/useMailboxes";
import { Link } from "react-router-dom";

export default function Emails() {
  const [activeTab, setActiveTab] = useState("mailboxes");
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const { mailboxes } = useMailboxes();

  const handleOpenInbox = (mailboxId: string) => {
    setSelectedMailboxId(mailboxId);
    setActiveTab("inbox");
  };

  const selectedMailbox = mailboxes.find(m => m.id === selectedMailboxId);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Emails"
        description="Gerencie caixas de email, notificações e atendimento"
      />

      {/* Info about domain configuration */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Para configurar domínio de email, acesse{" "}
            <strong>Integrações → Emails</strong>
          </span>
          <Link 
            to="/integrations" 
            className="flex items-center gap-1 text-primary hover:underline ml-4"
          >
            Ir para Integrações <ExternalLink className="h-3 w-3" />
          </Link>
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid lg:grid-cols-4">
          <TabsTrigger value="mailboxes" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Caixas</span>
            <span className="sm:hidden">Caixas</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
            <span className="sm:hidden">Notif.</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2">
            <Headphones className="h-4 w-4" />
            <span className="hidden sm:inline">Atendimento</span>
            <span className="sm:hidden">Atend.</span>
          </TabsTrigger>
          {selectedMailboxId && (
            <TabsTrigger value="inbox" className="gap-2">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">{selectedMailbox?.display_name || 'Inbox'}</span>
              <span className="sm:hidden">Inbox</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mailboxes" className="mt-6">
          <MailboxList onOpenInbox={handleOpenInbox} />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <EmailNotificationsSettings />
        </TabsContent>

        <TabsContent value="support" className="mt-6">
          <EmailSupportSettings />
        </TabsContent>

        <TabsContent value="inbox" className="mt-6">
          {selectedMailboxId && (
            <MailboxInbox 
              mailboxId={selectedMailboxId} 
              onBack={() => setActiveTab("mailboxes")}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
