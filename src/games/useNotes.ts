import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  isBlankNote,
  readNotes,
  readNotesMode,
  writeNotes,
  writeNotesMode,
  type Note,
} from "./notes";

/** Notes mode and this browser's notes. `?notes` turns the mode on, `?notes=off` turns it off. */
export function useNotes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [on, setOn] = useState(readNotesMode);
  const [notes, setNotes] = useState(readNotes);
  const param = new URLSearchParams(location.search).get("notes");
  const asked = param === null ? null : param !== "off";
  if (asked !== null && asked !== on) setOn(asked);

  // Remembers the choice and drops the parameter from the address.
  useEffect(() => {
    if (asked === null) return;
    writeNotesMode(asked);
    void navigate(
      { pathname: location.pathname, hash: location.hash },
      { replace: true, state: location.state },
    );
  }, [asked, navigate, location.pathname, location.hash, location.state]);

  function update(next: Record<string, Note>) {
    writeNotes(next);
    setNotes(next);
  }

  return {
    on,
    notes,
    setNote: (id: string, note: Note) => {
      const { [id]: _, ...rest } = notes;
      update(isBlankNote(note) ? rest : { ...rest, [id]: note });
    },
    clear: () => update({}),
    leave: () => {
      writeNotesMode(false);
      setOn(false);
    },
  };
}
