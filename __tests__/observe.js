import { jest, expect, test } from '@jest/globals';
import { Store, getNode, getContext, observe, getObservable } from '../index.js';

test("simple", async () => {
  const store = new Store();
  const state = store.getState()
  state.a = "a0";
  state.b = "b0";
  const snapshots = [];  
  const context = getContext();
  const expectedObservables = new Set();
  const expectedScheduledObservers = new Set();
  expect(context.observer).toBe(null);
  const observer = observe(observer => {        
    expect(context.observer).toBe(observer);
    const snapshot = store.getSnapshot();     
    snapshots.push(snapshot);
    snapshot.a;
    expectedObservables.add(getObservable(getNode(snapshot), 'a'));
    expect(observer.newObservables).toEqual(expectedObservables);
    //console.log(context.observersMap);
  })
  expect(context.observer).toBe(null);
  expect(observer.observables).toEqual(expectedObservables);
  // "b" not accessed, should not schedule
  state.b = "b1";
  expect(context.observer).toBe(null);
  expect(observer.observables).toEqual(expectedObservables);
  // "a" accessed, should schedule
  state.a = "a1";
  console.log(getContext());
  expectedScheduledObservers.add(observer);
  expect(context.scheduledObservers).toEqual(expectedScheduledObservers);  
  await Promise.resolve(); // wait for microtask
  expectedScheduledObservers.delete(observer);
  expect(context.scheduledObservers).toEqual(expectedScheduledObservers);
  // dispose
  observer.dispose();
  expect(context.observersMap.size).toBe(0);
  state.a = "a2";
  expect(context.observersMap.size).toBe(0);
  
  context.requireObserver = false;
  expect(snapshots).toEqual([
    { a: "a0", b: "b0" },
    { a: "a1", b: "b1" },
  ])
  context.requireObserver = true;
});