import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Gamepad2, Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { ChoiceField } from "@/games/ChoiceField";
import { GameCard } from "@/games/GameCard";
import { useGameSelection } from "@/games/useGameSelection";
import { calendarPath, editPath, parseRoute, type Route } from "@/games/routes";
import { calendarSections, gamesSchema, isPlayed, MONTHS, type Game } from "@/games/model";
import gameData from "@/data/games.json";

const ThemePicker = lazy(() =>
  import("@/components/soleone/theme-picker").then((module) => ({ default: module.ThemePicker })),
);
const initialGames = gamesSchema.parse(gameData);
const DevWorkspace = import.meta.env.DEV ? lazy(() => import("./games/Workspace")) : null;
const currentYear = new Date().getFullYear();
const initialYear = initialGames.some((game) => game.release.year === currentYear)
  ? currentYear
  : (initialGames.find((game) => game.release.year !== null)?.release.year ?? currentYear);

export function App() {
  const route = parseRoute(useLocation().pathname);
  if (!route || (route.view === "edit" && !DevWorkspace)) return <Navigate to="/" replace />;
  return <Games route={route} />;
}

function Games({ route }: { route: Route }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const calendarHere = route.view === "calendar";
  const lastCalendar = useRef("/");
  useEffect(() => {
    if (calendarHere) lastCalendar.current = pathname;
  }, [calendarHere, pathname]);
  const [saved, setSaved] = useState<{ base: Game[]; games: Game[] } | null>(null);
  const games = saved?.base === initialGames ? saved.games : initialGames;
  const setGames = (next: Game[]) => setSaved({ base: initialGames, games: next });
  const year = (route.view === "calendar" && route.year) || String(initialYear);
  const month = route.view === "calendar" ? route.month : "all";
  const editId = route.view === "edit" ? route.id : undefined;
  const editor = useMemo(() => (editId === undefined ? null : { id: editId }), [editId]);
  const openEditor = (id: string | null, replace = false) =>
    void navigate(editPath(id), { replace });
  const setMonth = (next: string) => void navigate(calendarPath(year, next));
  const years = [
    ...new Set([
      currentYear,
      currentYear + 1,
      ...games.flatMap((game) => (game.release.year === null ? [] : [game.release.year])),
      ...(year === "unscheduled" ? [] : [Number(year)]),
    ]),
  ].sort((a, b) => a - b);
  const sections = calendarSections(games, year, month);
  const selectedGames = games.filter((game) => String(game.release.year ?? "unscheduled") === year);
  const count = sections.reduce((total, section) => total + section.games.length, 0);
  const editGame = DevWorkspace ? (id: string) => openEditor(id) : undefined;
  const selectedId = useGameSelection(
    sections.flatMap((section) => section.games.map((game) => game.id)),
    Boolean(editGame) && !editor,
    (id) => openEditor(id),
  );
  const changeYear = (next: string) => void navigate(calendarPath(next));
  const content = (
    <div className={editor ? undefined : "min-h-svh"}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-heading text-lg font-semibold tracking-tight"
            aria-label="Soleone Gaming home"
          >
            <Gamepad2 className="size-5 text-primary" aria-hidden="true" />
            Soleone Gaming
            <span className="hidden text-sm font-normal tracking-normal text-muted-foreground sm:inline">
              / What I'm excited about
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Suspense
              fallback={
                <Button variant="ghost" size="icon" disabled aria-label="Loading themes">
                  <Palette />
                </Button>
              }
            >
              <ThemePicker />
            </Suspense>
          </div>
        </div>
      </header>
      <main
        hidden={Boolean(editor)}
        className="mx-auto max-w-6xl px-5 pt-10 pb-16 sm:px-8 sm:pt-14"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
              Release calendar<span className="text-primary">.</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              What’s worth the wait. What lived up to it.
            </p>
          </div>
          {DevWorkspace && (
            <Button onClick={() => openEditor(null)}>
              <Plus data-icon="inline-start" />
              Add a game
            </Button>
          )}
        </div>
        <div className="mt-9 flex flex-wrap items-end justify-between gap-5 pb-5">
          <div className="w-44">
            <ChoiceField
              id="calendar-month"
              label="Month"
              value={month}
              onChange={setMonth}
              disabled={year === "unscheduled"}
              options={[
                { value: "all", label: "All months" },
                ...MONTHS.map((label, index) => ({ value: String(index + 1), label })),
              ]}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous year"
              disabled={year === "unscheduled" || Number(year) <= 1970}
              onClick={() => changeYear(String(Number(year) - 1))}
            >
              <ChevronLeft />
            </Button>
            <div className="w-32">
              <ChoiceField
                id="calendar-year"
                label="Year"
                value={year}
                onChange={changeYear}
                options={[
                  ...years.map((value) => ({ value: String(value), label: String(value) })),
                  { value: "unscheduled", label: "Unscheduled" },
                ]}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next year"
              disabled={year === "unscheduled" || Number(year) >= 2200}
              onClick={() => changeYear(String(Number(year) + 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <Separator />
        <div
          className="flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <p>
            {count} {count === 1 ? "game" : "games"}
            {month === "all" ? " on your radar" : ` in ${MONTHS[Number(month) - 1]}`}
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            {selectedGames.filter((game) => isPlayed(game.play)).length} played this year
          </p>
          <span>Hype before. A verdict after.</span>
        </div>
        {sections.length ? (
          <div className="flex flex-col gap-12 pt-3">
            {sections.map((section) => (
              <section
                key={section.key}
                className="grid gap-5 sm:grid-cols-[9rem_1fr] sm:gap-8"
                aria-labelledby={`section-${section.key}`}
              >
                <div className="flex items-baseline gap-3 sm:flex-col sm:gap-1.5">
                  <h2 id={`section-${section.key}`} className="font-heading text-xl font-medium">
                    {section.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {section.games.length} {section.games.length === 1 ? "release" : "releases"}
                  </span>
                </div>
                <div className="grid min-w-0 gap-x-7 gap-y-9 md:grid-cols-2">
                  {section.games.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      selected={game.id === selectedId}
                      onEdit={editGame}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Empty className="min-h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>
                <h2>Nothing on the calendar. Yet.</h2>
              </EmptyTitle>
              <EmptyDescription>
                {month !== "all"
                  ? "No dated releases this month. Games with unannounced months stay in the full-year view."
                  : year === "unscheduled"
                    ? "Every game has a year for now. Games without one will live here."
                    : "A little room for the next discovery. Try another year or add a game to the collection."}
              </EmptyDescription>
            </EmptyHeader>
            {month !== "all" && (
              <EmptyContent>
                <Button variant="outline" onClick={() => setMonth("all")}>
                  Show the whole year
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </main>
    </div>
  );
  return DevWorkspace ? (
    <Suspense fallback={content}>
      <DevWorkspace
        games={games}
        editor={editor}
        onEdit={openEditor}
        onClose={() => void navigate(lastCalendar.current)}
        onSaved={setGames}
      >
        {content}
      </DevWorkspace>
    </Suspense>
  ) : (
    content
  );
}
