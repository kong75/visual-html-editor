import { lazy, Suspense, useEffect, useState } from 'react';
import { LandingPage } from './landing-page';
import { BrandMark } from '../../../packages/react/src/brand-mark';

const EditorPage = lazy(() => import('./editor-page').then((module) => ({ default: module.EditorPage })));
const ControlledPage = lazy(() => import('./controlled-page').then((module) => ({ default: module.ControlledPage })));

type Route = 'landing' | 'editor' | 'controlled';

function routeFromLocation(): Route {
  if (window.location.hash.startsWith('#/controlled')) return 'controlled';
  return window.location.hash.startsWith('#/editor') ? 'editor' : 'landing';
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation);

  useEffect(() => {
    const handleRoute = () => setRoute(routeFromLocation());
    window.addEventListener('hashchange', handleRoute);
    return () => window.removeEventListener('hashchange', handleRoute);
  }, []);

  useEffect(() => {
    document.title = route === 'landing' ? 'Visual HTML — Make HTML feel alive.' : 'Visual HTML Editor';
  }, [route]);

  return (
    <Suspense fallback={<div className="route-loading" role="status"><span><BrandMark /></span><p>Opening your workspace…</p></div>}>
      {route === 'controlled' ? <ControlledPage /> : route === 'editor' ? <EditorPage /> : <LandingPage />}
    </Suspense>
  );
}
