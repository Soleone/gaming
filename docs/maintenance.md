# Maintaining the collection

## Run and edit

```sh
vp install
vp run dev
```

Open the local URL (`localhost` or `127.0.0.1`). **Edit collection**, **Add a game**, and each game's pencil button open the development-only editor. Save writes to `src/data/games.json`. Production and `vp run preview` are read-only, with no editor endpoint. Do not expose the development server as a public admin service.

The editor supports titles, local or remote cover URLs, release precision, a source link, hype 1–5, played status, a short review, and a score 1–10. Missing ratings stay unrated. A blank cover gets a placeholder. Put replacement cover files in `public/covers/` and enter `/covers/filename.jpg`.

You can also edit JSON directly. A stale editor session refuses to overwrite newer file contents. Close and reopen it to load those changes. The file is validated before saving and writes use a temporary file followed by rename. Keep the file in Git for history and recovery. This is a single-person local editor, not multi-user storage; unrelated external writers must not edit the file during the instant of an active save.

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

`review: null` means not played. A played game has `{ "text": "…", "score": 8 }`; text may be empty and score may be null. Setting a game back to not played clears its review on save.

Production embeds the collection at build time. After editing, rebuild and redeploy to publish it:

```sh
vp check
vp test
kit check
vp run build
```

## Local editor boundary

The Vite plugin lives in `dev/game-editor.ts`; it only registers development middleware, never preview middleware. Requests must come from loopback sockets with a localhost/loopback Host header. Writes also require the matching Origin and an unguessable per-server token obtained by the same-origin editor. The endpoint cannot select filesystem paths and limits bodies to 256 KB. This protects local editing from unrelated web pages; it is not account authentication or a substitute for keeping the dev server local.
