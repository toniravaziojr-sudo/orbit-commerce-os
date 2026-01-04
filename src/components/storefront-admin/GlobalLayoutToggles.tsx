import { useAuth } from '@/hooks/useAuth';
import { useGlobalLayoutForEditor } from '@/hooks/useGlobalLayoutIntegration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Layout, PanelTop, PanelBottom } from 'lucide-react';

export function GlobalLayoutToggles() {
  const { currentTenant } = useAuth();
  const { globalLayout, isLoading, updateVisibilityToggles } = useGlobalLayoutForEditor(currentTenant?.id);

  const handleToggle = async (field: string, value: boolean) => {
    try {
      await updateVisibilityToggles.mutateAsync({ [field]: value });
      toast.success('Configuração atualizada');
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layout className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Layout Global</CardTitle>
            <CardDescription>
              Controle a exibição do cabeçalho e rodapé em todas as páginas
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <PanelTop className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label htmlFor="header-toggle" className="font-medium">
                Cabeçalho (Header)
              </Label>
              <p className="text-sm text-muted-foreground">
                Exibe o cabeçalho com logo, menu e busca
              </p>
            </div>
          </div>
          <Switch
            id="header-toggle"
            checked={globalLayout?.header_enabled ?? true}
            onCheckedChange={(checked) => handleToggle('header_enabled', checked)}
            disabled={updateVisibilityToggles.isPending}
          />
        </div>

        {/* Footer Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <PanelBottom className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="footer-toggle" className="font-medium">
                  Rodapé (Footer)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Exibe o rodapé completo da loja
                </p>
              </div>
            </div>
            <Switch
              id="footer-toggle"
              checked={globalLayout?.footer_enabled ?? true}
              onCheckedChange={(checked) => handleToggle('footer_enabled', checked)}
              disabled={updateVisibilityToggles.isPending}
            />
          </div>

          {/* Footer sub-toggles - only shown when footer is enabled */}
          {globalLayout?.footer_enabled && (
            <div className="ml-8 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <Label htmlFor="footer1-toggle" className="font-medium text-sm">
                    Menu do Rodapé 1
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Primeiro menu de links (categorias, produtos)
                  </p>
                </div>
                <Switch
                  id="footer1-toggle"
                  checked={globalLayout?.show_footer_1 ?? true}
                  onCheckedChange={(checked) => handleToggle('show_footer_1', checked)}
                  disabled={updateVisibilityToggles.isPending}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <Label htmlFor="footer2-toggle" className="font-medium text-sm">
                    Menu do Rodapé 2
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Segundo menu de links (políticas, institucional)
                  </p>
                </div>
                <Switch
                  id="footer2-toggle"
                  checked={globalLayout?.show_footer_2 ?? true}
                  onCheckedChange={(checked) => handleToggle('show_footer_2', checked)}
                  disabled={updateVisibilityToggles.isPending}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
