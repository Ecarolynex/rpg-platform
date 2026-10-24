import React, { Suspense } from 'react';

const BestiaryPanel = React.lazy(() => import('./Bestiary'));

export default function LazyBestiaryPanel(props: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <Suspense fallback={<div className="loading">Carregando bestiário…</div>}>
      <BestiaryPanel {...props} />
    </Suspense>
  );
}
