"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopie(true);
          setTimeout(() => setCopie(false), 1800);
        } catch {
          /* presse-papiers indisponible : rien à faire */
        }
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted hover:text-fg"
    >
      {copie ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      {copie ? "Copié" : label}
    </button>
  );
}
