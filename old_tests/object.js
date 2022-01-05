import { jest, expect, test } from '@jest/globals';
import { fork, createState, _getHandler } from '../index.js';

function copyDeep(thing) {
    return JSON.parse(JSON.stringify(thing));
}

test("set", () => {    
  
  
  
})

test("delete", () => {  
  const original = { p1: "p1" };  
  const state = createState(copyDeep(original))
  const plain = copyDeep(original);

  expect(state).toEqual(original);
  expect(plain).toEqual(original);

  delete plain.p1;
  delete state.p1;
  
  expect(state).toEqual(plain);

  const copy = fork(state);
  expect(copy).toEqual(plain);      
})