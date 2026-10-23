import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Download, ExternalLink, RotateCcw } from "lucide-react";
import { z } from "zod";
import { AgentPanel, type AgentTool } from "@/components/soleone/agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/ui/sidebar";
import { agentSnapshotSchema, type AgentRequest, type AgentSnapshot } from "./agent-protocol";
import { ChoiceField } from "./ChoiceField";
import type { GameDraft } from "./draft";
import { releaseLabel } from "./model";
import { researchProposalSchema, type ResearchProposal } from "./research";

async function responseJson(response: Response): Promise<unknown> {
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(data);
    throw new Error(parsed.success ? parsed.data.error : "The agent request failed. Try again.");
  }
  return data;
}

export function GameAgent({
  draft,
  prompt,
  onPromptChange,
  disabled,
  onApply,
  onCover,
}: {
  draft: GameDraft | null;
  prompt: string;
  onPromptChange: Dispatch<SetStateAction<string>>;
  disabled: boolean;
  onApply: (proposal: ResearchProposal) => void;
  onCover: (cover: string, proposal: ResearchProposal) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [connection, setConnection] = useState<{
    token: string;
    id: number;
    signal: AbortSignal;
  } | null>(null);
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [pending, setPending] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const [coverNotice, setCoverNotice] = useState("");
  const epoch = useRef(0);
  const retry = useRef<{ text: string; id: string } | null>(null);
  const currentDraftId = useRef(draft?.id ?? null);
  useLayoutEffect(() => {
    currentDraftId.current = draft?.id ?? null;
  }, [draft?.id]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
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
            if (started === epoch.current) setSnapshot(current);
            setConnectionError("");
            if (!controller.signal.aborted) timer = setTimeout(poll, current.busy ? 600 : 2500);
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
        timer = setTimeout(poll, opened.busy ? 600 : 2500);
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

  async function chooseCover(toolId: string, index: number, proposal: ResearchProposal) {
    if (!connection || pending || disabled) return;
    const targetDraftId = draft?.id ?? null;
    setPending(true);
    setError("");
    setCoverNotice("");
    try {
      const result = z
        .object({ cover: z.string().regex(/^\/covers\/[a-zA-Z0-9._-]+\.webp$/) })
        .parse(await execute({ action: "cover", conversationId: connection.id, toolId, index }));
      if (currentDraftId.current !== targetDraftId) {
        setCoverNotice(
          "Cover downloaded, but the game draft changed. Choose Download & use again to apply it to the current draft.",
        );
        return;
      }
      onCover(result.cover, proposal);
      setCoverNotice("Cover downloaded. Review the form, then Save game to keep its reference.");
    } catch (error) {
      if (!connection.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Could not download the cover. Choose another image or retry.",
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
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">{proposal.title}</h3>
          <Badge variant="secondary">{releaseLabel(proposal.release)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{proposal.summary}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={disabled || pending || snapshot?.busy}
            onClick={() => {
              onApply(proposal);
              if (isMobile) setOpenMobile(false);
              if (draft) setApplied((current) => [...current, `${draft.id}:${tool.id}`]);
            }}
          >
            {draft ? "Apply facts to form" : "Open new game draft"}
          </Button>
          <Button
            variant="link"
            size="sm"
            nativeButton={false}
            render={<a href={proposal.source} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" />
            Read source
          </Button>
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          {draft && applied.includes(`${draft.id}:${tool.id}`)
            ? "Facts applied. Review the form, then Save game."
            : draft
              ? "Replaces title, release date, and source only. Your cover, hype, and reviews stay unchanged."
              : "Opens an unsaved game draft. Review it, then Save game."}
        </p>
        {proposal.covers.length > 0 && (
          <ul aria-label="Cover choices" className="flex flex-col gap-3">
            {proposal.covers.map((cover, index) => (
              <li key={cover.url} className="flex flex-wrap items-center justify-between gap-2">
                <a
                  className="min-w-0 text-sm underline underline-offset-4"
                  href={cover.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cover.label}
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || pending || snapshot?.busy}
                  onClick={() => {
                    void chooseCover(tool.id, index, proposal);
                  }}
                >
                  <Download data-icon="inline-start" />
                  Download & use
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
        emptyDescription="Find release information and artwork, then choose what to apply. Nothing is saved automatically."
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
          });
          if (accepted) retry.current = null;
          return accepted;
        }}
        onStop={() => {
          if (connection && !pending)
            void action({ action: "stop", conversationId: connection.id });
        }}
      />
      {coverNotice && (
        <p role="status" className="text-sm text-muted-foreground">
          {coverNotice}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Runs on this computer using your Pi account. Research uses the internet. Downloaded artwork
        keeps its original ownership.
      </p>
    </div>
  );
}
