import { render } from 'react-dom';
import { createElement as el } from 'react';

function App() {
  return 'Hello World';
}

render(el(App), document.getElementById('root'));
