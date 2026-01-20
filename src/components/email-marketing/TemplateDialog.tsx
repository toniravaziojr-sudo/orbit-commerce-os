import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  subject: z.string().min(1, "Assunto obrigatório"),
  body_html: z.string().min(1, "Conteúdo obrigatório"),
});

type FormValues = z.infer<typeof formSchema>;

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateDialog({ open, onOpenChange }: TemplateDialogProps) {
  const { createTemplate } = useEmailMarketing();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subject: "",
      body_html: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    await createTemplate.mutateAsync({
      name: values.name,
      subject: values.subject,
      body_html: values.body_html,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Template de Email</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Template</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Boas-vindas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assunto do Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Bem-vindo à nossa loja!" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body_html"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo (HTML)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="<h1>Olá {{name}}</h1><p>Seja bem-vindo!</p>" 
                      className="min-h-[200px] font-mono text-sm"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTemplate.isPending}>
                {createTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
