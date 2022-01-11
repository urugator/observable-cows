import { Component, createContext, createElement, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from 'react-dom';
import { OBSERVABLE_ACCESS_OUTSIDE_OBSERVER } from "./error-codes.js";

const __DEV__ = process.env.NODE_ENV;

let storeId = 0;
const nodeSymbol = Symbol('node');
const contextSymbol = Symbol('context');
const keysKey = '*';
const subtreeKey = '**';
const proxyTargetSymbol = Symbol('proxy-target');

const requestIdleCallback = globalThis.requestIdleCallback || setTimeout;
const cancelIdleCallback = globalThis.cancelIdleCallback || clearTimeout;

export const PHASE_IDLE = 0;
export const PHASE_READS = 1;
// Starts automatically with first mutation and ends in following microtask
// or starts and ends with `dispatch`
export const PHASE_WRITES = 2;

globalThis[contextSymbol] = {
  observer: null,
  phase: PHASE_IDLE,
  level: 0,
  endWritesScheduled: false,
  // `dispatch`ed actions don't run until effects or subscriptions (whatever is last) are finished
  scheduledActions: [],
  // Set<observer>
  scheduledObservers: new Set(),
  // We could probably use WeakMap for non string keys
  // Map<observable, Set<observer>>
  observersMap: new Map(),
  // Map<observer, Set<observable>>  
  ssr: typeof window === 'undefined',
  requireObserver: true,
  version: Symbol(),
}

// TODO
class Observer {
  constructor(effect) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof effect !== 'function') {
        throw new Error(`effect must be a function`);
      }
    }
    this.observables = new Set();
    this.newObservables = null;
    this.effect = effect;
    // TODO Subclass - ComponentObserver
    this.disposeCallbackId = null;    
    //this.prevProps = null;
    this.props = null;
    // Hack: We can't proxy props directly,
    // because it's frozen - `get` trap  can't return different value.
    this.propsProxy = new Proxy({}, this);
  }
  get(target, key) {
    const value = this.props[key];
    return getNode(value)?._copy ?? value;
  }
  has(target, key) {
    return Reflect.has(this.props, key);
  }
  ownKeys() {
    return Reflect.ownKeys(this.props);
  }
  getOwnPropertyDescriptor(target, key) {
    return Reflect.getOwnPropertyDescriptor(this.props, key);
  }
  getPrototypeOf(target) {
    return Reflect.getPrototypeOf(this.props);
  }
  set(target, key) {
    return Reflect.set(this.props, key);
  }
  defineProperty(target, key, descriptor) {
    return Reflect.defineProperty(target, key);
  }
  isExtensible(target) {
    return Reflect.isExtensible(target);
  }
  prevetExtensions(target) {
    return Reflect.preventExtensions(target);
  }
  scheduleDispose() {
    this.disposeCallbackId = requestIdleCallback(() => this.dispose());
  }
  cancelDispose() {
    cancelIdleCallback(this.disposeCallbackId);
  }
  // TODO throw on devel if disposed
  beginSubscriptions() {
    console.debug(`beginSubscriptions`);
    // TODO
    _startSubscriptions(this);
  }
  // TODO throw on devel if disposed
  endSubscriptions() {
    console.debug(`endSubscriptions`);
    // TODO
    _stopSubscriptions(this);
  }
  dispose() {
    // TODO
    _disposeObserver(this);
  }
}
// path => [reaction,]
// TODO dissallow empty keys?
// TODO forbidden keys: ['', '*', '**']
function _isSupported(value) {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function createStore(state = {}) {
  return new Store(state);
}

// TODO make immutable and do not provide access to value, it's just an instruction
// state.a = ignore(val);
export class Ref {
  constructor(value) {
    this.value = value;
  }
  get() {
    return this.value;
  }
  set(value) {
    return this.value = value;
  }
}

export function dispatch(action) {
  console.debug(`dispatch`, action);
  const context = getContext();
  if (__DEV__ && context.phase === PHASE_WRITES) {
    // Simplifies impl and avoids confusion:
    // Can't nest dispatch calls - should we batch these together, should they wait for observers?
    // Can't mix dispatch batch boundary (synchronous), with microtask batch boundary (asynchronous), eg:
    // `state.a = 1; dispatch(); state.b = 2`
    // It's not clear whether `dispatch` should call scheduled observers
    // immediately at it's end (observers possibly see incomplete changes - inconsitencies)
    // or in microtask (causing issues with observers that must run synchronously)
    // Atm can guarantee the dispatch always calls scheduled observers at it's end
    throw new Error(
      `Can't call \`dispatch\` when already in writes phase.
      Make sure you don't nest \`dispatch\` calls and all your state mutations
      are part of a single \`dispatch\` call.
      `
    )
  }
  // We don't want to perform mutations inside observer,
  // because subscriptions are not completely resolved at that point,
  // so we could be scheduling wrong observers.
  // We also don't want mutations to interfere with effects,
  // so that all effects in the same batch see the same state.
  // Also we don't have to worry about new observers being concurrently scheduled when previous are still being processed.
  // We guarantee that all (either scheduled or in progress) effects are finished before dispatched action is called.  
  if (
    context.PHASE_READS
  ) {
    // Scheduled actions will be eventually called at `endReads`
    context.scheduledActions.push(action);
  } else {
    // Avoid creating microtask
    context.endWritesScheduled = true; // TODO
    beginWrites();
    try {
      action();
    } finally {
      context.endWritesScheduled = false; // TODO
      endWrites();
    }
  }
}

export function beginWrites() {
  console.debug(`beginWrites`);
  const context = getContext();
  if (process.env.NODE_ENV !== 'production' && context.phase !== PHASE_IDLE) {
    throw new Error("Can't begin writes when not idle.");
  }
  context.phase = PHASE_WRITES;
  // Schedule endWrites
  if (!context.endWritesScheduled) {
    context.endWritesScheduled = true;
    queueMicrotask(() => {
      context.endWritesScheduled = false;
      endWrites()
    });
  }
}

export function endWrites() {
  console.debug(`endWrites`);
  const context = getContext();
  if (process.env.NODE_ENV !== 'production' && context.phase !== PHASE_WRITES) {
    throw new Error("Can't end writes when not in writes phase.");
  }
  if (process.env.NODE_ENV !== 'production' && context.endWritesScheduled) {
    throw new Error(
      `Can't end writes, because end is already scheduled for the next microtask.
      If you need to end writes synchronously, make sure to wrap all mutations in \`dispatch\``
    );
  }
  context.phase = PHASE_IDLE;
  if (context.scheduledObservers.size === 0) {
    return;
  }
  beginReads();
  try {
    unstable_batchedUpdates(() => {
      context.scheduledObservers.forEach(observer => {
        observer.effect(observer);
        context.scheduledObservers.delete(observer);
      });
    })
  } finally {
    endReads();
  }
}

export function beginReads() {
  console.debug(`beginReads`);
  const context = getContext();
  if (process.env.NODE_ENV !== 'production' && context.phase !== PHASE_IDLE) {
    throw new Error("Can't begin reads when not idle.");
  }
  context.phase = PHASE_READS;
  context.version = Symbol();
}

export function endReads() {
  console.debug(`endReads`);
  const context = getContext();
  if (process.env.NODE_ENV !== 'production' && context.phase !== PHASE_READS) {
    throw new Error("Can't end reads when not in reads phase.");
  }
  context.phase = PHASE_IDLE;
  if (context.scheduledActions.length === 0) {
    return;
  }
  context.endWritesScheduled = true; // TODO as param of beginWrites
  beginWrites();
  try {
    for (const action of context.scheduledActions) {
      action();
    }
    context.scheduledActions = [];
  } finally {
    context.endWritesScheduled = false; // TODO
    endWrites();
  }
}

export function _disposeObserver(observer) {
  const context = getContext();
  // Remove observer from observables
  observer.observables.forEach(observable => {
    const observers = context.observersMap.get(observable);
    observers.delete(observer);
    if (observers.size === 0) {
      // Probably wouldn't be required with weak map
      context.observersMap.delete(observable);
    }
  })
}

export function _startSubscriptions(observer) {
  const context = getContext();
  if (context.observer) {
    throw new Error(`beginSubscription already called TODO`);
  }
  if (process.env.NODE_ENV !== 'production' && context.phase !== PHASE_READS) {
    throw new Error("Can't begin subscriptions when not in reads phase.");
  }
  // Prepare empty observables Set for new subscriptions    
  observer.newObservables = new Set();
  // Set as current observer for reportAccess
  context.observer = observer;
}

export function _stopSubscriptions() {
  const context = getContext();
  const { observer } = context;
  if (process.env.NODE_ENV !== 'production' && !observer) {
    throw new Error(`Not in subscriptions context. stopSubscriptions must be called in pair with startSubscriptions TODO`);
  }
  // Remove observer from observables that were not accessed.
  // Accessed observables are removed during `reportAccess`,
  // therefore only non-accessed observables remains.
  observer.observables.forEach(observable => {
    const observers = context.observersMap.get(observable);
    observers.delete(context.observer);
    if (observers.size === 0) {
      // This would not be neccessary if we would store observers directly on observable. 
      // We don't do that, because:
      // - fast-refresh would destroy subscriptions on any state definition change (maybe a good thing? because of leaks - observer still holds refs to deleted state...)
      // - we would need extra object per observable (we do have anyway without string keys - or symbol)
      // - we don't have to keep Set(s) for currently unused state, saving some memory (we can init them lazily on observable as well)
      // - copy (subscriber) doesn't need access to observable (it has anyway)
      context.observersMap.delete(observable);
    }
  })
  // Replace old observables with new ones
  observer.observables = observer.newObservables;
  observer.newObservables = null;
  // Clear current observer  
  context.observer = null;
}

export function getNode(thing) {
  return thing?.[nodeSymbol];
}

export function getContext() {
  return globalThis[contextSymbol];
}

export function getObservable(node, key) {
  if (process.env.NODE_ENV !== 'production' && !(node instanceof Node)) {
    throw new Error('First arg must be instanceof Node');
  }
  let observable = node._path;
  if (key) {
    observable += `.${key}`;
  }
  return observable;
}

export function unwrap(copyProxy) {
  const node = getNode(copyProxy);
  if (__DEV__ && !node) {    
    throw new Error(`unwrap argument must be snapshot proxy`)
  }
  const observable = getObservable(node, subtreeKey);
  reportAccess(observable);
  // TODO ideally we should deep freeze the copy on devel  
  return copyProxy[proxyTargetSymbol];
}

export function getObservables(observer) {
  return observer.observables ?? new Set();
}

export function getObservers(observable) {
  const { observersMap } = getContext();
  return observersMap.get(observable) ?? new Set();
}

export function reportAccess(observable) {
  const context = getContext();
  const { observer } = context;
  if (process.env.NODE_ENV !== 'production' && context.requireObserver && !observer) {
    throw new Error(`${OBSERVABLE_ACCESS_OUTSIDE_OBSERVER}: '${String(observable)}' was accessed outside observer. TODO explain what to do`);
  }

  if (process.env.NODE_ENV !== 'production' && context.phase !== PHASE_READS) {
    throw new Error("Can't report access outside reads phase.");
  }
  //console.debug(`[mutter] "${observable}" accessed by "${context.observer}"`); 
  // Add observable to observer.
  observer.newObservables.add(observable);
  // Remove from old observables.
  // Therefore, at the end of subscriptions,
  // it will only contain observables that need to be unobserved.
  observer.observables.delete(observable);
  // Add observer to observable.
  const observers = context.observersMap.get(observable) ?? new Set();
  observers.add(context.observer);
  context.observersMap.set(observable, observers);
}

export function reportChange(observable) {
  console.debug(`reportChange(${observable})`);
  const context = getContext();
  if (process.env.NODE_ENV !== 'production' && context.phase === PHASE_READS) {
    throw new Error(`Can't report change during reads. Mutating state directly in observers is forbidden. Use dispatch to schedule update.`);
  }
  // Begin writes if not already
  if (context.phase !== PHASE_WRITES) {
    beginWrites();
  }
  // Schedule observers
  const observers = context.observersMap.get(observable);
  // console.debug(`scheduleObservers-observers`, observers);    
  if (!observers) {
    // Nothing to schedule
    return;
  };
  observers.forEach(observer => context.scheduledObservers.add(observer));
  /*if (process.env.NODE_ENV !== 'production' && context.phase !== PHASE_WRITES) {
    //console.warn(`"${String(observable)}" modified in "${String(context.observer)}". Mutating state in observer is forbidden.`);
    throw new Error("Observable can only be modified in writes phase")
  } */
}

export const StoreContext = createContext();

export function StoreProvider({ store, context = StoreContext, children }) {
  const value = useMemo(() => store, [store]);
  return createElement(context.Provider, { value }, children);
}

export function propsEquals(objA, objB) {
  if (Object.is(objA, objB)) {
    return true;
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i++) {
    const currentKey = keysA[i];
    if (!objB.hasOwnProperty(currentKey)) {
      return false
    }
    // The twist: if it's an observable copy of the same object it's considered equal
    const nodeA = getNode(objA[currentKey]);
    if (nodeA) {
      const nodeB = getNode(objB[currentKey]);
      if (!nodeB || !Object.is(nodeA._proxy, nodeB._proxy)) {
        return false;
      }
    } else if (!Object.is(objA[currentKey], objB[currentKey])) {
      return false;
    }
  }

  return true;
}

const propsProxyHandler = {
  get(target, key) {
    const value = target[key];        
    return getNode(value)?._copy ?? value;
  }
}

// TODO rename `component` to `render`, explain to user it's not a component, verify there are no static props other then usual
export function observer(component) {
  if (process.env.NODE_ENV !== 'production' && component instanceof Component) {
    throw new Error(`\`observer\` does NOT support class components.`);
  }
  if (process.env.NODE_ENV !== 'production' && typeof component !== 'function') {
    throw new Error(`\`observer\` arg must be a function.`);
  }
  const context = getContext();
  if (context.ssr) return component;

  function ObserverComponent(props, refOrCtx) {
    // Optimization: 
    // since we don't need state, use that slot as ref
    const [inst, forceUpdate] = useState({ observer: null });

    if (!inst.observer) {
      inst.observer = new Observer(() => forceUpdate({ observer: inst.observer }));
      // The observer will dispose itself later, unless disposal is cancelled by layout effect.
      // If layout effect runs, the component is surely mounted. 
      // Layout effect is guaranteed to run synchronously - always before deferred disposer.      
      inst.observer.scheduleDispose();
    }

    useLayoutEffect(() => {
      inst.observer.cancelDispose();
      return () => inst.observer.dispose();
    }, []);    

    if (inst.observer.props !== props) {      
      inst.observer.props = props;  
    } 

    // Render
    const phase = context.phase;
    if (phase !== PHASE_READS) {
      beginReads();
    }                     
    inst.observer.beginSubscriptions();
    try {
      return component(inst.observer.propsProxy, refOrCtx);
    } finally {
      inst.observer.endSubscriptions();
      if (phase === PHASE_IDLE) {
        // Only end reads if we started them
        endReads();
      }
    }
  }

  if (component.name) {
    ObserverComponent.displayName = component.name;
  }

  return memo(ObserverComponent, propsEquals);
}

export function useObservableStore() {
  const context = getContext();
  const { observer } = context;
  if (!observer) {
    throw new Error(`\`useObservableStore\` can only be used in \`observer\``)
  }
  const store = useContext(StoreContext);
  return [store.getSnapshot(), store.dispatch];
  const [snapshot, setSnapshot] = useState(store.getSnapshot());

  useEffect(() => {
    if (store._root._copy !== snapshot) {
      // State changed before mount, forceUpdate
      setSnapshot(store.getSnapshot());
    }
    // subscribe to observer
    return observer.subscribe(() => setSnapshot(store.getSnapshot()));
  }, [store]);

  return snapshot;
}

// Basically useless, just better error
// TODO delete and improve the accessed observable outside observer error
export function useObserverEffect(effect, deps) {
  if (__DEV__) {
    if (!getContext().observer) {
      throw new Error(`\`useObserverEffect\` can only be used in \`observer\``)
    }    
    if (deps) {
      for (const dep of deps) {
        if (getNode(dep)) {
          throw new Error(`
            Do not pass \`observables\` as hook dependencies.
            Prefer passing primitive values, eg: \`[object]\` => \`[object.x]\`.
            Or use eg: \`[unwrap(array)]\`
            `
          );
        }
      }
    }  
  }
  return useEffect(effect, deps);
}

export function observe(fn) {
  function effect(observer) {
    observer.beginSubscriptions()
    try {
      fn(observer)
    } finally {
      observer.endSubscriptions();
    }
  }
  const observer = new Observer(effect);
  return observer;
}

export class Store {
  constructor(state = {}) {
    this._listenersScheduled = false;
    this._listeners = [];
    this.dispatch = this.dispatch.bind(this);
    this._version = Symbol();
    if (!_isSupported(state)) {
      throw new Error('State must be either plain object or array.')
    }
    // TODO configurable root key (in case of more stores)
    dispatch(() => {
      this._root = new Node(this, state, storeId, null);
    })
    storeId++;
  }
  getSnapshot() {
    this._version = Symbol();
    return this._root._copy;
  }
  scheduleListeners() {
    if (!this._listenersScheduled) {
      queueMicrotask(() => {
        this._listenersScheduled = false;
        this._listeners.forEach(listener => listener())
      })
      this._listenersScheduled = true;
    }
  }
  subscribe(listener) {
    this._listeners.add(listener);
    return function unsubscribe() {
      this._listeners.delete(listener);
    }
  }
  getState() {
    return this._root._proxy;
  }
  getVersion() {
    return this._version;
  }
  dispatch(fn) {
    dispatch(() => fn(this._root._proxy));
  }
}

// helper for has/get trap
function _accessKey(target, key) {
  // symbols not supported atm    
  if (typeof key !== 'symbol') {
    const node = getNode(target);
    // Array doesn't report individual keys
    key = Array.isArray(target) ? ownKeys : key;
    const observable = getObservable(node, key);
    reportAccess(observable);
  }
}

export const copyProxyHandler = {
  set(target, key, value, reciever) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Cannot set property \'', key, '\' of snapshot ', reciever, ': Snapshots are immutable.');
    }
    return false;
  },
  deleteProperty(target, key) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Cannot delete property \'', key, '\' of snapshot ', target, ': Snapshots are immutable.');
    }
    return false;
  },
  has(target, key) {
    _accessKey(target, key);
    return Reflect.has(target, key);
  },
  get(target, key, reciever) {
    if (key === proxyTargetSymbol) {
      return target;
    }
    _accessKey(target, key);
    return Reflect.get(target, key, reciever);
  },
  ownKeys(target) {
    const node = getNode(target);
    const observable = getObservable(node, keysKey);
    reportAccess(observable)
    return Reflect.ownKeys(target);
  }
}

