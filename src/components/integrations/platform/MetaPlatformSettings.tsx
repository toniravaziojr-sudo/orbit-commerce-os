import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, ExternalLink, Globe, Info, Loader2, Shield, Eye, EyeOff, Save, X } from "lucide-react";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";
import { useMetaAuthProfiles } from "@/hooks/useMetaAuthProfiles";
import { CredentialEditor } from "../CredentialEditor";

function AuthProfileCard({
  profileKey,
  displayName,
  description,
  configId,
  effectiveScopes,
  isActive,
  onSave,
  isSaving,
}: {
  profileKey: string;
  displayName: string;
  description: string | null;
  configId: string | null;
  effectiveScopes: string[];
  isActive: boolean;
  onSave: (configId: string | null) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(configId || "");
  const [showScopes, setShowScopes] = useState(false);

  const isConfigured = !!configId;
  const isFullProfile = profileKey === "meta_auth_full";

  const handleSave = () => {
    onSave(value.trim() || null);
    setEditing(false);
  };

  const handleCancel = () => {
    setValue(configId || "");
    setEditing(false);
  };

  return (
    <Card className={`border ${isConfigured ? "border-green-500/30" : "border-yellow-500/30"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isFullProfile ? "bg-purple-500/10" : "bg-blue-500/10"}`}>
              <Shield className={`h-5 w-5 ${isFullProfile ? "text-purple-600" : "text-blue-600"}`} />
            </div>
            <div>
              <CardTitle className="text-base">{displayName}</CardTitle>
              <CardDescription className="text-xs">{description || profileKey}</CardDescription>
            </div>
          </div>
          <Badge
            variant={isConfigured ? "default" : "outline"}
            className={isConfigured ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}
          >
            {isConfigured ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Pronto
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Não configurado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config ID field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Config ID</label>
          {editing ? (
            <div className="flex gap-2">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Cole o Configuration ID aqui"
                className="font-mono text-sm"
              />
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono truncate">
                {configId || "—"}
              </code>
              <Button size="sm" variant="outline" onClick={() => { setValue(configId || ""); setEditing(true); }}>
                Editar
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            ID da configuração do Login do Facebook para Empresas. Encontre em: Meta for Developers → Login do Facebook para Empresas → Configuração.
          </p>
        </div>

        {/* Scopes (read-only) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Escopos ({effectiveScopes.length})
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={() => setShowScopes(!showScopes)}
            >
              {showScopes ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Ocultar
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Ver escopos
                </>
              )}
            </Button>
          </div>
          {showScopes && (
            <div className="flex flex-wrap gap-1 p-3 bg-muted/50 rounded-md max-h-40 overflow-y-auto">
              {effectiveScopes.map((scope) => (
                <Badge key={scope} variant="secondary" className="text-xs font-mono">
                  {scope}
                </Badge>
              ))}
              {effectiveScopes.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum escopo configurado</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetaPlatformSettings() {
  const { data: secretsStatus, isLoading: secretsLoading } = usePlatformIntegrationStatus("meta_platform");
  const { data: profiles, isLoading: profilesLoading, updateConfigId } = useMetaAuthProfiles();

  const appIdConfigured = !!secretsStatus?.secrets?.META_APP_ID;
  const appSecretConfigured = !!secretsStatus?.secrets?.META_APP_SECRET;
  const allCredentialsConfigured = appIdConfigured && appSecretConfigured;

  const isLoading = secretsLoading || profilesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-blue-500/10">
          <Globe className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Meta (Facebook / Instagram)</h2>
          <p className="text-sm text-muted-foreground">
            Credenciais do app e perfis de autenticação V4
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Usadas para OAuth, Pixel, Catálogo, Ads e WhatsApp Cloud API.
          <Button variant="link" size="sm" className="ml-1 h-auto p-0" asChild>
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">
              Meta for Developers <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </AlertDescription>
      </Alert>

      {/* Credenciais globais do App */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Meta App</CardTitle>
                <CardDescription>App ID e Secret globais para todas as integrações Meta</CardDescription>
              </div>
            </div>
            <Badge
              variant={allCredentialsConfigured ? "default" : "outline"}
              className={allCredentialsConfigured ? "bg-green-500/10 text-green-600" : ""}
            >
              {allCredentialsConfigured ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {allCredentialsConfigured ? "Configurado" : "Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialEditor
            credentialKey="META_APP_ID"
            label="App ID"
            description="ID do app Meta for Developers"
            isConfigured={appIdConfigured}
            preview={secretsStatus?.previews?.META_APP_ID}
            source={secretsStatus?.sources?.META_APP_ID as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="META_APP_SECRET"
            label="App Secret"
            description="Chave secreta do app"
            isConfigured={appSecretConfigured}
            preview={secretsStatus?.previews?.META_APP_SECRET}
            source={secretsStatus?.sources?.META_APP_SECRET as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>

      {/* Perfis de Autenticação V4 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Perfis de Autenticação</h3>
          <p className="text-sm text-muted-foreground">
            Cada perfil possui seu próprio Config ID do Login do Facebook para Empresas. O sistema seleciona automaticamente o perfil correto com base no tipo de tenant.
          </p>
        </div>

        {profiles && profiles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {profiles.map((profile) => (
              <AuthProfileCard
                key={profile.profile_key}
                profileKey={profile.profile_key}
                displayName={profile.display_name}
                description={profile.description}
                configId={profile.config_id}
                effectiveScopes={profile.effective_scopes}
                isActive={profile.is_active}
                onSave={(configId) =>
                  updateConfigId.mutate({ profileKey: profile.profile_key, configId })
                }
                isSaving={updateConfigId.isPending}
              />
            ))}
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum perfil de autenticação encontrado. Verifique se a migração V4 foi executada corretamente.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
