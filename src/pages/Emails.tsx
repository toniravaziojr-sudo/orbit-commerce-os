import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Inbox, Send, Headphones, Settings } from "lucide-react";
import { MailboxList } from "@/components/emails/MailboxList";
import { MailboxInbox } from "@/components/emails/MailboxInbox";
import { EmailDnsSettings } from "@/components/emails/EmailDnsSettings";
import { EmailNotificationsSettings } from "@/components/emails/EmailNotificationsSettings";
import { EmailSupportSettings } from "@/components/emails/EmailSupportSettings";
import { useMailboxes } from "@/hooks/useMailboxes";

export default function Emails() {
  const [activeTab, setActiveTab] = useState("config");
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
        description="Configure domínio, notificações e atendimento por email"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid lg:grid-cols-5">
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
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

        <TabsContent value="config" className="mt-6">
          <EmailDnsSettings />
        </TabsContent>

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
