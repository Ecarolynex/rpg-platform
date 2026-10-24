import React, { Suspense } from 'react';

const ShopPanel = React.lazy(() => import('./Shop'));

export default function LazyShopPanel(props: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <Suspense fallback={<div className="loading">Carregando loja…</div>}>
      <ShopPanel {...props} />
    </Suspense>
  );
}
