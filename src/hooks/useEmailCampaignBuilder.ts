import { useState, useCallback } from "react";
import { EmailBlock, EmailBlockType, createBlock, blocksToHtml, blocksToPlainText } from "@/lib/email-builder-utils";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export interface CampaignConfig {
  name: string;
  type: "broadcast" | "automation";
  list_id: string;
}

export interface CampaignContent {
  subject: string;
  previewText: string;
  blocks: EmailBlock[];
}

export function useEmailCampaignBuilder() {
  const navigate = useNavigate();
  const { tenantId } = useEmailMarketing();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<CampaignConfig>({ name: "", type: "broadcast", list_id: "" });
  const [content, setContent] = useState<CampaignContent>({ subject: "", previewText: "", blocks: [] });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const selectedBlock = content.blocks.find(b => b.id === selectedBlockId) || null;

  const addBlock = useCallback((type: EmailBlockType, index?: number) => {
    const block = createBlock(type);
    setContent(prev => {
      const blocks = [...prev.blocks];
      if (index !== undefined) {
        blocks.splice(index, 0, block);
      } else {
        blocks.push(block);
      }
      return { ...prev, blocks };
    });
    setSelectedBlockId(block.id);
  }, []);

  const updateBlock = useCallback((id: string, props: Record<string, any>) => {
    setContent(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === id ? { ...b, props: { ...b.props, ...props } } : b),
    }));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setContent(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== id),
    }));
    setSelectedBlockId(prev => prev === id ? null : prev);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setContent(prev => {
      const idx = prev.blocks.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const original = prev.blocks[idx];
      const copy: EmailBlock = { ...original, id: crypto.randomUUID(), props: { ...original.props } };
      const blocks = [...prev.blocks];
      blocks.splice(idx + 1, 0, copy);
      return { ...prev, blocks };
    });
  }, []);

  const moveBlock = useCallback((fromIndex: number, toIndex: number) => {
    setContent(prev => {
      const blocks = [...prev.blocks];
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      return { ...prev, blocks };
    });
  }, []);

  const reorderBlocks = useCallback((newBlocks: EmailBlock[]) => {
    setContent(prev => ({ ...prev, blocks: newBlocks }));
  }, []);

  const getHtml = useCallback(() => {
    return blocksToHtml(content.blocks, content.previewText);
  }, [content]);

  const getPlainText = useCallback(() => {
    return blocksToPlainText(content.blocks);
  }, [content]);

  const canGoNext = useCallback(() => {
    if (step === 0) return config.name.trim() !== "" && config.list_id !== "";
    if (step === 1) return content.subject.trim() !== "" && content.blocks.length > 0;
    return true;
  }, [step, config, content]);

  const sendCampaign = useCallback(async (scheduledAt?: string) => {
    if (!tenantId) return;
    setIsSending(true);
    try {
      // 1. Create template
      const html = getHtml();
      const text = getPlainText();
      const { data: tpl, error: tplErr } = await supabase
        .from("email_marketing_templates")
        .insert({
          tenant_id: tenantId,
          name: `Campanha: ${config.name}`,
          subject: content.subject,
          body_html: html,
          body_text: text,
        })
        .select("id")
        .single();
      if (tplErr) throw tplErr;

      // 2. Create campaign
      const { data: camp, error: campErr } = await supabase
        .from("email_marketing_campaigns")
        .insert({
          tenant_id: tenantId,
          name: config.name,
          type: config.type,
          list_id: config.list_id,
          template_id: tpl.id,
          status: "draft",
        })
        .select("id")
        .single();
      if (campErr) throw campErr;

      // 3. Trigger broadcast
      const { data: broadcastResult, error: broadcastErr } = await supabase.functions.invoke(
        "email-campaign-broadcast",
        { body: { campaign_id: camp.id, scheduled_at: scheduledAt } }
      );

      if (broadcastErr) throw broadcastErr;
      if (!broadcastResult?.success) throw new Error(broadcastResult?.error || "Erro no envio");

      toast.success(`Campanha enviada! ${broadcastResult.queued} emails na fila.`);
      navigate("/email-marketing");
    } catch (err: any) {
      console.error("Campaign send error:", err);
      toast.error(err.message || "Erro ao enviar campanha");
    } finally {
      setIsSending(false);
    }
  }, [tenantId, config, content, getHtml, getPlainText, navigate]);

  return {
    step, setStep,
    config, setConfig,
    content, setContent,
    selectedBlockId, setSelectedBlockId,
    selectedBlock,
    addBlock, updateBlock, removeBlock, duplicateBlock, moveBlock, reorderBlocks,
    getHtml, getPlainText,
    canGoNext,
    sendCampaign, isSending,
  };
}
