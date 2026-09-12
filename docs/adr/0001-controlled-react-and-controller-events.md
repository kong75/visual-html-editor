# ADR-0001: Controlled React wrapper and typed controller events

- **Status:** Accepted
- **Date:** 2026-08-16
- **Owners:** Visual HTML maintainers

## Context

The initial React API required every host to create and retain an `EditorController`. This is appropriate for advanced integrations but too much lifecycle code for the common case where a host already owns an HTML string and wants transaction-level updates.

Overloading `VisualHtmlEditor` with two state-ownership modes would make its lifecycle ambiguous. React-only callbacks also would not help headless consumers observe revisions, validation, dirty state, or rejected transactions.

## Decision

- Keep `VisualHtmlEditor` controller-owned and backwards compatible.
- Add `HtmlEditor` as a convenience wrapper around one stable controller.
- Add `useHtmlEditor` for applications that want the managed lifecycle with custom rendering.
- Add typed controller events through `controller.on(type, listener)` while retaining `controller.subscribe()` for external-store snapshots.
- Make external value replacement explicit through `replace`, `replace-when-clean`, and `reject-when-dirty` policies.
- Emit host changes once per committed source transaction and exclude external source replacement from `onChange` to prevent feedback loops.

## Consequences

- Simple integrations need substantially less lifecycle code.
- Advanced integrations retain complete controller ownership.
- Headless and React consumers share the same transaction events.
- External updates cannot silently destroy dirty work unless the host explicitly chooses `replace`.
- Selection remains React view state and is exposed through `onSelectionChange`, not persisted in core source state.
