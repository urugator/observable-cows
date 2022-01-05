import { jest, expect, test } from '@jest/globals';
import { fork, createState, _getHandler } from '../index.js';

test.skip("foo", () => {
  const original = {
    p1: "p1.0",
    o1: {      
      p1: "o1.p1.0",
      o1: {
        p1: "o1.o1.p1.0"
      },
      o2: {},
    },    
    o2: {},
  }
  
  const plain = JSON.parse(JSON.stringify(original)); // deep copy
  const state = createState(original)
  
  expect(state).toEqual(original);
  
  expect(plain).toEqual(plain);  
  expect(_getHandler(state)._copy).toEqual(state);  
  expect(_getHandler(state)._version).toBe(0);
  expect(_getHandler(state.o1)._version).toBe(0);
  expect(_getHandler(state.o1.o1)._version).toBe(0);
  expect(_getHandler(state.o1.o2)._version).toBe(0);
  expect(_getHandler(state.o2)._version).toBe(0);
  // mutation before fork shouldn't create copy
  const copy1 = _getHandler(state)._copy;
  plain.p1 = "p1.1";
  state.p1 = "p1.1";
  plain.o1.p1 = "o1.p1.1";  
  state.o1.p1 = "o1.p1.1";  
  plain.o1.o1.p1 = "o1.o1.p1.1";  
  state.o1.o1.p1 = "o1.o1.p1.1";  
  expect(state).toEqual(plain);  
  expect(_getHandler(state)._copy).toEqual(state);
  expect(_getHandler(state)._copy).toBe(copy1);
  expect(_getHandler(state.o1)._copy).toBe(copy1.o1);
  expect(_getHandler(state.o1.o1)._copy).toBe(copy1.o1.o1);
  expect(_getHandler(state.o1.o2)._copy).toBe(copy1.o1.o2);
  expect(_getHandler(state.o2)._copy).toBe(copy1.o2);
  expect(_getHandler(state)._version).toBe(0);
  expect(_getHandler(state.o1)._version).toBe(0);
  expect(_getHandler(state.o1.o1)._version).toBe(0);
  expect(_getHandler(state.o1.o2)._version).toBe(0);
  expect(_getHandler(state.o2)._version).toBe(0);  
  // fork shouldn't create copy until mutation
  const copy = fork(state);  
  expect(copy).toBe(copy1);
  expect(copy).toEqual(state);  
  expect(state).toEqual(plain);  
  expect(_getHandler(state)._treeVersion).toBe(1)
  expect(_getHandler(state)._copy).toEqual(state);
  expect(_getHandler(state)._copy).toBe(copy1);
  expect(_getHandler(state.o1)._copy).toBe(copy1.o1);
  expect(_getHandler(state.o1.o1)._copy).toBe(copy1.o1.o1);
  expect(_getHandler(state.o1.o2)._copy).toBe(copy1.o1.o2);
  expect(_getHandler(state.o2)._copy).toBe(copy1.o2);
  expect(_getHandler(state)._version).toBe(0);
  expect(_getHandler(state.o1)._version).toBe(0);
  expect(_getHandler(state.o1.o1)._version).toBe(0);
  expect(_getHandler(state.o1.o2)._version).toBe(0);
  expect(_getHandler(state.o2)._version).toBe(0);  
  // mutation should only copy relevant branch  
  plain.o1.o1.p1 = "o1.o1.p1.2";
  state.o1.o1.p1 = "o1.o1.p1.2";        
  expect(state).toEqual(plain);  
  expect(_getHandler(state)._copy).toEqual(state);
  expect(_getHandler(state)._copy).not.toBe(copy1);
  expect(_getHandler(state.o1)._copy).not.toBe(copy1.o1);
  expect(_getHandler(state.o1.o1)._copy).not.toBe(copy1.o1.o1);
  expect(_getHandler(state.o1.o2)._copy).toBe(copy1.o1.o2);
  expect(_getHandler(state.o2)._copy).toBe(copy1.o2);
  expect(_getHandler(state)._version).toBe(1);
  expect(_getHandler(state.o1)._version).toBe(1);
  expect(_getHandler(state.o1.o1)._version).toBe(1);
  expect(_getHandler(state.o1.o2)._version).toBe(0);
  expect(_getHandler(state.o2)._version).toBe(0);  
  // subsequent mutation shouldn't copy until next fork
  const copy2 = _getHandler(state)._copy;
  plain.o1.o2.p1 = "o1.o2.p1.0";
  state.o1.o2.p1 = "o1.o2.p1.0";
  expect(state).toEqual(plain);  
  expect(_getHandler(state)._copy).toEqual(state);
  expect(_getHandler(state)._copy).toBe(copy2);
  expect(_getHandler(state.o1)._copy).toBe(copy2.o1);
  expect(_getHandler(state.o1.o1)._copy).toBe(copy2.o1.o1);
  expect(_getHandler(state.o1.o2)._copy).toBe(copy2.o1.o2);
  expect(_getHandler(state.o2)._copy).toBe(copy2.o2);
  expect(_getHandler(state)._version).toBe(1);
  expect(_getHandler(state.o1)._version).toBe(1);
  expect(_getHandler(state.o1.o1)._version).toBe(1);
  expect(_getHandler(state.o1.o2)._version).toBe(1);
  expect(_getHandler(state.o2)._version).toBe(0);  
})