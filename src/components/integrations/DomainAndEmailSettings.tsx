import { Globe, Mail, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <div className="space-y-10">
      {/* Store Domain Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b">
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
      </section>

      {/* Visual Separator */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-dashed" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-xs text-muted-foreground uppercase tracking-wider">
            Configurações de Email
          </span>
        </div>
      </div>

      {/* Email Domain Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Domínio de Email</h2>
            <p className="text-sm text-muted-foreground">
              Configure os registros DNS para autenticar seus emails
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Configuração de DNS</CardTitle>
                <CardDescription>
                  SPF, DKIM e DMARC para entrega confiável de emails
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <EmailDnsSettings />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
