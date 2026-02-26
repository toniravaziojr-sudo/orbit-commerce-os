import { EmailBlock } from "@/lib/email-builder-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Settings2 } from "lucide-react";

interface BlockPropertyEditorProps {
  block: EmailBlock | null;
  onUpdate: (id: string, props: Record<string, any>) => void;
}

export function BlockPropertyEditor({ block, onUpdate }: BlockPropertyEditorProps) {
  if (!block) {
    return (
      <div className="w-64 shrink-0 border-l bg-muted/30 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecione um bloco para editar</p>
        </div>
      </div>
    );
  }

  const update = (key: string, value: any) => onUpdate(block.id, { [key]: value });

  return (
    <div className="w-64 shrink-0 border-l bg-muted/30 overflow-y-auto">
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propriedades</p>
      </div>
      <div className="p-3 space-y-4">
        {block.type === 'text' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Conteúdo</Label>
              <Textarea rows={4} value={block.props.content || ''} onChange={e => update('content', e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={block.props.tag || 'p'} onValueChange={v => update('tag', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="h1">Título (H1)</SelectItem>
                  <SelectItem value="h2">Subtítulo (H2)</SelectItem>
                  <SelectItem value="p">Parágrafo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Alinhamento</Label>
              <Select value={block.props.align || 'left'} onValueChange={v => update('align', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={block.props.color || '#333333'} onChange={e => update('color', e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                <Input value={block.props.color || '#333333'} onChange={e => update('color', e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
          </>
        )}

        {block.type === 'image' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">URL da imagem</Label>
              <Input value={block.props.src || ''} onChange={e => update('src', e.target.value)} placeholder="https://..." className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto alternativo</Label>
              <Input value={block.props.alt || ''} onChange={e => update('alt', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link (opcional)</Label>
              <Input value={block.props.link || ''} onChange={e => update('link', e.target.value)} placeholder="https://..." className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Largura</Label>
              <Select value={block.props.width || '100%'} onValueChange={v => update('width', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="100%">100%</SelectItem>
                  <SelectItem value="75%">75%</SelectItem>
                  <SelectItem value="50%">50%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {block.type === 'button' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do botão</Label>
              <Input value={block.props.text || ''} onChange={e => update('text', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL</Label>
              <Input value={block.props.url || ''} onChange={e => update('url', e.target.value)} placeholder="https://..." className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={block.props.bgColor || '#3b82f6'} onChange={e => update('bgColor', e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                <Input value={block.props.bgColor || '#3b82f6'} onChange={e => update('bgColor', e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={block.props.textColor || '#ffffff'} onChange={e => update('textColor', e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                <Input value={block.props.textColor || '#ffffff'} onChange={e => update('textColor', e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Alinhamento</Label>
              <Select value={block.props.align || 'center'} onValueChange={v => update('align', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Borda arredondada</Label>
              <Slider value={[Number(block.props.borderRadius) || 6]} onValueChange={v => update('borderRadius', String(v[0]))} min={0} max={24} step={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Largura total</Label>
              <Switch checked={block.props.fullWidth || false} onCheckedChange={v => update('fullWidth', v)} />
            </div>
          </>
        )}

        {block.type === 'divider' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={block.props.color || '#e5e7eb'} onChange={e => update('color', e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
                <Input value={block.props.color || '#e5e7eb'} onChange={e => update('color', e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Espessura</Label>
              <Slider value={[block.props.thickness || 1]} onValueChange={v => update('thickness', v[0])} min={1} max={5} step={1} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estilo</Label>
              <Select value={block.props.style || 'solid'} onValueChange={v => update('style', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Sólido</SelectItem>
                  <SelectItem value="dashed">Tracejado</SelectItem>
                  <SelectItem value="dotted">Pontilhado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {block.type === 'spacer' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Altura ({block.props.height || 24}px)</Label>
            <Slider value={[block.props.height || 24]} onValueChange={v => update('height', v[0])} min={8} max={120} step={4} />
          </div>
        )}

        {block.type === 'product' && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar imagem</Label>
              <Switch checked={block.props.showImage !== false} onCheckedChange={v => update('showImage', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar preço</Label>
              <Switch checked={block.props.showPrice !== false} onCheckedChange={v => update('showPrice', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mostrar botão</Label>
              <Switch checked={block.props.showButton !== false} onCheckedChange={v => update('showButton', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do botão</Label>
              <Input value={block.props.buttonText || 'Comprar'} onChange={e => update('buttonText', e.target.value)} className="h-8 text-xs" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
