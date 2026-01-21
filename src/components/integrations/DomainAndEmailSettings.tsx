import { Globe, Mail, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmailDnsSettings } from "@/components/emails/EmailDnsSettings";
import { DomainSettingsContent } from "@/components/settings/DomainSettingsContent";

/**
 * Unified component for Domain and Email settings in the Integrations page.
 * Contains two clear sections:
 * 1. Store Domain - Configure the storefront domain (platform subdomain + custom domains)
 * 2. Email Domain - Configure the email sending/receiving domain (DNS settings)
 */
export function DomainAndEmailSettings() {
  return (
    <div className="space-y-8">
      {/* Store Domain Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Domínio da Loja</h2>
            <p className="text-sm text-muted-foreground">
              Configure a URL pública da sua loja virtual
            </p>
          </div>
        </div>
        
        <DomainSettingsContent />
      </div>

      <Separator className="my-8" />

      {/* Email Domain Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Domínio de Email</h2>
            <p className="text-sm text-muted-foreground">
              Configure o domínio para enviar e receber emails
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Configuração de DNS</CardTitle>
                <CardDescription>
                  Configure os registros DNS para autenticar seus emails
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <EmailDnsSettings />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
