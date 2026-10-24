# Maintaining the collection

## Run and edit

```sh
vp install
vp run dev
```

Open the local URL (`localhost` or `127.0.0.1`). **Add a game** and each game's pencil button open the development-only editor. Save writes to `src/data/games.json`. Production and `vp run preview` are read-only, with no editor endpoint. Do not expose the development server as a public admin service.

The editor supports titles, local or remote cover URLs, release precision, hype 1–5, play status (Not played, Started, Played, or Completed), a short review, and a score 1–10. Missing ratings stay unrated. A blank cover gets a placeholder. Put replacement cover files in `public/covers/` and enter `/covers/filename.jpg`.

You can also edit JSON directly. A stale editor session refuses to overwrite newer file contents. Close and reopen it to load those changes. The file is validated before saving and writes use a temporary file followed by rename. Keep the file in Git for history and recovery. This is a single-person local editor, not multi-user storage; unrelated external writers must not edit the file during the instant of an active save.

## Research with the local agent

Use Node 24 (pi-durable requires at least Node 22.19), sign in through Pi, and choose a default
model there. Start the app normally and use the persistent **Agent** button. Its right-hand dock
has its own transcript scrolling and minimizes back to one button; mobile uses a side sheet.
For example: “add control resonant.” The agent can research before any editor is open.
You can also paste an official announcement or store URL.

The server reuses Pi's `auth.json` and the default provider/model in `settings.json`, normally under
`~/.pi/agent/`. `PI_CODING_AGENT_DIR` changes that directory. OAuth refresh uses the same file-lock
convention as Pi, preserving other providers. Credential commands beginning with `!` are deliberately
not executed. The Pi SDK loads compatible custom models from `models.json`, but never loads Pi's
extensions, tools, or resources. Extension-only or unauthenticated scoped models are shown as unavailable.
Optional `.env.local` settings are shown in `.env.example`:

- `GAME_AGENT_MODEL=provider/model-id` overrides the Pi default without changing Pi settings.
- `GAME_AGENT_STORAGE=/absolute/path.sqlite` overrides conversation storage. The default is a
  project-specific file under `$DATA/apps/gaming-agent/`, or `~/data/apps/gaming-agent/`.

Search uses the pinned `pi-web-access` engine, not scraped search-engine HTML or RSS. It reads Pi's
`web-search.json` using that package's normal config-path rules and honors its configured provider,
provider allowlist, and ordered routes. Explicit Exa selection works through its hosted MCP endpoint
without a key; configured Exa keys use its direct API. With no search provider, route, or Exa key,
it defaults to OpenAI's hosted `web_search` through the existing Pi login (or configured OpenAI API key).
Only host-neutral search is loaded, through Jiti because the package ships that API as TypeScript;
its extension entry point, curator, local-file fetch tools, and general Pi tools are not registered.
Command-based search credentials are refused. Restart the dev server after changing search config.
When Exa is selected on its own, quota, empty-response, network, temporary, or unsupported failures
fall back directly to OpenAI hosted search using the existing server-side Pi credentials. Successful
results identify the provider actually used. Explicit provider lists and ordered Pi routes retain their
own behavior, and Pi's provider allowlist still applies. Search never changes Pi's settings.
Temporary OpenAI failures (or temporary failures on other configured routes) get at most one retry.
All attempts share the original 60-second timeout and cancellation signal. Authentication, quota, and
other permanent failures are not retried on the same provider. Errors identify the provider and failure
category without exposing raw provider responses or assuming Pi login failed.
Keyless Exa has free-tier rate limits. The pinned dependency patch in
`patches/pi-web-access@0.41.0.patch` recognizes its HTTP 200 rate-limit notice instead of silently
turning it into “no results.” The app can then fall back to OpenAI without retrying the limited Exa
endpoint. If OpenAI is unavailable too, wait for the limit to reset, configure `exaApiKey`, or explicitly
choose another search provider/route in Pi.
If results are genuinely empty, broaden the game title or paste an official announcement/store URL.

Search returns bounded source links and a provider-labelled summary, which must be verified against
original pages. Page reads include announcement/navigation links so the agent can follow them directly.
Research is limited to 30 tool calls per message, shared by every game the message asks about; each game gets its own proposal card.
It preserves uncertain dates and never supplies your hype, played status, review, or score.
Check platform/region and source quality before accepting a proposal.

**Model** lists Pi's `enabledModels` scope, not the provider catalog. With no scope, only the saved
Pi default is offered. **Effort** lists supported thinking levels and marks the Pi default: scope
suffix first, then `modelThinkingLevels`, then `defaultThinkingLevel`, clamped to the model's limits.
Changing model resets effort to that model's Pi default; either choice persists in this local conversation.
Controls are locked during a run. Pi's settings are never modified. Restart the dev server to reload changed Pi configuration.

