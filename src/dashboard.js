import React from 'react';
import ReactDOM from 'react-dom';

import DashboardPage from './components/DashboardPage';
import ErrorBoundary from './components/ErrorBoundary';

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary className="mt-3">
    <DashboardPage {...reactProps} />
  </ErrorBoundary>
);
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
