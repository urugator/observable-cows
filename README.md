# observable-cows

A global state management library for react.

## Requirements
TODO<br>
Modern ES environment supporting: Proxy, Map (or polyfill), Set (or polyfill), queueMicrotask (or Promise)
TODO links<br>

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
Combines ideas from [redux](TODO), [immer](TODO) and [mobx](TODO):<br>
`redux` - immutable reads, single normalized serializable tree, opinionated about architecture<br>
`immer` - copy-on-write<br>
`mobx` - mutable writes, automatic smart subscriptions<br>

### Key differences

`redux` - mutable writes, no selectors, "reducers" are optional, no need for thunks/sagas/etc<br>
`immer` - instead of turning immutable state into something temporarily mutable, state is mutable by default, but maintains immutable copy<br>
`mobx` - only array/object is supported, no computeds, automatic batching, better interaction with hooks, cheap deep subscriptions<br>

### Core goals:

Simplicity in terms of both - implementation and usage.<br>
Playing well with existing tools (react,hooks,concurrency,linter,fast-refresh).<br>
Encouraging patterns that leads to success. Nonidiomatic or incorrect usage should be impossible.<br>
Reasonable performance.<br>

### Non-goals:

Support or even try to support every single use case.<br>
Support older browsers.<br>
Be non-opinionated.<br>
Best possible performance in every scenario.<br>

### Best practies
TODO examples
Reexport the library as your own module and depend on this module instead.
Keep state flat, avoid nesting.<br>
Provide everything a stable ID.<br>
Prefer arrays of IDs rather than arrays of actual objects.<br>
Refer to other objects via IDs.<br>
Don't pass objects/arrays that are part of the snapshot as params to actions, eg `deleteTodo(todo)` => `deleteTodo(id)`<br>

### Subscribing for a change in the subtree

You can subscribe for a change that occured anywhere in the whole subtree via `unwrap(snapshot)`.<br>
This is required when passing the snapshot to a non-observer, such as 3rd party component.<br>
It is done by reporting a special observable representing whole subtree, when a new copy is created (rather than when a value is changed).<br>
`unwrap(snapshot)` subscribes for this special observable and returns de-proxified copy.<br>

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
- Allows flushing batch immediately, rather than in microtask (default). This is required eg. for input onChange.<br>
https://github.com/pmndrs/valtio/issues/270
- Isolates writes from reads - you shouldn't write to snapshots, but also you shouldn't read from snapshot during writes (eg inlined event handlers).<br>
https://github.com/pmndrs/valtio/issues/254#issuecomment-944887283
- Actions doesn't have to be drilled through components, but statically imported. No issues with `this`. Uniform access to state (prevState).<br>
- Ability to defer actions during reads (state can't be mutated until reads are finished  - similar to `setState` behavior in `react`)<br>
- single point of entry (middlewares, logging, time traveling) - but it would require to use dispatch in async as well :(<br>

### Why HOC instead of hook?
TODO (memo, error handling, eslint-plugin-react-hooks, perf)

### Why observable-cows?

observable-copy-on-write-state

### TODO

unsafeReads( => );store.read(snapshot => );supress/peek<br>
action -> writes<br>
effect -> reads<br>
Maybe allow beginWrites/beginReads if already and use nesting counter (so the inners are noop) - state.x = 5; dispatch(); would always wait for microtask<br>
replace process.env checks with global that is set once<br>
replace access to observersMap with addObserver/removeObserver(observable)<br>
addObservable/removeObservable(observer)<br>
observer name + toString()<br>
invetigate keeping copies outside the tree in WeakMap<br>

https://github.com/pmndrs/valtio/wiki/Some-gotchas

### Time travel

TODO
History of snapshot + action, on undo/redo recreate state from snapshot.

What about subscriptions?<br>
a) force all observers to re-run<br>
b) keep track of observers that were notified inbetween snapshots<br>

Can we avoid recreating whole state from snapshot?<br>
a) we would have to apply some diffs/patches<br>
b) in principle there are just set/delete operations, so for each we would have to generate and record reverse operation, eg:<br>
state.store.x = 5 => if (x is new property) { delete state.store.x } else { state.store.x = prevX }<br>
delete state.store.y => if (y is existing property) { state.store.y = prevY }<br>
op log idea: { target, operation: add|replace|delete, nextValue, prevValue (or new/oldValue or value/currentValue) }<br>
store.undo/redo()<br>
undoOperation(state, operation)<br>
redoOperation(state, operation)<br>
would be nice to "compatify" array operations (the op log could get quite big for arrays) eg { target, operation: "splice", index, deleteCount, items }<br>
probably would actually need different operations defined for array due to proxy trap setting internal properties (dunno)<br>
Note we can keep actuall references in op-log, but we can also use paths, so the op-log is serializable as long as the values are serializable<br>
We could also keep a list of associated observers in op-log ... but why? if we actually mutate the state during undo/redo, it will notify observers correctly<br>

### Committing subscriptions

TODO<br>
a) at the end of render - dispose in microtaks, unless mounted in useLayoutEffect<br>
b) at the end of render - FinalizationRegistry<br>
c) in effect - save current state version, compare version in effect (unrelated mutations can force re-render)<br>
d) in effect - collect accessed { node, key, value }, compare value with current node._copy[key] in effect.<br>

### Mutating state in observers

TODO<br>
Is not allowed. All state mutations happens synchronously and immediately, meaning that multiple observers invoked in the same batch could see different snapshots.

### Additional notes 

- use(Layout)Effect can't be observer, because it may access observables asynchronously, so it wouldn't subscribe for these
- we have to decide between warning outside observer OR ability to read from snapshot during writes due to async operations OR enabling async only via dispatch(+generators)
[unwrap(object)]
- useObserverEffect
- if we enable writes only in dispatch, then we can allow reading from snapshots during writes - so the access can still warn outside observer, but then:

```javascript
// still throws
useCallback(() => {
  dispatch(deleteTodo(todo.id))
}, [todo])
// so it would have to be
useCallback(() => {
  dispatch(deleteTodo(todo))
}, [todo])
// which is non-idiomatic
// and we need a custom deps comparator that unwraps observables
```

### Passing observables as props

The observer component is able to invalidate itself, but the observable prop is the one passed by parent, not the current one. Possible solutions:

**Don't allow passing observables as props to observers**<br>
Implemented as devel only check throwing an error.<br>
You can only pass ID and select the actual value in child component based on it.<br>
Idiomatic, but less convinient. If the selected value doesn't exist we can't bail out (similar to context selectors)<br>

**Replace props**<br>
If props did not changed (meaning the component was not updated by parent). Cycle through current props and replace the observable one with current copy.<br>
Additional overhead, even if there are no observables.<br>

**Proxify props**<br>
The `get` trap checks if prop is oservable and returns latest copy rather than actual prop<br>
Dunno if safe - props can be read outside render (eg effect) so it could see different copy than render.
But not sure if it can actually happen - my assumtion is that if the copy changed, then there is scheduled update and react will wait for that update before actually invoking effect. Same situation can occur with vanilla react `setState` + mutable state.<br>
Also the proxy could be eventually slower then replacing props.

**Use mutable state**
The refs are stable. Use "copy" only on devel to protect from reads/writes. Use "copy" propagation to allow deep subscriptions.<br>
All hooks (including memo) require unwrap.

**Give up on `observer` idea, use observing selectors**
We would always uwrap returned value, but then user must return observable or primitive, he can't create new object:
```javascript
const thing = useSelector(state => {
  // problematic
  return {
    a: state.x.a
    b: state.y.b
  }
})
```