A proposal previews its cover candidates as tiles, loaded straight from the source page's host
without a referrer, next to the current cover when the game has one. Nothing is downloaded while
previewing. The primary button saves in one step: it downloads the selected candidate into
`public/covers/`, merges title, release, source, and cover into the matching game, and writes
`src/data/games.json`. The match is the collection game with the same title (ignoring case, accents,
punctuation, and ™/®/©), else the open draft if it is that game or still unsaved, else a new game.
The button reads **Update <title>** or **Add to collection** so you know which before clicking. The
agent also sees the collection's titles and reuses the exact existing title for a known game.
Hype, played status, and reviews are never changed. **Review in form** applies the same facts and
cover to the open draft, or opens the matching (or a new) game in the editor, for edits before **Save game**.

Downloads accept bounded JPEG/PNG/WebP still images at least 600px wide, re-encode to WebP, strip metadata, and use
content-derived filenames without overwriting existing files. Late downloads never apply to a
different or closed draft. After every save, `agent-*.webp` covers that no saved game references
(and the open draft does not hold) are deleted; seed artwork is never touched.

Both save paths share the schema, revision check, and atomic write. Review `git diff` and any added artwork, then rebuild and redeploy.
Artwork ownership remains with its original owner; downloading it does not grant redistribution rights.

Conversations persist locally in SQLite, not in the deployed collection. Hiding or closing the panel
does not stop a running request. **Stop** cancels it; reopening reconnects to the app-wide conversation.
The current draft is explicitly included with each request, or marked absent; switching games does
not reset chat history. Unsent prompt text survives minimization. **New conversation** clears the
active chat context, not the game form or model selection. Restarting the server resumes pending
work when the local runtime next opens. Do not run multiple processes against
the same conversation database; a file lock refuses a second owner.

### Agent security and reuse

The middleware is development-only and loopback-only. Conversation reads require an unguessable
per-server token; mutations also require matching Origin and JSON content type. Source-page and cover fetches
reject local/private/reserved addresses, pin the resolved public IP, and revalidate redirects.
Search API calls use the operator-configured pi-web-access provider transport, not model-supplied endpoints.
Bodies, timeouts, images, and tool counts are bounded. The model gets only `search_web`, `read_page`,
and `propose_game`, never shell access or collection-writing tools. Proposal sources and cover URLs
must have been observed through page-reading tools. Cover writes require a separate browser action
against a completed proposal, not an arbitrary path or URL supplied by a request.

The reusable UI is `@soleone/agent` from the sibling shadcn registry. `src/games/GameAgent.tsx` owns
this app's transport and results; `dev/agent/` owns Pi authentication, persistence, and game tools.
For another app, reuse the UI and supply that app's tools. There is intentionally no shared daemon
or general-purpose agent framework yet.

When developing the new registry item before publishing it, serve `../shadcn-components` locally
and temporarily point `@soleone` in `components.json` at its `/r/{name}.json` endpoint. `kit check`
compares against the configured registry. Publish the registry's new `public/r/agent.json` before
using the normal GitHub URL for a clean upstream check in Gaming.

## Date model

`release` uses one of these shapes:

```json
{ "precision": "day", "year": 2026, "month": 11, "day": 19 }
{ "precision": "month", "year": 2026, "month": 11 }
{ "precision": "quarter", "year": 2007, "quarter": 2 }
{ "precision": "year", "year": 2026 }
{ "precision": "unknown", "year": 2026 }
{ "precision": "unknown", "year": null }
```

Unknown with an expected year belongs to that year. A null year belongs to Unscheduled. Month filtering only matches known months, not inferred quarters. Dates are calendar values, not timezone-dependent timestamps.

`play` is `not_played`, `started`, `played`, or `completed`. `review: null` means not played; every other status has `{ "text": "…", "score": 8 }`, where text may be empty and score may be null. Setting a game back to `not_played` clears its review on save.

Production embeds the collection at build time. After editing, rebuild and redeploy to publish it:

```sh
vp check
vp test
kit check
vp run build
```

## Link previews

Crawlers that unfurl a pasted link don't run the app, so `build/share-pages.ts` writes the preview tags into the built pages. The calendar gets site-wide tags and an image cropped from `docs/media/hero.png` (re-record it with `vp run media:capture`). Each game whose review opens also gets `dist/games/<title>/index.html` with its own tags and a 1200x630 `dist/share/<title>.jpg` made from its cover. Remote covers are used as they are, so the build stays offline. Spoilers never appear in a description. The site address is `SITE_URL` in that file; change it if the domain moves. After deploying, check a link with the platform's debugger (Facebook Sharing Debugger, LinkedIn Post Inspector) since they cache previews.

## Local editor boundary

The Vite plugin lives in `dev/game-editor.ts`; it only registers development middleware, never preview middleware. Requests must come from loopback sockets with a localhost/loopback Host header. Writes also require the matching Origin and an unguessable per-server token obtained by the same-origin editor. The endpoint cannot select filesystem paths and limits bodies to 256 KB. This protects local editing from unrelated web pages; it is not account authentication or a substitute for keeping the dev server local.
