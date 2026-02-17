// =============================================
// SHARED CHAT MESSAGE BUBBLE — Modern v2
// Inspired by ChatGPT / Claude / Gemini
// =============================================

import { Bot, User, Sparkles, Wrench, FileText, Image as ImageIcon, Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export interface ChatAttachment {
  url: string;
  filename: string;
  mimeType: string;
}

interface ChatMessageBubbleProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  avatarIcon?: "bot" | "sparkles" | "user" | "tool";
  avatarLabel?: string;
  avatarClassName?: string;
  attachments?: ChatAttachment[];
  modeIndicator?: React.ReactNode;
  actions?: React.ReactNode;
  timestamp?: string;
}

const PROSE_CLASSES = cn(
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-semibold prose-headings:tracking-tight",
  "prose-h1:text-base prose-h2:text-sm prose-h3:text-xs",
  "prose-p:my-1.5 prose-p:leading-relaxed prose-p:text-[13px]",
  "prose-ul:my-1.5 prose-ul:list-disc prose-ul:pl-4 prose-ul:space-y-0.5",
  "prose-ol:my-1.5 prose-ol:list-decimal prose-ol:pl-4 prose-ol:space-y-0.5",
  "prose-li:my-0 prose-li:leading-relaxed prose-li:text-[13px]",
  "prose-strong:font-semibold prose-strong:text-foreground",
  "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-muted prose-pre:rounded-xl prose-pre:border prose-pre:p-3",
  "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
  "prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
  "prose-hr:my-3 prose-hr:border-border/50",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "prose-table:text-xs prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:px-3 prose-td:py-1.5 prose-td:border-border",
);

const AVATAR_ICONS = {
  bot: Bot,
  sparkles: Sparkles,
  user: User,
  tool: Wrench,
};

export function ChatMessageBubble({
  role,
  content,
  avatarIcon = role === "user" ? "user" : role === "tool" ? "tool" : "bot",
  avatarLabel,
  avatarClassName,
  attachments,
  modeIndicator,
  actions,
  timestamp,
}: ChatMessageBubbleProps) {
  const isUser = role === "user";
  const isTool = role === "tool";
  const AvatarIcon = AVATAR_ICONS[avatarIcon];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-1 max-w-[85%]">
          {modeIndicator}
          <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-[13px] leading-relaxed">
            <p className="whitespace-pre-wrap">{content}</p>
            {attachments && attachments.length > 0 && (
              <div className={cn("flex flex-wrap gap-2", content && "mt-2")}>
                {attachments.map((att, idx) => (
                  <AttachmentChip key={idx} attachment={att} isUser />
                ))}
              </div>
            )}
          </div>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground/50 px-1">{timestamp}</span>
          )}
        </div>
      </div>
    );
  }

  // Assistant & Tool — ChatGPT-like left-aligned, no bubble background
  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium mt-0.5",
          isTool
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20"
            : avatarClassName || "bg-primary/10 text-primary ring-1 ring-primary/20"
        )}
      >
        {avatarLabel ? (
          <span>{avatarLabel}</span>
        ) : (
          <AvatarIcon className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 min-w-0 max-w-[92%] pt-0.5">
        {modeIndicator}

        {isTool ? (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3.5 py-2 text-[13px]">
            {content && (
              <div className={PROSE_CLASSES}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          <>
            {content && (
              <div className={cn(PROSE_CLASSES, "text-foreground")}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}
          </>
        )}

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {attachments.map((att, idx) => (
              <AttachmentChip key={idx} attachment={att} isUser={false} />
            ))}
          </div>
        )}

        {/* Actions (proposed actions, buttons, etc.) */}
        {actions}

        {/* Timestamp */}
        {timestamp && (
          <span className="text-[10px] text-muted-foreground/50 px-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({ attachment, isUser }: { attachment: ChatAttachment; isUser: boolean }) {
  const isImage = attachment.mimeType?.startsWith("image/");
  const isAudio = attachment.mimeType?.startsWith("audio/");

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="max-h-48 max-w-full rounded-xl border object-cover hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  if (isAudio) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl border">
        <Mic className="h-3.5 w-3.5 text-muted-foreground" />
        <audio controls className="h-8 max-w-[200px]">
          <source src={attachment.url} type={attachment.mimeType} />
        </audio>
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-colors",
        isUser
          ? "bg-primary-foreground/15 hover:bg-primary-foreground/25"
          : "bg-muted hover:bg-muted/80 border"
      )}
    >
      <FileText className="h-3 w-3" />
      <span className="max-w-[120px] truncate">{attachment.filename}</span>
    </a>
  );
}
