import { Settings as SettingsIcon, Store, Users, Shield, Bell, Palette, Globe, Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const PLATFORM_ADMIN_EMAIL = "respeiteohomem@gmail.com";

const getSettingsSections = (isPlatformAdmin: boolean) => {
  const sections = [
    {
      title: "Dados da Loja",
      description: "Configure informações básicas, logo e dados de contato",
      icon: Store,
      href: "/storefront",
    },
    {
      title: "Domínios",
      description: "Gerencie domínios personalizados da sua loja",
      icon: Globe,
      href: "/settings/domains",
    },
    {
      title: "Equipe & Permissões",
      description: "Gerencie usuários, funções e níveis de acesso (RBAC)",
      icon: Users,
    },
    {
      title: "Segurança",
      description: "Autenticação, senhas e configurações de segurança",
      icon: Shield,
    },
    {
      title: "Notificações",
      description: "Preferências de alertas e comunicações do sistema",
      icon: Bell,
    },
    {
      title: "Aparência",
      description: "Personalize cores, tema e identidade visual",
      icon: Palette,
    },
  ];

  // Add platform admin section
  if (isPlatformAdmin) {
    sections.push({
      title: "Emails do App",
      description: "Configure templates de emails do sistema (login, reset, tutoriais)",
      icon: Mail,
      href: "/settings/emails",
    });
  }

  return sections;
};

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPlatformAdmin = user?.email === PLATFORM_ADMIN_EMAIL;
  const settingsSections = getSettingsSections(isPlatformAdmin);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações gerais do sistema"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.title}
              className={`transition-all hover:shadow-md hover:border-primary/50 ${section.href ? 'cursor-pointer' : ''}`}
              onClick={() => section.href && navigate(section.href)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {section.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Informações do Tenant</CardTitle>
          <CardDescription>
            Dados da sua conta e configuração multi-tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">ID do Tenant</p>
              <p className="mt-1 font-mono text-sm text-foreground">—</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Plano</p>
              <p className="mt-1 text-sm text-foreground">—</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Criado em</p>
              <p className="mt-1 text-sm text-foreground">—</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Usuários Ativos</p>
              <p className="mt-1 text-sm text-foreground">—</p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button variant="outline">Gerenciar Plano</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
