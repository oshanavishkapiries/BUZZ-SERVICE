# Buzz Notification Service — Agent Guide

This project uses a **memory-driven agent workflow** to preserve context across coding sessions.

## Session Start

1. Read `agent/overview.md` for a brief project overview.
2. Read `agent/memory.md` for project context, recent changes, and current state.
3. Read `agent/current-implementation.md` for a detailed codebase overview.
4. Check `agent/checksums.json` to see which files changed since last session.
5. Review `agent/designs/` for any active design documents.

## During Development

1. Before implementing a feature, create a design doc in `agent/designs/` using `_template.md`.
2. Reference the design in `agent/memory.md` under "Active Context".

## After ANY Code Change (REQUIRED)

After every code change, feature implementation, bug fix, or refactoring:

1. **Update `agent/memory.md`:**
   - Add an entry to the "Recent Changes" table.
   - Update "Current State" checkboxes.
   - Update "Active Context" section.
   - Update the "Last updated" timestamp.

2. **Update `agent/checksums.json`:**
   - Regenerate checksums for modified files.
   - Update the `generated_at` timestamp.

3. **Update `agent/current-implementation.md`:**
   - Update relevant sections if architecture, APIs, or file structure changed.
   - Update the "Last updated" timestamp.

4. **Update design docs** (if applicable):
   - Mark completed steps.
   - Update status and timestamp.

## Why This Matters

- New sessions read these files to understand context without re-analyzing the codebase.
- Saves tokens and time through continuous development awareness.
- All memory items belong to the project and persist across sessions.
