# Gaming specification

Gaming currently provides a starter app shell with persistent theme selection. Gaming features are not yet defined.

This spec describes observable behavior. Implementation decisions and research belong in docs/ when needed.

## Rules

Each rule has a stable `area.behavior` slug. Tests start their title with that slug so the rule and its tests can be found together. Change the rule and its tests together when behavior changes.

| Rule            | When                                                                      | Then                                                                                                                |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `app.shell`     | The app opens                                                             | The Gaming shell shows a theme control and keyboard shortcut hints.                                                 |
| `theme.initial` | A visitor opens the app without a saved choice                            | The Gilt theme is applied before the app renders.                                                                   |
| `theme.open`    | The visitor activates the theme control or presses T outside a text field | The theme picker opens on the current theme.                                                                        |
| `theme.select`  | The visitor confirms a theme                                              | The page adopts the theme, closes the picker, and remembers the choice across reloads when storage is available.    |
| `theme.toggle`  | The visitor presses D outside a text field or the picker                  | The page switches between dark and light, using the last choice on that side or Gilt/Flexoki Light as the fallback. |

Split rules into linked area files once this document becomes long. Evidence, validation results, and implementation status do not belong in rule tables.
