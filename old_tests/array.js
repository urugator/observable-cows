import { expect, test } from '@jest/globals';
import { fork, createState, _getHandler } from '../index.js';

function copyDeep(thing) {
  return JSON.parse(JSON.stringify(thing));
}

test("assigment", () => {
  const original = [0, 1, 2];
  const state = createState(copyDeep(original))
  const plain = copyDeep(original);

  expect(state).toEqual(original);
  expect(plain).toEqual(original);

  plain[1] = 11;
  plain[2] = 22;
  state[1] = 11;  
  state[2] = 22;

  expect(state).toEqual(plain);

  const copy = fork(state);
  expect(copy).toEqual(plain);
  expect(copy.length).toEqual(plain.length);
})
// push, pop, shift, unshift
test("splice", () => {
  const original = [0, 1, 2, 4];
  const state = createState(copyDeep(original))
  const plain = copyDeep(original);

  expect(state).toEqual(original);
  expect(plain).toEqual(original);

  plain.splice(1, 1, 10);
  state.splice(1, 1, 10);

  expect(state).toEqual(plain);

  let copy = fork(state);
  expect(copy).toEqual(plain);
  expect(copy.length).toEqual(plain.length);

  plain.splice(-1, 0, 7, 8, 9);
  state.splice(-1, 0, 7, 8, 9);

  expect(state).toEqual(plain);

  copy = fork(state);
  expect(copy).toEqual(plain);
  expect(copy.length).toEqual(plain.length);

  plain.splice(0);
  state.splice(0);

  expect(state).toEqual(plain);

  copy = fork(state);
  expect(copy).toEqual(plain);
  expect(copy.length).toEqual(plain.length);
})