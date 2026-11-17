import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '@/components/commerce';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Order } from '@/types/api';
import { isHiddenOrderError, rememberOrderToken, useOrderWithAccess } from './parts/orderAccess';
import { OrderSkeleton, OrderUnavailable } from './parts/OrderStates';
import { OrderView } from './parts/OrderView';

/**
 * /order/:orderNumber: the confirmation after checkout (?new=1) and the order page from then on.
 * Opens with the token in the URL (?token=, remembered on this device), a token this device
 * remembers, or as the signed-in owner.
 */
export default function OrderPage() {
  const { orderNumber = '' } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const queryClient = useQueryClient();
  const { query, token, queryKey } = useOrderWithAccess(orderNumber);
  const { data: order, error, isPending, refetch } = query;

  useDocumentMeta({
    title: order ? (isNew && order.status !== 'pending_payment' ? 'Order placed' : `Order ${order.orderNumber}`) : 'Your order',
    noindex: true,
  });

  const onOrderChange = useCallback(
    (updated: Order) => {
      queryClient.setQueryData(queryKey, updated);
      if (updated.accessToken) rememberOrderToken(updated.orderNumber, updated.accessToken);
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.orders() });
    },
    [queryClient, queryKey],
  );

  return (
    <div className="container-page">
      {isPending ? (
        <OrderSkeleton />
      ) : error ? (
        isHiddenOrderError(error) ? (
          <OrderUnavailable orderNumber={orderNumber} />
        ) : (
          <div className="py-10">
            <ErrorState error={error} onRetry={() => void refetch()} title="Could not load this order" />
          </div>
        )
      ) : (
        <OrderView order={order} token={token} confirmation={isNew} onOrderChange={onOrderChange} />
      )}
    </div>
  );
}
