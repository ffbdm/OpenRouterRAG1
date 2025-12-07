import { InstructionsPanel } from "@/components/InstructionsPanel";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function InstructionsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">System</p>
        </div>
        <h1 className="text-4xl font-display font-bold text-foreground">Instructions Center</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Manage the global prompts that drive the AI's behavior across the Chat and Catalog modules.
        </p>
      </header>

      <div className="glass-card p-6 rounded-2xl border-l-4 border-l-primary/50">
        <p className="text-sm leading-relaxed text-muted-foreground/90">
          <strong className="text-foreground">Note:</strong> Updates made here reflect immediately. Ensure your instructions are clear and in the target language (Portuguese) to maintain consistency.
        </p>
      </div>

      <div className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <InstructionsPanel
          scopes={["chat"]}
          title="Chat Prompts"
          description="Control how the AI behaves during conversations. Define the persona, tone, and constraints."
        />
      </div>
    </div>
  );
}
