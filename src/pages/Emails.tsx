import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Inbox, Send, Headphones } from "lucide-react";
import { MailboxList } from "@/components/emails/MailboxList";
import { MailboxInbox } from "@/components/emails/MailboxInbox";
import { EmailProviderSettings } from "@/components/integrations/EmailProviderSettings";
import { SupportEmailSettings } from "@/components/integrations/SupportEmailSettings";
import { useMailboxes } from "@/hooks/useMailboxes";

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
        description="Gerencie suas caixas de email, notificações e atendimento"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid lg:grid-cols-4">
          <TabsTrigger value="mailboxes" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Caixas de Email</span>
            <span className="sm:hidden">Caixas</span>
          </TabsTrigger>
          <TabsTrigger value="transactional" className="gap-2">
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
              <span className="hidden sm:inline">{selectedMailbox?.display_name || selectedMailbox?.email_address.split('@')[0] || 'Inbox'}</span>
              <span className="sm:hidden">Inbox</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mailboxes" className="mt-6">
          <MailboxList onOpenInbox={handleOpenInbox} />
        </TabsContent>

        <TabsContent value="transactional" className="mt-6">
          <EmailProviderSettings />
        </TabsContent>

        <TabsContent value="support" className="mt-6">
          <SupportEmailSettings />
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
