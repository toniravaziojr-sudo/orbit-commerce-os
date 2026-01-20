import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { useCustomerTags } from "@/hooks/useCustomers";
import { Loader2, Plus, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  tag_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colorOptions = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export function ListDialog({ open, onOpenChange }: ListDialogProps) {
  const { createList } = useEmailMarketing();
  const { tags, isLoading: isLoadingTags, createTag } = useCustomerTags();
  
  // State for inline tag creation
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(colorOptions[0]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      tag_id: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    await createList.mutateAsync({
      name: values.name,
      description: values.description,
      tag_id: values.tag_id || undefined,
    });
    form.reset();
    setShowTagCreator(false);
    setNewTagName("");
    setNewTagColor(colorOptions[0]);
    onOpenChange(false);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    const result = await createTag.mutateAsync({
      name: newTagName.trim(),
      color: newTagColor,
    });
    
    // Auto-select the newly created tag
    if (result?.id) {
      form.setValue("tag_id", result.id);
    }
    
    setNewTagName("");
    setNewTagColor(colorOptions[0]);
    setShowTagCreator(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Lista de Email</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Lista</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Newsletter Principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição da lista..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tag_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tag Vinculada (opcional)</FormLabel>
                  <div className="space-y-3">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingTags ? "Carregando..." : "Selecione uma tag..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tags.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Nenhuma tag criada ainda
                          </div>
                        ) : (
                          tags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: tag.color || '#888' }} 
                                />
                                {tag.name}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {/* Show existing tags as badges */}
                    {tags.length > 0 && !showTagCreator && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.slice(0, 5).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="cursor-pointer hover:bg-accent text-xs"
                            style={{ borderColor: tag.color, color: tag.color }}
                            onClick={() => form.setValue("tag_id", tag.id)}
                          >
                            <span
                              className="h-2 w-2 rounded-full mr-1"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </Badge>
                        ))}
                        {tags.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{tags.length - 5} mais
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Button to show tag creator */}
                    {!showTagCreator && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => setShowTagCreator(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Criar nova tag
                      </Button>
                    )}

                    {/* Inline tag creator */}
                    {showTagCreator && (
                      <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Tag className="h-4 w-4" />
                          Nova Tag
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome da tag"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              size="icon"
                              onClick={handleCreateTag}
                              disabled={!newTagName.trim() || createTag.isPending}
                            >
                              {createTag.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">Cor</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {colorOptions.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={`h-6 w-6 rounded-full transition-all ${
                                    newTagColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setNewTagColor(color)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setShowTagCreator(false);
                            setNewTagName("");
                            setNewTagColor(colorOptions[0]);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createList.isPending}>
                {createList.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Lista
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
