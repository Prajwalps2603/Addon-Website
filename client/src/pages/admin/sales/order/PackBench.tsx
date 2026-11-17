import { useMutation } from '@tanstack/react-query';
import { Camera, PackageCheck, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CustomSummary, ProductFrame } from '@/components/commerce';
import { TreadDivider } from '@/components/brand';
import { Button, Callout, Checkbox, Drawer, toast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatNumber, pluralize } from '@/lib/format';
import { readJSON, removeStored, writeJSON } from '@/lib/storage';
import type { Order } from '@/types/api';
import { useOrderUpdate } from './useOrderUpdate';

const MAX_PHOTO_MB = 8;

interface BenchState {
  ticked: number[];
  photo: string;
}

function storageKey(orderNumber: string): string {
  return `addon-packbench-v1:${orderNumber}`;
}

export interface PackBenchProps {
  order: Order;
  open: boolean;
  onClose: () => void;
}

/**
 * The packing checklist. Every line is ticked off against the box, the packed items are
 * photographed (the photo appears on the customer's order page) and the order is marked packed.
 * Ticks and the photo survive a phone call or a reload until the order is packed.
 */
export function PackBench({ order, open, onClose }: PackBenchProps) {
  const key = storageKey(order.orderNumber);
  const [state, setState] = useState<BenchState>(() => readJSON<BenchState>(key, { ticked: [], photo: '' }));
  const camera = useRef<HTMLInputElement>(null);
  const canPack = order.status === 'placed' || order.status === 'confirmed';
  const photo = state.photo || order.packPhoto;

  useEffect(() => {
    if (!canPack) return;
    if (state.ticked.length > 0 || state.photo) writeJSON(key, state);
    else removeStored(key);
  }, [canPack, key, state]);

  const update = useOrderUpdate(order.orderNumber, (next) => {
    if (next.status === 'packed') removeStored(key);
    onClose();
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.admin.uploads.images([file]),
    onSuccess: ({ urls }) => {
      const url = urls[0];
      if (!url) return;
      setState((current) => ({ ...current, photo: url }));
      toast.success('Photo added', { description: canPack ? 'It is saved with the order when you mark it packed.' : 'Save it to show the customer.' });
    },
    onError: (error) => toast.error('Could not upload the photo', { description: errorMessage(error) }),
  });

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error('That photo is too large', { description: `Keep it under ${MAX_PHOTO_MB} MB.` });
      return;
    }
    upload.mutate(file);
  };

  const toggle = (id: number, on: boolean) =>
    setState((current) => ({ ...current, ticked: on ? [...new Set([...current.ticked, id])] : current.ticked.filter((x) => x !== id) }));

  const ticked = order.items.filter((item) => state.ticked.includes(item.id)).length;
  const total = order.items.length;
  const allTicked = ticked === total;
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);

  const markPacked = () =>
    update.mutate({
      body: {
        status: 'packed',
        packPhoto: state.photo || undefined,
        note: `Packed at the bench: ${pluralize(units, 'item')} checked${state.photo ? ', photo taken' : ''}.`,
      },
      success: `Order ${order.orderNumber} marked packed`,
      description: state.photo || order.packPhoto ? 'The pack photo is on the customer’s order page.' : undefined,
    });

  const savePhoto = () =>
    update.mutate({ body: { packPhoto: state.photo }, success: 'Pack photo saved', description: 'The customer sees it on their order page.' });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Pack bench"
      description={`${order.orderNumber}. Tick each part as it goes in the box.`}
      size="lg"
      toolbar={
        <div className="grid gap-2">
          <p className="type-small flex justify-between gap-3">
            <span className="font-bold tnum">
              {formatNumber(ticked)} of {formatNumber(total)} lines checked
            </span>
            <span className="text-muted tnum">{pluralize(units, 'unit')} in the box</span>
          </p>
          <TreadDivider progress={total ? ticked / total : 0} label="Lines checked" tone={allTicked ? 'ink' : 'muted'} />
        </div>
      }
      footer={
        canPack ? (
          <div className="grid gap-2">
            {!allTicked && <p className="type-small text-muted">Tick every line to mark the order packed.</p>}
            <Button size="lg" block disabled={!allTicked || upload.isPending} loading={update.isPending} iconLeft={<PackageCheck aria-hidden />} onClick={markPacked}>
              Mark packed
            </Button>
          </div>
        ) : (
          <Button size="lg" block variant="dark" disabled={!state.photo || state.photo === order.packPhoto} loading={update.isPending} onClick={savePhoto}>
            Save photo
          </Button>
        )
      }
    >
      <ul className="grid gap-2">
        {order.items.map((item) => {
          const on = state.ticked.includes(item.id);
          return (
            <li
              key={item.id}
              className={cn('grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border p-2.5 transition-colors dur-quick', on ? 'border-ink bg-brand-soft' : 'border-line')}
            >
              <ProductFrame image={item.image} alt={item.name} className="border border-line" />
              <div className="grid min-w-0 gap-1">
                <Checkbox
                  checked={on}
                  disabled={!canPack}
                  onChange={(event) => toggle(item.id, event.target.checked)}
                  className="py-1"
                  label={
                    <span className="grid gap-0.5">
                      <span className="font-bold">{item.name}</span>
                      {item.variantName && <span className="type-small">{item.variantName}</span>}
                    </span>
                  }
                  description={item.sku ? <span className="type-code">{item.sku}</span> : undefined}
                />
                <p className="type-h3 tnum pl-8">
                  <span className="sr-only">Quantity </span>&times; {formatNumber(item.qty)}
                </p>
                {item.custom && <CustomSummary custom={item.custom} className="pl-8" />}
              </div>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="pack-photo-title" className="mt-6 grid gap-3">
        <h3 id="pack-photo-title" className="type-h3">
          Pack photo
        </h3>
        <p className="type-small max-w-prose text-muted">
          Lay the parts out before sealing and take one clear photo. The customer sees it on their order page.
        </p>
        {photo ? (
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-start">
            <ProductFrame image={photo} alt={`Packed items for order ${order.orderNumber}`} className="border border-line" />
            <div className="grid justify-items-start gap-2">
              {state.photo && state.photo !== order.packPhoto ? (
                <p className="type-small text-muted">New photo, not saved yet.</p>
              ) : (
                <p className="type-small text-muted">Saved with the order.</p>
              )}
              <Button variant="outline" iconLeft={<RefreshCw aria-hidden />} loading={upload.isPending} onClick={() => camera.current?.click()}>
                Retake photo
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="dark" size="lg" block iconLeft={<Camera aria-hidden />} loading={upload.isPending} onClick={() => camera.current?.click()}>
              Photograph the packed items
            </Button>
            {canPack && allTicked && (
              <Callout tone="warn" title="No photo yet">
                You can mark it packed without one, but the customer will not see proof of what went in the box.
              </Callout>
            )}
          </>
        )}
        <input ref={camera} type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden />
      </section>
    </Drawer>
  );
}
