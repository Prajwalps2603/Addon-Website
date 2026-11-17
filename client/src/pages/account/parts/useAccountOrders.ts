import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { rememberOrderTokens } from './orders';

/** The signed-in shopper's orders, newest first. Each order's access token is kept on this device for the order page. */
export function useAccountOrders() {
  const query = useQuery({
    queryKey: queryKeys.account.orders(),
    queryFn: ({ signal }) => api.account.orders({ signal }),
  });
  const orders = query.data;
  useEffect(() => {
    if (orders) rememberOrderTokens(orders);
  }, [orders]);
  return query;
}