export const stateProxyHandler = {
  set(target, key, value, receiver) {
    // console.debug(`set(${target}, ${key}, ${value})`);
    const node = getNode(target);
    // Check prop on copy (rather than target), because the trap is used also for initialization
    // (could be avoided by copying original object first, rather than proxying it directly)
    const hasKey = node._copy[proxyTargetSymbol].hasOwnProperty(key);
    if (hasKey && target[key] === value) return true;
    // It must not be state or snapshot
    if (getNode(value)) throw new Error(`Unable to assign value to ${this.path}.${key}: value must not be existing node. State must be tree, graphs are not supported.`);

    //console.log(`${this._path.join('.')}=${JSON.stringify(value)}`)               

    const store = node._store;
    const copy = node.getCopy();
    if (_isSupported(value)) {
      const valueNode = new Node(store, value, key, node);
      target[key] = valueNode._proxy;
      copy[proxyTargetSymbol][key] = valueNode._copy;
    } else {      
      target[key] = value;
      copy[proxyTargetSymbol][key] = value;
    }
    // Report change    
    const isArray = Array.isArray(target);
    // array doesn't report individual keys
    if (isArray || !hasKey) {
      reportChange(getObservable(node, keysKey));
    }
    if (!isArray) {
      reportChange(getObservable(node, key));
    }

    // TODO return result of Reflect.set
    return true;
  },
  deleteProperty(target, key) {
    const node = getNode(target);
    const copy = node.getCopy();
    if (target.hasOwnProperty(key)) {
      // Nothing to report if key doesn't exists
      reportChange(getObservable(node, keysKey));
      if (!Array.isArray(target)) {
        // Array doesn't report individual keys
        reportChange(getObservable(node, key));
      }
    }
    return Reflect.deleteProperty(target, key) && Reflect.deleteProperty(copy[proxyTargetSymbol], key);
  }
}

