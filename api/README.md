# Public declaration reference

These review snapshots contain every local declaration reachable from the package's
published type entries, including subpaths, re-exports, imported types, and public
return types. Each `// File:` section retains its original module boundary; the
combined snapshot is a review document, not a module to import or compile.

- [Core declarations](./core.d.ts)
- [Deck declarations](./deck.d.ts)
- [React declarations](./react.d.ts)

Run `pnpm test:api` to compare a fresh build with these snapshots. After an intentional
API change, run `pnpm api:update` and review every changed signature. Referenced
internal declarations are included conservatively because they can affect consumer
types. Unreachable internal modules are excluded. External dependency declarations
are resolved by consumer type checks rather than copied here.

For usage examples and lifecycle guidance, start with the [documentation index](../docs/README.md).
