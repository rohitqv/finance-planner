# Backup / Restore (export & import)

## Goal

Let a user export their saved data (retirement plan and/or saved Calculator
scenarios) to a single JSON file they download, and later import that file
to restore it — recovering from a cleared browser/cookies/localStorage, or
moving data to another browser/machine.

## Non-goals

- No CSV export/import. Retirement plan data is nested (asset classes,
  expense phases inside one plan); CSV would either lose that structure or
  need a lossy flattening, and wouldn't round-trip cleanly back through
  import. JSON is the only format, for both directions.
- No cloud sync, no backend, no account system. Export produces a local
  file download; import reads a local file the user picks. Storage stays
  `localStorage`, same as the rest of the app.
- No per-field merge/diff UI for the retirement plan on import — it's a
  single object, so import is a full replace (with a confirmation gate),
  not a field-by-field merge.

## Data model

New module `lib/backup/backup.ts`:

```ts
export type BackupPayload = {
  version: 1;
  exportedAt: string;                 // ISO timestamp, e.g. new Date().toISOString()
  retirementPlan?: RetirementInput;   // present only if selected at export time
  scenarios?: Scenario[];             // present only if selected at export time
};
```

- `buildBackupPayload({ retirementPlan, scenarios }: { retirementPlan?: RetirementInput; scenarios?: Scenario[] }): BackupPayload`
  Assembles the payload above. `retirementPlan`/`scenarios` keys are included
  only when the corresponding argument is provided (not merely non-empty —
  the caller decides inclusion via the export checkboxes, described below).

- `parseBackupPayload(raw: string): BackupPayload`
  `JSON.parse`s `raw`, then validates:
  - the parsed value is a non-null object with `version === 1`
  - if `retirementPlan` is present: it's a non-null object with an
    `assetClasses` field that is an array
  - if `scenarios` is present: it's an array, and every element is a
    non-null object with a `name` field of type `string`
  Throws a descriptive `Error` (not a silent `null`/`undefined`) on any
  validation failure, so the UI layer can surface *why* a file was
  rejected. Does not mutate any store — purely parses and validates.

- `mergeImportedScenarios(existing: Scenario[], imported: Scenario[]): Scenario[]`
  Returns `[...existing, ...imported.map((s) => ({ ...s, id: crypto.randomUUID() }))]`.
  Every imported scenario always gets a freshly generated ID — the file's
  own IDs are never trusted or reused — so merging can never collide with
  an existing scenario's ID, regardless of the file's origin.

The retirement plan has no merge function: importing a plan is a straight
replace of the single saved object (see confirmation gate below), not a
list to merge into.

## UI, flow & error handling

New component `components/BackupRestore.tsx`, mounted once in `app/page.tsx`
near the `<h1>` title, above the tab bar — visible regardless of which tab
(Calculator or Retirement) is active, since a single export/import can span
both.

**Export**

- Two checkboxes: "Retirement plan" and "Saved scenarios (N)" (N = current
  count). Each is checked and enabled by default only when that data
  currently exists: `loadPlan() !== null` for the plan, `loadScenarios().length > 0`
  for scenarios. If neither exists, both checkboxes are absent/disabled and
  the Export button itself is disabled.
- Clicking **Export** calls `buildBackupPayload` with `retirementPlan: loadPlan() ?? undefined`
  and `scenarios: loadScenarios()`, gated by which checkboxes are checked;
  `JSON.stringify`s the result (pretty-printed, 2-space indent); wraps it in
  a `Blob` (`type: "application/json"`); creates an object URL; and clicks a
  temporary `<a download="finance-planner-backup-YYYY-MM-DD.json">` element
  pointed at it, then revokes the object URL. Standard client-side download,
  no server round-trip.

**Import**

- An **Import** button opens a hidden `<input type="file" accept="application/json">`.
- On file selection: read the file as text (`FileReader.readAsText` or
  `File.text()`), then:
  1. Call `parseBackupPayload(text)`.
  2. **On failure**: show an inline error message ("This file doesn't look
     like a Finance Planner backup.") in the component. Nothing else
     changes — no store is touched, no reload happens.
  3. **On success**, apply whichever parts the payload contains:
     - `scenarios`, if present: `saveScenarios(mergeImportedScenarios(loadScenarios(), payload.scenarios))` —
       always applied, no confirmation (purely additive, nothing is lost).
     - `retirementPlan`, if present:
       - if `loadPlan() !== null` (a plan is already saved): show
         `window.confirm("This will replace your current retirement plan inputs. Continue?")`.
         Only call `savePlan(payload.retirementPlan)` if confirmed; if
         cancelled, the plan half of the import is skipped (scenarios, if
         also present, are still applied per the step above).
       - if no plan is currently saved: `savePlan(payload.retirementPlan)`
         directly, no confirmation.
  4. If any store was actually written in step 3, call
     `window.location.reload()` so both tabs re-initialize their state from
     the now-updated `localStorage` on next mount. This is the simplest way
     to get imported data showing up immediately: `app/page.tsx` already
     fully unmounts/remounts `CalculatorTab`/`RetirementTab` on every tab
     switch and holds no shared state between them to update in place, so a
     reload avoids adding new cross-tab state plumbing solely for this rare,
     explicit action.

## Testing

- `lib/backup/__tests__/backup.test.ts`: `buildBackupPayload` includes/excludes
  keys correctly; `parseBackupPayload` accepts a valid plan+scenarios
  payload, accepts plan-only and scenarios-only payloads, and throws on
  invalid JSON, missing/wrong `version`, a malformed `retirementPlan`
  (no `assetClasses` array), and a malformed `scenarios` entry (missing
  `name`); `mergeImportedScenarios` assigns fresh IDs to every imported
  scenario, never collides with an existing ID, and handles an empty
  existing list.
- `components/__tests__/BackupRestore.test.tsx`: Export button disabled
  when neither plan nor scenarios exist; checkboxes default per what
  exists; an invalid file shows the error message and calls neither
  `savePlan` nor `saveScenarios`; a valid file with a plan calls
  `window.confirm` when a plan already exists and skips the plan write
  when cancelled; a valid file with a plan and no existing plan skips
  `confirm` and writes directly; a valid file with scenarios always merges
  and writes without `confirm`.