export class Node {
  constructor(store, target, key, parent) {
    Object.defineProperty(target, nodeSymbol, {
      value: this
    })
    this._store = store;
    this._target = target;
    //this._version = store._version;
    this._version = getContext().version;
    this._parent = parent;
    this._key = key;
    this._path = parent ? `${parent._path}.${key}` : key;
    this._proxy = new Proxy(this._target, stateProxyHandler);
    this._copy = Array.isArray(this._target) ? [] : {};
    Object.defineProperty(this._copy, nodeSymbol, { value: this });
    this._copy = new Proxy(this._copy, copyProxyHandler);
    const keys = Array.isArray(this._target) ? this._target.keys() : Object.keys(this._target);
    for (const key of keys) {
      // Assign to proxy, so the values are converted to Node by proxyHandler.set
      this._proxy[key] = this._target[key];
    }
  }
  getCopy() {
    const globalVersion = getContext().version;
    if (this._version !== globalVersion) {
      // Create copy if version diverges
      //console.log(`copy ${this._path.join('.')} ${JSON.stringify(this._copy)}`)
      // Schedule store listeners
      this._store.scheduleListeners();
      // Notify subtree observers
      reportChange(getObservable(this, subtreeKey));
      // Copy  
      // copy target directly instead of proxy for better perf
      const copyProxyTarget = this._copy[proxyTargetSymbol];
      this._copy = Array.isArray(copyProxyTarget) ? [...copyProxyTarget] : { ...copyProxyTarget };
      Object.defineProperty(this._copy, nodeSymbol, { value: this });
      this._copy = new Proxy(this._copy, copyProxyHandler);

      // update version
      this._version = globalVersion;
      // propagate 
      if (this._parent) {
        // Assign directly to target instead of proxy:
        // - perf
        // - proxy prevents writes        
        this._parent.getCopy()[proxyTargetSymbol][this._key] = this._copy;
      }
    }
    return this._copy;
  }
}