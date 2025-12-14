import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Eye, Save, Palette, ArrowRight } from 'lucide-react';
import { getPublicHomeUrl } from '@/lib/publicUrls';

export default function StorefrontSettings() {
  const { currentTenant } = useAuth();
  const { settings, isLoading, upsertSettings, togglePublish } = useStoreSettings();
  const [formData, setFormData] = useState({
    store_name: '',
    store_description: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#6366f1',
    secondary_color: '#8b5cf6',
    accent_color: '#f59e0b',
    social_facebook: '',
    social_instagram: '',
    social_whatsapp: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings into form when available
  useState(() => {
    if (settings) {
      setFormData({
        store_name: settings.store_name || '',
        store_description: settings.store_description || '',
        logo_url: settings.logo_url || '',
        favicon_url: settings.favicon_url || '',
        primary_color: settings.primary_color || '#6366f1',
        secondary_color: settings.secondary_color || '#8b5cf6',
        accent_color: settings.accent_color || '#f59e0b',
        social_facebook: settings.social_facebook || '',
        social_instagram: settings.social_instagram || '',
        social_whatsapp: settings.social_whatsapp || '',
      });
    }
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await upsertSettings.mutateAsync(formData);
    setHasChanges(false);
  };

  const handleTogglePublish = async () => {
    await togglePublish.mutateAsync(!settings?.is_published);
  };

  const previewUrl = getPublicHomeUrl(currentTenant?.slug || '', true);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Configurações da Loja"
        description="Configure a aparência e informações da sua loja online"
        actions={
          <div className="flex gap-2">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><Eye className="mr-2 h-4 w-4" />Preview</Button>
            </a>
            <Button onClick={handleTogglePublish} variant={settings?.is_published ? 'destructive' : 'default'}>
              {settings?.is_published ? 'Despublicar' : 'Publicar Loja'}
            </Button>
          </div>
        }
      />

      {/* Status */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Status da Loja</p>
            <p className="text-sm text-muted-foreground">
              {settings?.is_published ? 'Sua loja está visível ao público' : 'Sua loja está oculta do público'}
            </p>
          </div>
          <Badge variant={settings?.is_published ? 'default' : 'secondary'}>
            {settings?.is_published ? 'Publicada' : 'Rascunho'}
          </Badge>
        </CardContent>
      </Card>

      {/* Visual Builder Link */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Construtor Visual</p>
              <p className="text-sm text-muted-foreground">
                Personalize as páginas da sua loja com o editor visual
              </p>
            </div>
          </div>
          <Link to="/storefront/builder?edit=home">
            <Button>
              Abrir Editor
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* General Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
          <CardDescription>Informações básicas da sua loja</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Nome da Loja</Label><Input value={formData.store_name} onChange={(e) => handleChange('store_name', e.target.value)} placeholder="Nome da sua loja" /></div>
          <div><Label>Descrição</Label><Textarea value={formData.store_description} onChange={(e) => handleChange('store_description', e.target.value)} placeholder="Breve descrição da sua loja" /></div>
          <div><Label>URL do Logo</Label><Input value={formData.logo_url} onChange={(e) => handleChange('logo_url', e.target.value)} placeholder="https://..." /></div>
          <div><Label>URL do Favicon</Label><Input value={formData.favicon_url} onChange={(e) => handleChange('favicon_url', e.target.value)} placeholder="https://..." /></div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Cores</CardTitle>
          <CardDescription>Defina as cores da sua loja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Cor Primária</Label>
              <div className="flex gap-2 mt-1">
                <Input type="color" value={formData.primary_color} onChange={(e) => handleChange('primary_color', e.target.value)} className="w-12 h-10 p-1" />
                <Input value={formData.primary_color} onChange={(e) => handleChange('primary_color', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Cor Secundária</Label>
              <div className="flex gap-2 mt-1">
                <Input type="color" value={formData.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value)} className="w-12 h-10 p-1" />
                <Input value={formData.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Cor de Destaque</Label>
              <div className="flex gap-2 mt-1">
                <Input type="color" value={formData.accent_color} onChange={(e) => handleChange('accent_color', e.target.value)} className="w-12 h-10 p-1" />
                <Input value={formData.accent_color} onChange={(e) => handleChange('accent_color', e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social */}
      <Card>
        <CardHeader>
          <CardTitle>Redes Sociais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Facebook</Label><Input value={formData.social_facebook} onChange={(e) => handleChange('social_facebook', e.target.value)} placeholder="https://facebook.com/..." /></div>
          <div><Label>Instagram</Label><Input value={formData.social_instagram} onChange={(e) => handleChange('social_instagram', e.target.value)} placeholder="https://instagram.com/..." /></div>
          <div><Label>WhatsApp</Label><Input value={formData.social_whatsapp} onChange={(e) => handleChange('social_whatsapp', e.target.value)} placeholder="5511999999999" /></div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || upsertSettings.isPending}>
          <Save className="mr-2 h-4 w-4" />
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
