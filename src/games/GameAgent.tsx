import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ExternalLink, ImageOff, PenLine, RotateCcw, Save } from "lucide-react";
import { z } from "zod";
import { AgentPanel, type AgentTool } from "@/components/soleone/agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSidebar } from "@/components/ui/sidebar";
import { CoverChoice, CoverChoices } from "@/components/variants/CoverChoice";
import { agentSnapshotSchema, type AgentRequest, type AgentSnapshot } from "./agent-protocol";
import { ChoiceField } from "./ChoiceField";
import { researchTarget } from "./collection";
import type { GameDraft } from "./draft";
import { releaseLabel, type Game } from "./model";
import { researchProposalSchema, type ResearchProposal } from "./research";

async function responseJson(response: Response): Promise<unknown> {
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(data);
    throw new Error(parsed.success ? parsed.data.error : "The agent request failed. Try again.");
  }
  return data;
}

function CoverPreview({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      {failed ? (
        <span className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ImageOff aria-label="Preview unavailable" />
        </span>
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-video w-full rounded-md bg-muted object-cover"
          onError={() => setFailed(true)}
        />
      )}
      <span className="truncate">{label}</span>
    </>
  );
}

// Selecting "current" (or nothing) leaves the game's cover as it is.
export function ProposalCard({
  proposal,
  current,
  action,
  description,
  note,
  locked,
  onSave,
  onEdit,
}: {
  proposal: ResearchProposal;
  current: string | null;
  action: string;
  description: string;
  note: string | undefined;
  locked: boolean;
  onSave: (cover: number | null) => void;
  onEdit: (cover: number | null) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    current ? ["current"] : proposal.covers.length ? ["0"] : [],
  );
  const cover = selected[0] === undefined || selected[0] === "current" ? null : Number(selected[0]);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{proposal.title}</CardTitle>
        <CardDescription>{proposal.summary}</CardDescription>
        <CardAction>
          <Badge variant="secondary">{releaseLabel(proposal.release)}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {proposal.covers.length > 0 && (
            <CoverChoices
              aria-label="Cover"
              value={selected}
              onValueChange={setSelected}
              disabled={locked}
            >
              {current && (
                <CoverChoice value="current">
                  <CoverPreview src={current} label="Current cover" />
                </CoverChoice>
              )}
              {proposal.covers.map((candidate, index) => (
                <CoverChoice key={candidate.url} value={String(index)}>
                  <CoverPreview src={candidate.url} label={candidate.label} />
                </CoverChoice>
              ))}
            </CoverChoices>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={locked} onClick={() => onSave(cover)}>
              <Save data-icon="inline-start" />
              {action}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => onEdit(cover)}
            >
              <PenLine data-icon="inline-start" />
              Review in form
            </Button>
            <Button
              variant="link"
              size="sm"
              nativeButton={false}
              render={<a href={proposal.source} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink data-icon="inline-start" />
              Source
            </Button>
          </div>
          <p role="status" className="text-xs text-muted-foreground">
            {note ?? description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function GameAgent({
  draft,
  games,
  prompt,
  onPromptChange,
  disabled,
  onSave,
  onEdit,
}: {
  draft: GameDraft | null;
  games: Game[];
  prompt: string;
  onPromptChange: Dispatch<SetStateAction<string>>;
  disabled: boolean;
  onSave: (proposal: ResearchProposal, cover?: string) => Promise<void>;
  onEdit: (
    proposal: ResearchProposal,
    cover: string | undefined,
    draftId: string | null,
  ) => boolean;
}) {
  const { isMobile, open: dockOpen, openMobile, setOpenMobile } = useSidebar();
  const visible = isMobile ? openMobile : dockOpen;
  const [connection, setConnection] = useState<{
    token: string;
    id: number;
    signal: AbortSignal;
  } | null>(null);
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const epoch = useRef(0);
  const retry = useRef<{ text: string; id: string } | null>(null);
  // Polling pauses while nobody can see the dock and no work is running.
  const watching = useRef(visible);
  const resume = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    watching.current = visible;
    if (visible && document.visibilityState === "visible") resume.current?.();
  }, [visible]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      if (watching.current && document.visibilityState === "visible") resume.current?.();
    };
    document.addEventListener("visibilitychange", wake);
    async function open() {
      try {
        const session = z
          .object({ token: z.string() })
          .parse(await responseJson(await fetch("/__dev/agent", { signal: controller.signal })));
        const opened = agentSnapshotSchema.parse(
          await responseJson(
            await fetch("/__dev/agent", {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json", "X-Gaming-Agent": session.token },
              body: JSON.stringify({ action: "open", key: "collection" }),
            }),
          ),
        );
        setConnection({
          token: session.token,
          id: opened.conversationId,
          signal: controller.signal,
        });
        setSnapshot(opened);
        function schedule(busy: boolean) {
          if (controller.signal.aborted) return;
          const seen = watching.current && document.visibilityState === "visible";
          if (busy || seen) timer = setTimeout(poll, busy && seen ? 600 : 2500);
          else
            resume.current = () => {
              resume.current = null;
              void poll();
            };
        }
        async function poll() {
          const started = epoch.current;
          try {
            const current = agentSnapshotSchema.parse(
              await responseJson(
                await fetch(`/__dev/agent?conversationId=${opened.conversationId}`, {
                  headers: { "X-Gaming-Agent": session.token },
                  signal: controller.signal,
                }),
              ),
            );
            // Keep the previous object when nothing changed so an idle poll renders nothing.
            const serialized = JSON.stringify(current);
            if (started === epoch.current)
              setSnapshot((previous) =>
                JSON.stringify(previous) === serialized ? previous : current,
              );
            setConnectionError("");
            schedule(current.busy);
          } catch (error) {
            if (!controller.signal.aborted) {
              setConnectionError(
                error instanceof Error
                  ? error.message
                  : "Connection lost. Reopen the agent to retry.",
              );
              timer = setTimeout(poll, 5000);
            }
          }
        }
        schedule(opened.busy);
      } catch (error) {
        if (!controller.signal.aborted)
          setConnectionError(
            error instanceof Error
              ? error.message
              : "Could not open the agent. Close and reopen it to retry.",
          );
      }
    }
    void open();
    return () => {
      controller.abort();
      clearTimeout(timer);
      resume.current = null;
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  async function execute(request: AgentRequest) {
    if (!connection) throw new Error("The agent is still connecting. Reopen it if this persists.");
    epoch.current++;
    const result = await responseJson(
      await fetch("/__dev/agent", {
        method: "POST",
        signal: connection.signal,
        headers: { "Content-Type": "application/json", "X-Gaming-Agent": connection.token },
        body: JSON.stringify(request),
      }),
    );
    // Polls started during admission must not overwrite the completed action either.
    epoch.current++;
    return result;
  }

  async function action(request: AgentRequest) {
    setPending(true);
    setError("");
    try {
      setSnapshot(agentSnapshotSchema.parse(await execute(request)));
      return true;
    } catch (error) {
      if (!connection?.signal.aborted)
        setError(error instanceof Error ? error.message : "The agent request failed. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  // Covers download only once a proposal is saved or opened, never while previewing.
  async function download(toolId: string, index: number | null) {
    if (index === null || !connection) return undefined;
    return z
      .object({ cover: z.string().regex(/^\/covers\/[a-zA-Z0-9._-]+\.webp$/) })
      .parse(await execute({ action: "cover", conversationId: connection.id, toolId, index }))
      .cover;
  }

  async function run(toolId: string, work: () => Promise<string>) {
    if (!connection || pending || disabled) return;
    setPending(true);
    setError("");
    try {
      const note = await work();
      setNotes((current) => ({ ...current, [toolId]: note }));
    } catch (error) {
      if (!connection.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Could not save the proposal. Try again.",
        );
    } finally {
      setPending(false);
    }
  }

  function renderProposal(tool: AgentTool) {
    if (tool.name !== "propose_game" || tool.status !== "complete") return undefined;
    const parsed = researchProposalSchema.safeParse(
      tool.data && typeof tool.data === "object" && "proposal" in tool.data
        ? tool.data.proposal
        : undefined,
    );
    if (!parsed.success) return undefined;
    const proposal = parsed.data;
    const target = researchTarget(games, proposal.title, draft);
    const existing =
      target.kind === "game"
        ? target.game
        : target.kind === "draft"
          ? games.find((game) => game.id === draft?.id)
          : undefined;
    return (
      <ProposalCard
        key={tool.id}
        proposal={proposal}
        current={
          (target.kind === "draft"
            ? draft?.cover
            : target.kind === "game"
              ? target.game.cover
              : null) || null
        }
        action={existing ? `Update ${existing.title}` : "Add to collection"}
        description={
          target.kind === "draft"
            ? "Saves the open form with these facts and the chosen cover."
            : existing
              ? "Updates title, release, source, and the chosen cover. Hype and reviews stay."
              : "Adds a new game with the chosen cover. Rate it later in the editor."
        }
        note={notes[tool.id]}
        locked={disabled || pending || Boolean(snapshot?.busy)}
        onSave={(index) =>
          void run(tool.id, async () => {
            await onSave(proposal, await download(tool.id, index));
            return "Saved to games.json.";
          })
        }
        onEdit={(index) => {
          const draftId = draft?.id ?? null;
          void run(tool.id, async () => {
            if (!onEdit(proposal, await download(tool.id, index), draftId))
              return "The open game changed while the cover downloaded. Choose Review in form again.";
            if (isMobile) setOpenMobile(false);
            return "Opened in the form. Review it, then Save game.";
          });
        }}
      />
    );
  }

  const choice = snapshot?.models.find((model) => model.id === snapshot.model);
  const locked = !connection || disabled || pending || Boolean(snapshot?.busy);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all text-xs text-muted-foreground">
          {snapshot
            ? draft
              ? `Editing ${draft.title || "new game"}`
              : "No game draft open"
            : connectionError
              ? "Local agent unavailable"
              : "Connecting to Pi…"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!connection || pending || snapshot?.busy || disabled}
          onClick={() => {
            if (
              connection &&
              window.confirm("Start a new conversation? This does not change the game form.")
            ) {
              void action({ action: "reset", conversationId: connection.id });
            }
          }}
        >
          <RotateCcw data-icon="inline-start" />
          New conversation
        </Button>
      </div>
      {snapshot && choice && (
        <div className="grid min-w-0 grid-cols-1 gap-3">
          <ChoiceField
            id="agent-model"
            label="Model"
            value={snapshot.model}
            disabled={locked}
            options={[
              ...snapshot.models.map((model) => ({
                value: model.id,
                label: `${model.name} · ${model.id.split("/")[0]}`,
              })),
              ...snapshot.unavailableModels.map((id) => ({
                value: `unavailable:${id}`,
                label: `${id} (unavailable)`,
                disabled: true,
              })),
            ]}
            onChange={(model) => {
              const selected = snapshot.models.find((candidate) => candidate.id === model);
              if (connection && selected)
                void action({
                  action: "configure",
                  conversationId: connection.id,
                  model,
                  thinkingLevel: selected.defaultThinking,
                });
            }}
          />
          {snapshot.unavailableModels.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Unavailable models need a Pi login or a provider extension.
            </p>
          )}
          <ChoiceField
            id="agent-effort"
            label="Effort"
            value={snapshot.thinkingLevel}
            disabled={locked}
            options={choice.thinkingLevels.map((level) => ({
              value: level,
              label: `${level}${level === choice.defaultThinking ? " (Pi default)" : ""}`,
            }))}
            onChange={(level) => {
              const thinkingLevel = choice.thinkingLevels.find((candidate) => candidate === level);
              if (connection && thinkingLevel)
                void action({
                  action: "configure",
                  conversationId: connection.id,
                  model: snapshot.model,
                  thinkingLevel,
                });
            }}
          />
        </div>
      )}
      <AgentPanel
        messages={snapshot?.messages ?? []}
        prompt={prompt}
        onPromptChange={onPromptChange}
        busy={Boolean(snapshot?.busy || pending)}
        disabled={!connection || disabled || pending}
        error={error || connectionError || snapshot?.error}
        emptyTitle="Research games"
        emptyDescription="Find release information and artwork, then save it to your collection in one step."
        placeholder={
          draft?.title
            ? `Find release information and a cover for ${draft.title}`
            : "Which game would you like to add?"
        }
        renderTool={renderProposal}
        onSend={async (text) => {
          if (!connection || pending || disabled) return false;
          if (retry.current?.text !== text) retry.current = { text, id: crypto.randomUUID() };
          const accepted = await action({
            action: "send",
            conversationId: connection.id,
            requestId: retry.current.id,
            text,
            draft: draft
              ? {
                  title: draft.title,
                  release: `${draft.precision}: ${draft.year}/${draft.month}/${draft.day}; quarter ${draft.quarter}`,
                  source: draft.source,
                }
              : null,
            collection: games.map((game) => game.title),
          });
          if (accepted) retry.current = null;
          return accepted;
        }}
        onStop={() => {
          if (connection && !pending)
            void action({ action: "stop", conversationId: connection.id });
        }}
      />
      <p className="text-xs text-muted-foreground">
        Runs on this computer using your Pi account. Research uses the internet. Downloaded artwork
        keeps its original ownership.
      </p>
    </div>
  );
}
