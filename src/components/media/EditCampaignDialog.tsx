import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMediaCampaigns, MediaCampaign } from "@/hooks/useMediaCampaigns";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().min(10, "Descreva o objetivo da campanha com pelo menos 10 caracteres"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: MediaCampaign | null;
  onSuccess?: () => void;
}

export function EditCampaignDialog({ open, onOpenChange, campaign, onSuccess }: EditCampaignDialogProps) {
  const { updateCampaign } = useMediaCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      prompt: "",
      description: "",
    },
  });

  useEffect(() => {
    if (campaign && open) {
      form.reset({
        name: campaign.name,
        prompt: campaign.prompt || "",
        description: campaign.description || "",
      });
    }
  }, [campaign, open, form]);

  const onSubmit = async (values: FormValues) => {
    if (!campaign) return;
    
    setIsSubmitting(true);
    try {
      await updateCampaign.mutateAsync({
        id: campaign.id,
        name: values.name,
        prompt: values.prompt,
        description: values.description || null,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating campaign:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Campanha</DialogTitle>
          <DialogDescription>
            Atualize as informações da campanha.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da campanha</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Campanha de Janeiro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo / Briefing</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o objetivo da campanha, tom de voz, temas que deseja abordar..."
                      className="min-h-[100px]"
                      {...field}
                    />
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
                    <Input placeholder="Descrição breve" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
