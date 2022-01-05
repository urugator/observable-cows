import { jest, expect, test } from '@jest/globals';
import { Store, getNode, getContext } from '../index.js';

getContext().requireObserver = false;

test("foo", () => {
  
  const original = {
    p1: 0,
    o1: {      
      p1: 0,
      o1: {
        p1: 0
      },
      o2: {},
    },    
    o2: {},
  }
  
  
  const plain = JSON.parse(JSON.stringify(original)); // deep copy
  const store = new Store(original);
  const state = store.getState();
  
  expect(state).toEqual(original);
  expect(plain).toEqual(plain);  
  const version0 = store.getVersion();
  const copy0 = getNode(state)._copy;  
  expect(copy0).toEqual(state);  
  expect(getNode(state)._version).toBe(version0);
  expect(getNode(state.o1)._version).toBe(version0);
  expect(getNode(state.o1.o1)._version).toBe(version0);
  expect(getNode(state.o1.o2)._version).toBe(version0);
  expect(getNode(state.o2)._version).toBe(version0);  
  // mutation before getSnapshot shouldn't create copy
  plain.p1 = 1;
  state.p1 = 1;
  plain.o1.p1 = 1;  
  state.o1.p1 = 1;  
  plain.o1.o1.p1 = 1;  
  state.o1.o1.p1 = 1;  
  expect(state).toEqual(plain);
  expect(store.getVersion()).toBe(version0);
  expect(getNode(state)._copy).toEqual(state);
  expect(getNode(state)._copy).toBe(copy0);
  expect(getNode(state.o1)._copy).toBe(copy0.o1);
  expect(getNode(state.o1.o1)._copy).toBe(copy0.o1.o1);
  expect(getNode(state.o1.o2)._copy).toBe(copy0.o1.o2);
  expect(getNode(state.o2)._copy).toBe(copy0.o2);
  expect(getNode(state)._version).toBe(version0);
  expect(getNode(state.o1)._version).toBe(version0);
  expect(getNode(state.o1.o1)._version).toBe(version0);
  expect(getNode(state.o1.o2)._version).toBe(version0);
  expect(getNode(state.o2)._version).toBe(version0);  
  // getSnapshot shouldn't create copy until mutation
  const copy1 = store.getSnapshot();  
  const version1 = store.getVersion();
  expect(copy1).toBe(copy0);
  expect(copy1).toEqual(state);
  expect(state).toEqual(plain);
  expect(version1).not.toBe(version0);
  expect(getNode(state.o1)._copy).toBe(copy0.o1);
  expect(getNode(state.o1.o1)._copy).toBe(copy0.o1.o1);
  expect(getNode(state.o1.o2)._copy).toBe(copy0.o1.o2);
  expect(getNode(state.o2)._copy).toBe(copy0.o2);  
  expect(getNode(state.o1)._version).toBe(version0);
  expect(getNode(state.o1.o1)._version).toBe(version0);
  expect(getNode(state.o1.o2)._version).toBe(version0);
  expect(getNode(state.o2)._version).toBe(version0);  
  // mutation should only copy relevant branch  
  plain.o1.o1.p1 = 2;
  state.o1.o1.p1 = 2;  
  const copy2 = getNode(state)._copy;
  expect(state).toEqual(plain);
  expect(copy2).toEqual(state);
  expect(copy2).not.toBe(copy1);  
  expect(getNode(state)._copy).not.toBe(copy1); // not
  expect(getNode(state.o1)._copy).not.toBe(copy1.o1); // not
  expect(getNode(state.o1.o1)._copy).not.toBe(copy1.o1.o1); // not
  expect(getNode(state.o1.o2)._copy).toBe(copy1.o1.o2);
  expect(getNode(state.o2)._copy).toBe(copy1.o2);
  expect(getNode(state)._version).toBe(version1);
  expect(getNode(state.o1)._version).toBe(version1);
  expect(getNode(state.o1.o1)._version).toBe(version1);
  expect(getNode(state.o1.o2)._version).toBe(version0);
  expect(getNode(state.o2)._version).toBe(version0);    
  // subsequent mutation shouldn't copy until next getSnapshot  
  plain.o1.o2.p1 = 3;
  state.o1.o2.p1 = 3;
  expect(state).toEqual(plain);  
  expect(getNode(state)._copy).toEqual(state);
  expect(getNode(state)._copy).toBe(copy2);
  expect(getNode(state.o1)._copy).toBe(copy2.o1);
  expect(getNode(state.o1.o1)._copy).toBe(copy2.o1.o1);
  expect(getNode(state.o1.o2)._copy).toBe(copy2.o1.o2);
  expect(getNode(state.o2)._copy).toBe(copy1.o2); // unchanged
  expect(getNode(state)._version).toBe(version1);
  expect(getNode(state.o1)._version).toBe(version1);
  expect(getNode(state.o1.o1)._version).toBe(version1);
  expect(getNode(state.o1.o2)._version).toBe(version1);
  expect(getNode(state.o2)._version).toBe(version0); // unchanged
})