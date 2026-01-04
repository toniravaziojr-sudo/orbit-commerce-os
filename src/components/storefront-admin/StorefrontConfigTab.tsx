import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStoreSettings, type CustomSocialLink } from '@/hooks/useStoreSettings';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ImageUpload } from '@/components/settings/ImageUpload';
import { CustomSocialLinks } from '@/components/settings/CustomSocialLinks';
import { 
  Save, 
  Palette, 
  ArrowRight,
  Building2,
  Phone,
  Share2,
  Mail,
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Youtube
} from 'lucide-react';

export function StorefrontConfigTab() {
  const { currentTenant } = useAuth();
  const { settings, isLoading, upsertSettings, togglePublish, uploadAsset } = useStoreSettings();
  
  // Form state
  const [formData, setFormData] = useState({
    // Informações do negócio
    business_legal_name: '',
    store_name: '', // Nome Fantasia
    store_description: '', // Descrição curta
    business_cnpj: '',
    logo_url: '',
    favicon_url: '',
    // Informações de contato
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    contact_support_hours: '',
    social_whatsapp: '',
    // Redes sociais
    social_facebook: '',
    social_instagram: '',
    social_tiktok: '',
    social_youtube: '',
    social_custom: [] as CustomSocialLink[],
    // Cores do tema
    primary_color: '#6366f1',
    secondary_color: '#8b5cf6',
    accent_color: '#f59e0b',
  });
  
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings into form when available
  useEffect(() => {
    if (settings) {
      setFormData({
        business_legal_name: settings.business_legal_name || '',
        store_name: settings.store_name || '',
        store_description: settings.store_description || '',
        business_cnpj: settings.business_cnpj || '',
        logo_url: settings.logo_url || '',
        favicon_url: settings.favicon_url || '',
        contact_phone: settings.contact_phone || '',
        contact_email: settings.contact_email || '',
        contact_address: settings.contact_address || '',
        contact_support_hours: settings.contact_support_hours || '',
        social_whatsapp: settings.social_whatsapp || '',
        social_facebook: settings.social_facebook || '',
        social_instagram: settings.social_instagram || '',
        social_tiktok: settings.social_tiktok || '',
        social_youtube: settings.social_youtube || '',
        social_custom: settings.social_custom || [],
        primary_color: settings.primary_color || '#6366f1',
        secondary_color: settings.secondary_color || '#8b5cf6',
        accent_color: settings.accent_color || '#f59e0b',
      });
      setHasChanges(false);
    }
  }, [settings]);

  const handleChange = (field: string, value: string | CustomSocialLink[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await upsertSettings.mutateAsync({
      ...formData,
      social_custom: formData.social_custom as unknown as import('@/integrations/supabase/types').Json,
    });
    setHasChanges(false);
  };

  const handleLogoUpload = async (file: File) => {
    const url = await uploadAsset(file, 'logo');
    if (url) {
      handleChange('logo_url', url);
    }
    return url;
  };

  const handleFaviconUpload = async (file: File) => {
    const url = await uploadAsset(file, 'favicon');
    if (url) {
      handleChange('favicon_url', url);
    }
    return url;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* 1. Informações do Negócio */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Informações do Negócio</CardTitle>
          </div>
          <CardDescription>Dados da empresa e identidade visual</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="business_legal_name">Razão Social</Label>
              <Input
                id="business_legal_name"
                value={formData.business_legal_name}
                onChange={(e) => handleChange('business_legal_name', e.target.value)}
                placeholder="Razão social da empresa"
              />
            </div>
            <div>
              <Label htmlFor="store_name">Nome Fantasia (Nome da Loja)</Label>
              <Input
                id="store_name"
                value={formData.store_name}
                onChange={(e) => handleChange('store_name', e.target.value)}
                placeholder="Nome que aparecerá para os clientes"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="store_description">Descrição Curta</Label>
            <Textarea
              id="store_description"
              value={formData.store_description}
              onChange={(e) => handleChange('store_description', e.target.value)}
              placeholder="Breve descrição da sua loja (aparece no rodapé e SEO)"
              rows={3}
            />
          </div>
          
          <div className="max-w-xs">
            <Label htmlFor="business_cnpj">CNPJ</Label>
            <Input
              id="business_cnpj"
              value={formData.business_cnpj}
              onChange={(e) => handleChange('business_cnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUpload
              label="Logo"
              description="Recomendado: PNG ou SVG transparente, max 2MB"
              value={formData.logo_url}
              onChange={(url) => handleChange('logo_url', url || '')}
              onUpload={handleLogoUpload}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
            />
            
            <ImageUpload
              label="Favicon"
              description="Ícone da aba do navegador, 32x32px ou 64x64px"
              value={formData.favicon_url}
              onChange={(url) => handleChange('favicon_url', url || '')}
              onUpload={handleFaviconUpload}
              accept="image/png,image/x-icon,image/webp"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Informações de Contato */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Informações de Contato</CardTitle>
          </div>
          <CardDescription>Canais de atendimento e localização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone Fixo
              </Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                placeholder="(11) 3000-0000"
              />
            </div>
            <div>
              <Label htmlFor="social_whatsapp" className="flex items-center gap-2">
                WhatsApp
              </Label>
              <Input
                id="social_whatsapp"
                value={formData.social_whatsapp}
                onChange={(e) => handleChange('social_whatsapp', e.target.value)}
                placeholder="5511999999999"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formato: código do país + DDD + número (sem espaços)
              </p>
            </div>
          </div>
          
          <div>
            <Label htmlFor="contact_email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-mail
            </Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => handleChange('contact_email', e.target.value)}
              placeholder="contato@sualoja.com.br"
            />
          </div>
          
          <div>
            <Label htmlFor="contact_address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </Label>
            <Textarea
              id="contact_address"
              value={formData.contact_address}
              onChange={(e) => handleChange('contact_address', e.target.value)}
              placeholder="Rua, número, bairro - Cidade/UF"
              rows={2}
            />
          </div>
          
          <div>
            <Label htmlFor="contact_support_hours" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário de Atendimento
            </Label>
            <Input
              id="contact_support_hours"
              value={formData.contact_support_hours}
              onChange={(e) => handleChange('contact_support_hours', e.target.value)}
              placeholder="De segunda a sexta, das 9h às 18h"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Redes Sociais */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Redes Sociais</CardTitle>
          </div>
          <CardDescription>Links para suas redes sociais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="social_facebook" className="flex items-center gap-2">
                <Facebook className="h-4 w-4" />
                Facebook
              </Label>
              <Input
                id="social_facebook"
                value={formData.social_facebook}
                onChange={(e) => handleChange('social_facebook', e.target.value)}
                placeholder="https://facebook.com/sualoja"
              />
            </div>
            <div>
              <Label htmlFor="social_instagram" className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram
              </Label>
              <Input
                id="social_instagram"
                value={formData.social_instagram}
                onChange={(e) => handleChange('social_instagram', e.target.value)}
                placeholder="https://instagram.com/sualoja"
              />
            </div>
            <div>
              <Label htmlFor="social_tiktok">TikTok</Label>
              <Input
                id="social_tiktok"
                value={formData.social_tiktok}
                onChange={(e) => handleChange('social_tiktok', e.target.value)}
                placeholder="https://tiktok.com/@sualoja"
              />
            </div>
            <div>
              <Label htmlFor="social_youtube" className="flex items-center gap-2">
                <Youtube className="h-4 w-4" />
                YouTube
              </Label>
              <Input
                id="social_youtube"
                value={formData.social_youtube}
                onChange={(e) => handleChange('social_youtube', e.target.value)}
                placeholder="https://youtube.com/@sualoja"
              />
            </div>
          </div>
          
          <Separator />
          
          <CustomSocialLinks
            value={formData.social_custom}
            onChange={(links) => handleChange('social_custom', links)}
          />
        </CardContent>
      </Card>

      {/* 4. Cores do Tema */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Cores Padrões do Tema</CardTitle>
          </div>
          <CardDescription>Cores principais usadas na sua loja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label>Cor Primária</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  placeholder="#6366f1"
                />
              </div>
            </div>
            <div>
              <Label>Cor Secundária</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  placeholder="#8b5cf6"
                />
              </div>
            </div>
            <div>
              <Label>Cor de Destaque</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={formData.accent_color}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.accent_color}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  placeholder="#f59e0b"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={upsertSettings.isPending} size="lg" className="shadow-lg">
            <Save className="mr-2 h-4 w-4" />
            {upsertSettings.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      )}
    </div>
  );
}
