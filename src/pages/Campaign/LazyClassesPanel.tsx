import React, { Suspense } from 'react';

const ClassesPanel = React.lazy(() => import('./Campaign'));

export default function LazyClassesPanel(props: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <Suspense fallback={<div className="loading">Carregando classes…</div>}>
      <ClassesPanel {...props} />
    </Suspense>
  );
}
