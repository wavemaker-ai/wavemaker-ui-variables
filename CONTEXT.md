# UI Variables Migration Context

Status: discovery

## Goal

Replace the React application's dependency on the UI Variables execution
engine with custom React hooks and a small query-like variable client.
TanStack Query will not be used.

The prototype being evaluated is:

`/Users/yagyarajl_500394/Downloads/variable-hook/nextjsapp`

The prototype is a read-only reference for this discovery. No migration
changes will be made in that directory.

## Current Service Variable Flow

1. Generated configuration creates a service variable.
2. The React runtime wrapper registers it in `Page.Variables`.
3. `ServiceVariableManager` handles invocation, in-flight behavior, metadata,
   security, request processing, dataset updates, callbacks, and cancellation.
4. Generated widgets and scripts consume the mutable variable object.

## Resolved Decisions

### Preserve the public variable API during phase 1

The replacement implementation will own execution and state, but generated
applications will continue using the existing compatibility surface:

- `Page.Variables.<name>`
- `dataSet`
- `invoke()`
- `setInput()`
- `isExecuting` and `loading`
- lifecycle callbacks
- cancellation and paging where supported

This separates the engine migration from a codegen, widget, and application
script migration.

## Prototype Finding

The current `useVariable` prototype is an adapter around the existing runtime
variable classes. It does not yet replace the UI Variables engine:

- it constructs the existing `ServiceVariable`, `LiveVariable`,
  `ModelVariable`, and `CrudVariable` classes;
- it registers placeholder service metadata;
- it overrides transport through `invokeHttp`;
- the legacy managers still own `dataSet`, execution state, events, response
  processing, and cancellation.

## Open Decisions

- Whether phase 1 replaces only Service Variables or every variable type.
- Exact request-key semantics and sharing scope.
- Required in-flight, retry, freshness, and cache behavior.
- Response normalization and error compatibility.
- OAuth, uploads, downloads, pagination, and cancellation ownership.
