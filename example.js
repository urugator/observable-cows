import { render } from 'react-dom';
import { createElement as el, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createStore, getContext, observer, StoreProvider, useObservableStore } from './index.js';

let globalId = 0;

const useUpdateCounter = () => {
  const countRef = useRef(0);
  countRef.current++;  
  return countRef.current;
}

const store = createStore({
  todos: {},
});

const addTodo = todo => state => {
  state.todos[todo.id] = todo;
}

const deleteTodo = todoId => state => {  
  delete state.todos[todoId];
}

const toggleTodoDone = todoId => state => {
  state.todos[todoId].done = true;
}

const setTodoDone = ({ todoId, done }) => state => {
  state.todos[todoId].done = done;
  console.log('when set', state.todos[todoId].done);
}

function UpdateCounter() {
  const countRef = useRef(0);
  countRef.current++; 
  return el('span', { className: 'updateCounter' }, countRef.current);
}

const Todo = observer(function Todo({ todo }) {  
  const [,dispatch] = useObservableStore();  
  const { id, text, done } = todo;  
  
  const onDeleteTodoClick = useCallback(event => {        
    dispatch(deleteTodo(id));
    // Following would throw: "Observable `0.todos[todo.id].id` was accessed outside observer."
    // dispatch(deleteTodo(todo.id));
  }, [id])

  const onTodoDoneChange = useCallback(event => {    
    dispatch(setTodoDone({ 
      todoId: id, 
      done: event.target.checked,
    }));    
  }, [id])

  return el('li', {}, 
    el('input', { type: 'checkbox', checked: done, onChange: onTodoDoneChange }),
    el('span', {}, `${id} ${text}`, UpdateCounter()),    
    el('button', { type: 'button', onClick: onDeleteTodoClick }, 'Delete'),   
  )
})

const TodoList = observer(function TodoList() {
  const [state] = useObservableStore();  

  return el('div', {}, 
    el('h2', {}, `TodoList`, el(UpdateCounter)),
    el('ul', {}, 
      Object.values(state.todos).map(todo => el(Todo, { key: todo.id, todo })),
    )    
  );
});

const TodoApp = observer(function TodoApp() {  
  const [,dispatch] = useObservableStore();  

  const onAddTodoClick = event => {    
    const text = window.prompt('Text');
    if (text === null) return;
    dispatch(addTodo({ id: globalId++, text, done: false }));
  }

  return el('div', {},  
    el('h1', {}, `TodoApp`, el(UpdateCounter)),
    el(TodoList),
    el('button', { type: 'button', onClick: onAddTodoClick }, 'Add new'),
  )
});

render(
  el(StoreProvider, { store },
    el(TodoApp),
  ),
  document.getElementById('root')
);
