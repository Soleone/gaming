import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "react-router";
import { AgentSidebar } from "@/components/soleone/agent";
import Editor from "./Editor";
import { GameAgent } from "./GameAgent";
import {
  findGame,
  loadCollection,
  researchTarget,
  saveCollection,
  upsertGame,
  type CollectionSession,
} from "./collection";
import {
  applyLateResearch,
  applyResearch,
  createGameDraft,
  parseGameDraft,
  type GameDraft,
} from "./draft";
import type { Game } from "./model";
import type { ResearchProposal } from "./research";

const draftFor = (games: Game[], id: string | null) =>
  createGameDraft(games.find((game) => game.id === id) ?? null);
const isDirty = (draft: GameDraft | null, base: GameDraft | null) =>
  Boolean(draft && base && JSON.stringify(draft) !== JSON.stringify(base));

export default function Workspace({
  children,
  games,
  editor,
  onEdit,
  onClose,
  onSaved,
}: {
  children: ReactNode;
  games: Game[];
  editor: { id: string | null } | null;
  onEdit: (id: string | null, replace?: boolean) => void;
  onClose: () => void;
  onSaved: (games: Game[]) => void;
}) {
  const [session, setSession] = useState<CollectionSession | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<GameDraft | null>(null);
  const [base, setBase] = useState<GameDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  // Research opened from the agent prepares the draft once the editor has loaded games.json.
  const seed = useRef<((draft: GameDraft) => GameDraft) | null>(null);
  const latest = useRef({ draft, base });
  useLayoutEffect(() => {
    latest.current = { draft, base };
  }, [draft, base]);

  // Closing the editor, by any route, drops the draft so the agent no longer sees an open game.
  const [wasOpen, setWasOpen] = useState(Boolean(editor));
  if (wasOpen !== Boolean(editor)) {
    setWasOpen(Boolean(editor));
    if (!editor) {
      setDraft(null);
      setBase(null);
    }
  }

  // Shows a saved game and points the URL at it; the draft is clean before the navigation is checked.
  function show(games: Game[], id: string | null) {
    const next = draftFor(games, id);
    latest.current = { draft: next, base: next };
    setBase(next);
    setDraft(next);
    onEdit(id, true);
  }

  const blocker = useBlocker(
    () => Boolean(editor) && isDirty(latest.current.draft, latest.current.base),
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Discard your unsaved game changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!editor) return;
    const controller = new AbortController();
    const prepare = seed.current;
    loadCollection(controller.signal)
      .then((loaded) => {
        seed.current = null;
        setLoadError("");
        const next = draftFor(loaded.games, editor.id);
        setSession(loaded);
        setBase(next);
        setDraft(prepare ? prepare(next) : next);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : "Could not load games.json.");
      });
    return () => controller.abort();
  }, [editor]);

  async function persist(current: CollectionSession, games: Game[], keepCover?: string) {
    setBusy(true);
    try {
      const saved = await saveCollection(current, games, keepCover);
      setSession(saved);
      onSaved(saved.games);
      return saved;
    } finally {
      setBusy(false);
    }
  }

  // Saves a proposal straight to games.json, merging into its existing entry when there is one.
  async function saveResearch(proposal: ResearchProposal, cover?: string) {
    const current = await loadCollection();
    const { draft: open, base: openBase } = latest.current;
    const target = researchTarget(current.games, proposal.title, open);
    const parsed = parseGameDraft(
      applyResearch(
        target.kind === "draft" && open
          ? open
          : createGameDraft(target.kind === "game" ? target.game : null),
        proposal,
        cover,
      ),
    );
    if (!parsed.success)
      throw new Error(
        `Could not save this proposal: ${parsed.error.issues.map((issue) => issue.message).join(" ")}`,
      );
    const saved = await persist(
      current,
      upsertGame(current.games, parsed.data),
      target.kind === "draft" ? undefined : open?.cover || undefined,
    );
    // An open editor follows the saved game unless it holds unsaved edits to another one.
    if (latest.current.draft && (target.kind === "draft" || !isDirty(open, openBase)))
      show(saved.games, parsed.data.id);
  }

  function editResearch(
    proposal: ResearchProposal,
    cover: string | undefined,
    draftId: string | null,
  ) {
    const open = latest.current.draft;
    if ((open?.id ?? null) !== draftId) return false;
    if (open) setDraft((current) => applyLateResearch(current, open.id, proposal, cover));
    else {
      seed.current = (next) => applyResearch(next, proposal, cover);
      onEdit(findGame(session?.games ?? games, proposal.title)?.id ?? null);
    }
    return true;
  }

  return (
    <AgentSidebar
      title="Agent"
      agent={
        <GameAgent
          draft={draft}
          games={session?.games ?? games}
          disabled={busy}
          prompt={prompt}
          onPromptChange={setPrompt}
          onSave={saveResearch}
          onEdit={editResearch}
        />
      }
    >
      {children}
      {editor && (
        <Editor
          session={session}
          draft={draft}
          dirty={isDirty(draft, base)}
          loadError={loadError}
          busy={busy}
          onChange={setDraft}
          onSave={async (game) => {
            if (!session) return;
            show((await persist(session, upsertGame(session.games, game))).games, game.id);
          }}
          onDelete={async (id) => {
            if (!session) return;
            show(
              (
                await persist(
                  session,
                  session.games.filter((game) => game.id !== id),
                )
              ).games,
              null,
            );
          }}
          onClose={onClose}
        />
      )}
    </AgentSidebar>
  );
}
