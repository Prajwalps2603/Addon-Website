import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState, PageHeader } from '@/components/commerce';
import { Badge, Button, Callout, Drawer, Modal, Skeleton, toast } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { api, errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/india';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Address, AddressInput } from '@/types/api';
import { AddressForm, toAddressInput } from './parts/AddressForm';

const FORM_ID = 'account-address-form';

function AddressLines({ address }: { address: Address }) {
  return (
    <address className="type-body grid gap-0.5 not-italic">
      <span className="font-bold">{address.name}</span>
      <span>{address.line1}</span>
      {address.line2 && <span>{address.line2}</span>}
      {address.landmark && <span className="text-muted">Near {address.landmark}</span>}
      <span>
        {address.city}, {address.state} <span className="tnum">{address.pincode}</span>
      </span>
      <span className="text-muted tnum">{formatPhone(address.phone)}</span>
    </address>
  );
}

function AddressesSkeleton() {
  return (
    <ul aria-hidden className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((index) => (
        <li key={index} className="grid gap-3 border border-line p-4 sm:p-5">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-9 w-48" />
        </li>
      ))}
    </ul>
  );
}

type Editing = { mode: 'new' } | { mode: 'edit'; address: Address } | null;

export default function AddressesPage() {
  useDocumentMeta({ title: 'My addresses', noindex: true });
  const queryClient = useQueryClient();
  const { user } = useMe();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);

  const { data: addresses, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.account.addresses(),
    queryFn: ({ signal }) => api.account.addresses.list({ signal }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.account.addresses() });

  const save = useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: AddressInput }) =>
      id === null ? api.account.addresses.create(input) : api.account.addresses.update(id, input),
    onSuccess: (_saved, { id }) => {
      void refresh();
      setEditing(null);
      toast.success(id === null ? 'Address added' : 'Address saved');
    },
  });

  const makeDefault = useMutation({
    mutationFn: (address: Address) => api.account.addresses.update(address.id, { ...toAddressInput(address), isDefault: true }),
    onSuccess: (saved) => {
      void refresh();
      toast.success('Default address changed', { description: `${saved.label || saved.name} is filled in first at checkout.` });
    },
    onError: (failure) => toast.error('Could not change the default', { description: errorMessage(failure) }),
  });

  const remove = useMutation({
    mutationFn: (address: Address) => api.account.addresses.remove(address.id),
    onSuccess: () => {
      void refresh();
      setDeleting(null);
      toast.success('Address deleted');
    },
  });

  // Default first, then in the order they were added.
  const sorted = addresses ? [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)) : [];
  const editingAddress = editing?.mode === 'edit' ? editing.address : null;
  const addButton = (
    <Button iconLeft={<Plus />} onClick={() => setEditing({ mode: 'new' })}>
      Add address
    </Button>
  );

  return (
    <section>
      <PageHeader
        title="Addresses"
        meta={addresses && addresses.length > 0 ? pluralize(addresses.length, 'address', 'addresses') : undefined}
        actions={addresses && addresses.length > 0 ? addButton : undefined}
      />

      {isPending ? (
        <AddressesSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load your addresses" />
      ) : sorted.length === 0 ? (
        <EmptyState
          art={<MapPin aria-hidden className="size-8" />}
          title="No saved addresses"
          description="Save one now and checkout fills it in for you. Addresses you use at checkout can be saved there too."
          actions={addButton}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sorted.map((address) => (
            <li key={address.id} className="grid content-between gap-4 border border-line p-4 sm:p-5">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="type-h3">{address.label || 'Address'}</h2>
                  {address.isDefault && (
                    <Badge tone="ink" variant="solid" size="sm">
                      Default
                    </Badge>
                  )}
                </div>
                <AddressLines address={address} />
              </div>
              <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-line pt-3">
                <Button variant="ghost" size="sm" iconLeft={<Pencil />} onClick={() => setEditing({ mode: 'edit', address })}>
                  Edit
                  <span className="sr-only"> {address.label || address.line1}</span>
                </Button>
                <Button variant="ghost" size="sm" iconLeft={<Trash2 />} onClick={() => setDeleting(address)}>
                  Delete
                  <span className="sr-only"> {address.label || address.line1}</span>
                </Button>
                {!address.isDefault && (
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-auto"
                    loading={makeDefault.isPending && makeDefault.variables?.id === address.id}
                    onClick={() => makeDefault.mutate(address)}
                  >
                    Make default
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={editing !== null}
        onClose={() => {
          setEditing(null);
          save.reset();
        }}
        title={editingAddress ? 'Edit address' : 'New address'}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} loading={save.isPending}>
              Save address
            </Button>
          </div>
        }
      >
        {editing && (
          <AddressForm
            key={editingAddress?.id ?? 'new'}
            id={FORM_ID}
            address={editingAddress}
            defaults={{ name: user?.name ?? '', phone: user?.phone ?? '', isDefault: (addresses?.length ?? 0) === 0 }}
            onSave={(input) => save.mutateAsync({ id: editingAddress?.id ?? null, input })}
          />
        )}
      </Drawer>

      <Modal
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this address?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>
              Delete
            </Button>
          </div>
        }
      >
        {deleting && (
          <div className="grid gap-4">
            <AddressLines address={deleting} />
            <p className="type-small text-muted">Orders already sent to it keep their address.</p>
            {remove.error && (
              <Callout tone="danger" live>
                {errorMessage(remove.error)}
              </Callout>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
