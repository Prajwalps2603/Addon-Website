import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminOrderUpdate, Order } from '@/types/api';

export interface OrderUpdateVariables {
  body: AdminOrderUpdate;
  /** The toast on success, e.g. "Marked packed". */
  success: string;
  description?: string;
}

/**
 * Every change to an order goes through here: the server writes the event row, emails the
 * customer on a status change and restores stock on cancel or return. The detail is replaced
 * with the server's answer and every list that could show this order is refreshed.
 */
export function useOrderUpdate(orderNumber: string, onDone?: (order: Order) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body }: OrderUpdateVariables) => api.admin.orders.update(orderNumber, body),
    onSuccess: (order, { success, description }) => {
      queryClient.setQueryData(queryKeys.admin.orders.detail(orderNumber), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.orders.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.followups() });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.customers.all() });
      toast.success(success, { description });
      onDone?.(order);
    },
    onError: (error) => {
      toast.error('Could not update the order', { description: errorMessage(error) });
    },
  });
}
