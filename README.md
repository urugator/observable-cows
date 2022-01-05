# observable-cows

A state management I can live with.

## Requirements
TODO
Modern ES environment supporting: Proxy, Map (or polyfill), Set (or polyfill), queueMicrotask (or Promise)
TODO links

## Installation
TODO

## Usage
TODO

## Constrains/limitations

1. State must be *tree*, eg. you can't:
```javascript
state.foo = {};
state.bar = state.foo;
```
TODO see why tree

1. Only *array* and *plain object* are supported.
TODO see why only array/object

## Design 
Combines ideas from [redux](TODO), [immer](TODO) and [mobx](TODO):
`redux` - immutable reads, single normalized serializable tree, opinionated about architecture
`immer` - copy-on-write
`mobx` - mutable writes, automatic smart subscriptions

### Key differences

`redux` - mutable writes, no selectors, "reducers" are optional, no need for thunks/sagas/etc
`immer` - instead of turning immutable state into something temporarily mutable, state is mutable by default, but maintains immutable copy
`mobx` - only array/object is supported, no computeds, automatic batching, better interaction with hooks, cheap deep subscriptions

### Core goals:

Simplicity in terms of both - implementation and usage.
Playing well with existing tools (react,hooks,concurrency,linter,fast-refresh).
Encouraging patterns that leads to success. Nonidiomatic or incorrect usage should be impossible.
Reasonable performance.

### Non-goals:

Support or even try to support every single use case.
Support older browsers.
Be non-opinionated.
Best possible performance in every scenario.

### Best practies

Keep state flat, avoid nesting.
Provide everything a stable ID.
Prefer arrays of IDs rather than arrays of actual objects. TODO example
Refer to other objects via IDs. TODO example

### Subscribing for a change in the subtree

You can subscribe for a change that occured anywhere in the whole subtree via `unwrap(snapshot)`. 
This is required when passing the snapshot to a non-observer, such as 3rd party component.
It is done by reporting a special observable representing whole subtree, when a new copy is created (rather than when a value is changed).
`unwrap(snapshot)` subscribes for this special observable and returns de-proxified copy.

### Ignoring exotic objects

TODO

## Reasonings

### Why tree?
TODO

### Why only one tree?
TODO

### Why only array/object?
TODO

### Why normalization?
TODO

### Why no computeds?
TODO

### Why dispatch?
TODO
- Allows flushing batch immediately, rather than in microtask (default). This is required eg. for input onChange.
https://github.com/pmndrs/valtio/issues/270
- Isolates writes from reads - you shouldn't write to snapshots, but also you shouldn't read from snapshot during writes (eg inlined event handlers).
https://github.com/pmndrs/valtio/issues/254#issuecomment-944887283
- Actions doesn't have to be drilled through components, but statically imported. No issues with `this`. Uniform access to state (prevState).
- Ability to defer actions during reads (state can't be mutated until reads are finished  - similar to `setState` behavior in `react`)
- single point of entry (middlewares, logging, time traveling) - but it would require to use dispatch in async as well :(

### Why HOC instead of hook?
TODO (memo, error handling, eslint-plugin-react-hooks, perf)

### Why observable-cows?

observable-copy-on-write-state

### TODO

unsafeReads( => );store.read(snapshot => );supress/peek
action -> writes
effect -> reads
Maybe allow beginWrites/beginReads if already and use nesting counter (so the inners are noop) - state.x = 5; dispatch(); would always wait for microtask
replace process.env checks with global that is set once
replace access to observersMap with addObserver/removeObserver(observable)
addObservable/removeObservable(observer)
start/stop -> begin/end
observer name + toString()
invetigate keeping copies outside the tree in WeakMap

https://github.com/pmndrs/valtio/wiki/Some-gotchas

### Time travel

TODO
History of snapshot + action, on undo/redo recreate state from snapshot.

What about subscriptions?
a) force all observers to re-run
b) keep track of observers that were notified inbetween snapshots

Can we avoid recreating whole state from snapshot?
a) we would have to apply some diffs/patches
b) in principle there are just set/delete operations, so for each we would have to generate and record reverse operation, eg:
state.store.x = 5 => if (x is new property) { delete state.store.x } else { state.store.x = prevX }
delete state.store.y => if (y is existing property) { state.store.y = prevY }
op log idea: { target, operation: add|replace|delete, nextValue, prevValue (or new/oldValue or value/currentValue) }
store.undo/redo()
undoOperation(state, operation)
redoOperation(state, operation)
would be nice to "compatify" array operations (the op log could get quite big for arrays) eg { target, operation: "splice", index, deleteCount, items }
probably would actually need different operations defined for array due to proxy trap setting internal properties (dunno)
Note we can keep actuall references in op-log, but we can also use paths, so the op-log is serializable as long as the values are serializable
We could also keep a list of associated observers in op-log ... but why? if we actually mutate the state during undo/redo, it will notify observers correctly

### Committing subscriptions

TODO
a) at the end of render - dispose in microtaks, unless mounted in useLayoutEffect
b) at the end of render - FinalizationRegistry
c) in effect - save current state version, compare version in effect (unrelated mutations can force re-render)
d) in effect - collect accessed { node, key, value }, compare value with current node._copy[key] in effect.

### Mutating state in observers

TODO
Is not allowed. All state mutations happens synchronously and immediately, meaning that multiple observers invoked in the same batch could see different snapshots.