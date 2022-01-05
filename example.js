import { render } from 'react-dom';
import { createElement as el } from 'react';
import { createStore, getContext, observer, StoreProvider, useObservableStore } from './index.js';

let id = 0;

const store = createStore({
  todos: {},  
});

const addTodo = todo => state => {
  state.todos[todo.id] = todo;
}

const deleteTodo = todoId => state => {
  console.log(state);
  delete state.todos[todoId];
}

const Todo = observer(function Todo({ todo }) {  
  const [,dispatch] = useObservableStore();
  const { id, text } = todo;

  const onDeleteTodoClick = event => {
    // mutable(todo).id;
    // when outside READS, we could delegate reads to state proxy to get the most up to date state
    // but then we can't protect agains forgetting observer...
    // perhpas we could have `useObserverCallback` that would disable the warning, but then its mandatory...
    // we still need `useObserverCallback` because of the deps - the cool thing is we can just ignore observables in deps list, instead of unwraping them    
    // note you stil cannot write when IDLE    
    // note in react callbacks may be used also for reads, but that shouldn't matter ... when in reads the behavior doesn't change
    // what about sending these to non-observers as render prop - it would fail and wouldnt warn...
    // ok so `useWriteCallback`,`useRenderCallback`, `useRead`,`useView`,`useAction`, `useHandler/Listener`(to specific )
    // `useAction` could dispatch returned value, eg: useAction(event => deleteTodo(id)) or `useDispatch()`
    // `useEffect` still needs `dispatch`
    dispatch(deleteTodo(id));
  }

  return el('div', {}, 
    id, ' ', text,
    el('button', { type: 'button', onClick: onDeleteTodoClick }, 'Delete'),    
  )
})

const TodoList = observer(function TodoList() {
  const [state] = useObservableStore();

  return Object.values(state.todos).map(todo => el(Todo, { key: todo.id, todo }));
});

const TodoApp = observer(function TodoApp() {  
  const [,dispatch] = useObservableStore();

  const onAddTodoClick = event => {    
    const text = window.prompt('Text');
    dispatch(addTodo({ id: id++, text }));
  }

  return el('div', {},  
    el(TodoList),
    el('button', { type: 'button', onClick: onAddTodoClick }, 'Add TODO'),
  )
});

render(
  el(StoreProvider, { store },
    el(TodoApp),
  ),
  document.getElementById('root')
);
