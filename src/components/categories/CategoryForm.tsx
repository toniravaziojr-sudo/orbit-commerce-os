import { Category } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { validateSlug, generateSlug as generateSlugUtil } from '@/lib/slugValidation';

interface CategoryFormProps {
  formData: {
    name: string;
    slug: string;
    description: string;
    image_url: string;
    parent_id: string;
    is_active: boolean;
    sort_order: number;
    seo_title: string;
    seo_description: string;
  };
  onChange: (data: CategoryFormProps['formData']) => void;
  onSubmit: () => void;
  onClose: () => void;
  isEditing: boolean;
  parentCategories: Category[];
  editingCategoryId?: string;
  isLoading?: boolean;
}

export function CategoryForm({
  formData,
  onChange,
  onSubmit,
  onClose,
  isEditing,
  parentCategories,
  editingCategoryId,
  isLoading,
}: CategoryFormProps) {
  // Filter out the current category and its children from parent options
  const availableParents = parentCategories.filter(c => c.id !== editingCategoryId);

  // Use centralized slug generation utility
  const handleGenerateSlug = (name: string) => generateSlugUtil(name);
  
  // Validate slug in real-time
  const slugValidation = validateSlug(formData.slug);
  const isSlugValid = slugValidation.isValid;
  const slugError = slugValidation.error;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              onChange({
                ...formData,
                name,
                slug: formData.slug || handleGenerateSlug(name),
              });
            }}
            placeholder="Nome da categoria"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => onChange({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
            placeholder="slug-da-categoria"
            className={!isSlugValid && formData.slug ? 'border-destructive' : ''}
          />
          {!isSlugValid && formData.slug ? (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {slugError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Usado na URL: /c/{formData.slug || 'slug'}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent">Categoria Pai</Label>
          <Select
            value={formData.parent_id || 'none'}
            onValueChange={(v) => onChange({ ...formData, parent_id: v === 'none' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nenhuma (categoria raiz)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma (categoria raiz)</SelectItem>
              {availableParents.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            placeholder="Descrição da categoria"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image_url">Imagem</Label>
          <div className="flex gap-2">
            <Input
              id="image_url"
              value={formData.image_url}
              onChange={(e) => onChange({ ...formData, image_url: e.target.value })}
              placeholder="URL da imagem"
            />
            {formData.image_url && (
              <div className="h-10 w-10 rounded border overflow-hidden flex-shrink-0">
                <img
                  src={formData.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => onChange({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            Categoria ativa
          </Label>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">SEO</h4>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="seo_title">Título SEO</Label>
              <Input
                id="seo_title"
                value={formData.seo_title}
                onChange={(e) => onChange({ ...formData, seo_title: e.target.value })}
                placeholder="Título para mecanismos de busca"
              />
              <p className="text-xs text-muted-foreground">
                {formData.seo_title.length}/60 caracteres
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo_description">Descrição SEO</Label>
              <Textarea
                id="seo_description"
                value={formData.seo_description}
                onChange={(e) => onChange({ ...formData, seo_description: e.target.value })}
                placeholder="Descrição para mecanismos de busca"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {formData.seo_description.length}/160 caracteres
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!formData.name || !isSlugValid || isLoading} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
