import { jest, expect, test } from '@jest/globals';
import { Store, getNode, getContext, observer, useObservableStore, Provider, dispatch, unwrap } from '../index.js';
import Renderer from 'react-test-renderer';
import React, { useState, createElement as el, useMemo, useEffect, useLayoutEffect } from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { OBSERVABLE_ACCESS_OUTSIDE_OBSERVER } from '../error-codes.js';

test('observer is reactive', async () => {
  const store = new Store({ a: 0 });
  let renderCount = 0;

  const Test = observer(function Test() {
    renderCount++;
    const [state, dispatch] = useObservableStore();
    return state.a;
  });

  let renderer;
  Renderer.act(() => {
    renderer =Renderer.create(
      el(Provider, { store },
        el(Test),
      ),
    );
  })

  expect(renderCount).toBe(1);

  Renderer.act(() => {
    store.dispatch(state => {
      state.a++;
    })
  })

  expect(renderCount).toBe(2);

  await Renderer.act(async () => {
    store.getState().a++;
    await Promise.resolve(); // wait for microtask
  })

  expect(renderCount).toBe(3);

  renderer.unmount();
});

test('observer ignores deep mutations', async () => {
  const store = new Store({ o: { x: 0 } });
  let renderCount = 0;

  const Test = observer(function Test() {
    renderCount++;
    const [state, dispatch] = useObservableStore();
    state.o;
    return null;
  });

  let renderer;
  Renderer.act(() => {
    renderer = Renderer.create(
      el(Provider, { store },
        el(Test),
      ),
    );
  })

  expect(renderCount).toBe(1);

  Renderer.act(() => {
    store.dispatch(state => {
      state.o.x++;
    })
  })

  expect(renderCount).toBe(1);
  
  renderer.unmount();
});

test('observer memo treats copies of the same object as identical', async () => {
  const store = new Store({ o: { x: 0, y: 0 } });
  let parentRenderCount = 0;
  let childRenderCount = 0;

  const Child = observer(function Child({ o }) {
    childRenderCount++;
    return o.x;
  });

  const Parent = observer(function Parent() {
    parentRenderCount++;
    const [state, dispatch] = useObservableStore();
    return el(Child, { o: state.o });
  });

  let renderer;
  Renderer.act(() => {
    renderer = Renderer.create(
      el(Provider, { store },
        el(Parent),
      ),
    );
  })

  expect(parentRenderCount).toBe(1);
  expect(childRenderCount).toBe(1);

  Renderer.act(() => {
    store.dispatch(state => {
      state.o.y++; // results in a new copy of `o`
    })
  })

  expect(parentRenderCount).toBe(1);
  expect(childRenderCount).toBe(1);

  Renderer.act(() => {
    store.dispatch(state => {
      state.o = { x: 0, y: 0 }; // copy of different object
    })
  })

  expect(parentRenderCount).toBe(2);
  expect(childRenderCount).toBe(2);

  renderer.unmount();
});

test('useMemo works with observable deps', async () => {
  const store = new Store({ o: { x: 0 } });

  const Test = observer(function Test() {    
    const [state, dispatch] = useObservableStore();
    // This wouldn't work with mutable state (MobX)
    const x = useMemo(() => state.o.x, [state.o])
    return x;
  });

  let renderer;
  Renderer.act(() => {
    renderer = Renderer.create(
      el(Provider, { store },
        el(Test),
      ),
    );
  })

  expect(renderer.toJSON()).toBe('0');

  Renderer.act(() => {
    store.dispatch(state => {
      state.o.x++;
    })
  })

  expect(renderer.toJSON()).toEqual('1');

  renderer.unmount();
});

test('accessing observables in non-observer throws', async () => {
  const store = new Store({ o: { x: 0 } });  
  let renderCount = 0;
  let errorRegex = new RegExp(`^${OBSERVABLE_ACCESS_OUTSIDE_OBSERVER}:`);

  const Parent = observer(function Parent() {    
    const [state, dispatch] = useObservableStore();        
    return el(NonObserver, { state });
  });

  function NonObserver({ state }) {
    renderCount++;
    expect(() => {
      state.o;
    }).toThrow(errorRegex);
    return null;
  }

  let renderer;
  Renderer.act(() => {
    renderer = Renderer.create(
      el(Provider, { store },
        el(Parent),
      ),
    );
  })

  expect(renderCount).toBe(1); 
  
  renderer.unmount();
});

test('use(layout)Effect throws when acessing observables', async () => {
  const store = new Store({ o: { x: 0 } });  
  let effectCount = 0;
  let layoutEffectCount = 0;
  let errorRegex = new RegExp(`^${OBSERVABLE_ACCESS_OUTSIDE_OBSERVER}:`);

  const Test = observer(function Test() {    
    const [state, dispatch] = useObservableStore();
    useEffect(() => {
      effectCount++;      
      expect(() => {
        state.o;
      }).toThrow(errorRegex);
    });
    useLayoutEffect(() => {
      layoutEffectCount++;
      expect(() => {
        state.o;
      }).toThrow(errorRegex);           
    });
    return null;
  });

  let renderer;
  Renderer.act(() => {
    renderer = Renderer.create(
      el(Provider, { store },
        el(Test),
      ),
    );
  })

  expect(effectCount).toBe(1);
  expect(layoutEffectCount).toBe(1);

  renderer.unmount();
});

test('unwrap subscribes for deep mutations', async () => {
  const store = new Store({ o: { x: 0 } });
  let renderCount = 0;  
  
  const Test = observer(function Test() {    
    renderCount++;
    const [state, dispatch] = useObservableStore();
    unwrap(state);
    return null;
  });
  
  let renderer;
  Renderer.act(() => {
    renderer = Renderer.create(
      el(Provider, { store },
        el(Test),
      ),
    );
  })
  
  expect(renderCount).toBe(1);
  
  Renderer.act(() => {
    store.dispatch(state => {
      state.o.x++;
    })
  })

  expect(renderCount).toBe(2);
  
  renderer.unmount();
});

// useEffect throws, non-observer throws, dispatch from useObserverEffect