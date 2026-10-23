import { useState, type ReactNode } from "react";
import { AgentSidebar } from "@/components/soleone/agent";
import Editor from "./Editor";
import { GameAgent } from "./GameAgent";
import { applyResearch, applyDownloadedCover, type GameDraft } from "./draft";
import type { Game } from "./model";
import type { ResearchProposal } from "./research";

export default function Workspace({
  children,
  editor,
  onEdit,
  onClose,
  onSaved,
}: {
  children: ReactNode;
  editor: { id: string | null } | null;
  onEdit: (id: string | null) => void;
  onClose: () => void;
  onSaved: (games: Game[]) => void;
}) {
  const [draft, setDraft] = useState<GameDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [initialResearch, setInitialResearch] = useState<{
    proposal: ResearchProposal;
    cover?: string;
  } | null>(null);

  function startDraft(proposal: ResearchProposal, cover?: string) {
    setInitialResearch({ proposal, cover });
    onEdit(null);
  }
  return (
    <AgentSidebar
      title="Agent"
      agent={
        <GameAgent
          draft={editor ? draft : null}
          disabled={busy}
          prompt={prompt}
          onPromptChange={setPrompt}
          onApply={(proposal) => {
            if (editor && draft) setDraft(applyResearch(draft, proposal));
            else startDraft(proposal);
          }}
          onCover={(cover, proposal) => {
            if (editor && draft)
              setDraft((current) => applyDownloadedCover(current, draft.id, cover));
            else startDraft(proposal, cover);
          }}
        />
      }
    >
      {children}
      {editor && (
        <Editor
          initialId={editor.id}
          draft={draft}
          onDraftChange={setDraft}
          initialResearch={initialResearch}
          onBusyChange={setBusy}
          onSaved={onSaved}
          onClose={() => {
            setDraft(null);
            setInitialResearch(null);
            onClose();
          }}
        />
      )}
    </AgentSidebar>
  );
}
