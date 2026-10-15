# Gaming interface

## Direction

An operating surface for a small personal collection, not a storefront. The user-approved structure is cover-led cards grouped into monthly sections. Preserve the Kit classic theme picker, Base Nova components, and default Gilt palette.

## Layout

A constrained page with a quiet app header, calendar heading, month and year controls, then monthly sections. Month labels occupy a narrow left column on desktop, with a two-column game grid to the right. Mobile stacks labels and games. Quarter-only and unknown dates have honest separate sections. The empty state keeps filters available.

## Type and color

Use the existing self-hosted Geist family. Heading hierarchy is expressed through weight and size rather than separate decorative faces. All interface colors use semantic theme tokens. Palette mapping belongs to upstream theme.css; app-level :root/.dark defaults must not override it. Gilt's background is near black and its primary is gold, but no app component hardcodes those colors.

## Content

Artwork carries the visual interest. Use wide, consistently cropped images with source provenance in docs/assets.md. Game entries use stock shadcn Card with CardHeader, CardTitle, CardDescription, CardAction, and CardContent. Source links stay out of the calendar cards; they remain editable in the local editor. Keep its default surface and spacing rather than recreating a custom card treatment. Missing artwork and empty calendar results use shadcn Empty composition. Hype uses five small segments, an accessible numeric label, and an explicit Unrated label when missing. Final review scores use a distinct 1–10 scale.

## Components and editing

Keep vendored primitives byte-for-byte upstream. Form fields use FieldGroup and Field with stock Input, Textarea, and Select. Feedback uses Alert composition, and standalone content dividers use Separator. Prefer shadcn display patterns as well as interactive controls; reserve custom UI for domain-specific gaps such as the hype indicator. The development editor is a labeled, scrollable, focus-protected dialog with clear save/remove controls, pending states, validation errors, conflict messages, and draft-discard confirmation.

## Motion and accessibility

The classic picker owns theme transitions. Cover hover zoom is subtle and disabled under reduced motion. Controls retain stock keyboard focus treatment. Use labeled filter controls, heading-linked sections, descriptive button names, and live feedback for saves and filter counts. Local captures in .impeccable/review/ are verification artifacts, not shipped assets.
