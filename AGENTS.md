rules:
  - name: Documentation Strategy Rule
    description: >
      Maintain lightweight project documentation for continuity and context.
      Keep logs short and grouped by meaningful tasks, not micro changes.

    steps:
      - Before starting any request:
          * Read `VISION.md` (project purpose, direction).
          * Read the latest entry in `DEVLOG.md` (current state + next steps).
      - When making changes:
          * If project scope/goal changes → update `VISION.md`.
          * If new code is added or existing code is modified → update/add a short README in `docs/` for that module.
      - After completing changes:
          * Append a new entry to `DEVLOG.md` with this format:
              - Date + Title (short, e.g. "2025-08-28: Added User Auth Service")
              - Summary (1–2 bullets of key updates, no long explanations)
              - Next Step (1 line)
      - Keep each entry max 5 lines.
      - Do not log micro-changes (typos, small refactors) unless part of a bigger feature.
      - When DEVLOG.md grows beyond ~5 entries, move oldest entries into DEVLOG_ARCHIVE.md.
      - IMPORTANT: Do not include any secrets in the documentation!!!
