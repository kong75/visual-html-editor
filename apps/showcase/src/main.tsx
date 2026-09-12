import React from 'react';
import ReactDOM from 'react-dom/client';
import '@visual-html/react/styles.css';
import { App } from './app';
import './showcase.css';
import './landing.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
