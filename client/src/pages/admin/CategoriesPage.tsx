import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, PageHeader, ProductFrame } from '@/components/commerce';
import { Badge, Button, EmptyState, IconButton, Skeleton, Switch, toast } from '@/components/ui';
import { api, errorMessage, type AdminCategoryInput } from '@/lib/api';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Category } from '@/types/api';
import { CategoryModal } from './catalog/CategoryModal';
import { ConfirmModal } from './catalog/ConfirmModal';
import { PicksEditor } from './catalog/PicksEditor';
import { moveItem } from './catalog/utils';

const bySort = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

function inputOf(category: Category, patch: Partial<AdminCategoryInput> = {}): AdminCategoryInput {
  return {
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    blurb: category.blurb,
    artKind: category.artKind,
    image: category.image,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    ...patch,
  };
}

type Editing = { category: Category | null; parentId: number | null; nextSortOrder: number } | null;

export default function CategoriesPage() {
  useDocumentMeta({ title: 'Categories', noindex: true });
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.admin.categories.list(),
    queryFn: ({ signal }) => api.admin.categories.list({ signal }),
  });

  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [picksOpen, setPicksOpen] = useState<number | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
    void queryClient.invalidateQueries({ queryKey: ['home'] });
  };

  const toggle = useMutation({
    mutationFn: ({ category, isActive }: { category: Category; isActive: boolean }) => api.admin.categories.update(category.id, inputOf(category, { isActive })),
    onMutate: ({ category }) => setBusyIds((ids) => [...ids, category.id]),
    onSettled: (_d, _e, { category }) => setBusyIds((ids) => ids.filter((id) => id !== category.id)),
    onSuccess: (saved) => {
      toast.success(saved.isActive ? 'Shown in the shop' : 'Hidden from the shop', { description: saved.name });
      invalidate();
    },
    onError: (err) => toast.error('Not changed', { description: errorMessage(err) }),
  });

  const reorder = useMutation({
    mutationFn: async (siblings: Category[]) => {
      // Number the whole group 10, 20, 30 … and save only the ones that moved.
      for (const [index, category] of siblings.entries()) {
        const sortOrder = (index + 1) * 10;
        if (category.sortOrder !== sortOrder) await api.admin.categories.update(category.id, inputOf(category, { sortOrder }));
      }
    },
    onSuccess: () => {
      toast.success('Order saved');
      invalidate();
    },
    onError: (err) => {
      toast.error('Order not saved', { description: errorMessage(err) });
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (category: Category) => api.admin.categories.remove(category.id),
    onSuccess: (_ok, category) => {
      toast.success('Category deleted', { description: category.name });
      setDeleting(null);
      invalidate();
    },
    onError: (err) => {
      setDeleting(null);
      toast.error('Not deleted', { description: errorMessage(err) });
    },
  });

  const tree = [...(data ?? [])].sort(bySort).map((parent) => ({ ...parent, children: [...parent.children].sort(bySort) }));
  const subCount = tree.reduce((sum, parent) => sum + parent.children.length, 0);
  const nextOrder = (list: readonly Category[]) => (list.length ? Math.max(...list.map((c) => c.sortOrder)) + 10 : 10);

  const move = (siblings: Category[], from: number, to: number) => reorder.mutate(moveItem(siblings, from, to));

  const controls = (category: Category, siblings: Category[], index: number) => {
    const busy = busyIds.includes(category.id);
    const empty = category.productCount === 0 && category.children.length === 0;
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Switch
          aria-label={`Show ${category.name} in the shop`}
          checked={category.isActive}
          disabled={busy}
          onChange={(event) => toggle.mutate({ category, isActive: event.target.checked })}
          className="mr-2"
        />
        <IconButton label={`Move ${category.name} up`} size="sm" disabled={index === 0 || reorder.isPending} onClick={() => move(siblings, index, index - 1)}>
          <ArrowUp aria-hidden />
        </IconButton>
        <IconButton
          label={`Move ${category.name} down`}
          size="sm"
          disabled={index === siblings.length - 1 || reorder.isPending}
          onClick={() => move(siblings, index, index + 1)}
        >
          <ArrowDown aria-hidden />
        </IconButton>
        <IconButton label={`Edit ${category.name}`} size="sm" onClick={() => setEditing({ category, parentId: category.parentId, nextSortOrder: category.sortOrder })}>
          <Pencil aria-hidden />
        </IconButton>
        <IconButton
          label={empty ? `Delete ${category.name}` : `${category.name} cannot be deleted while it has products or subcategories`}
          size="sm"
          disabled={!empty}
          onClick={() => setDeleting(category)}
        >
          <Trash2 aria-hidden />
        </IconButton>
      </div>
    );
  };

  let body;
  if (isPending) {
    body = (
      <div className="grid gap-8" aria-busy="true">
        <span className="sr-only">Loading categories</span>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="grid gap-3 rounded-[24px] bg-surface p-5">
            <Skeleton className="h-6 w-48" />
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="size-12" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  } else if (error) {
    body = <ErrorState error={error} onRetry={() => refetch()} title="Could not load categories" />;
  } else if (tree.length === 0) {
    body = (
      <EmptyState
        title="No categories yet"
        description="Start with a top-level category such as Lighting, then add subcategories such as Fog lamps. Products go in subcategories."
        actions={
          <Button iconLeft={<Plus aria-hidden />} onClick={() => setEditing({ category: null, parentId: null, nextSortOrder: 10 })}>
            Add category
          </Button>
        }
      />
    );
  } else {
    body = (
      <ol className="grid gap-5">
        {tree.map((parent, parentIndex) => (
          <li key={parent.id} className="rounded-[24px] bg-surface p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className={cn('text-2xl font-black italic uppercase', !parent.isActive && 'text-muted')}>{parent.name}</h2>
                  <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs font-semibold text-muted tnum">{pluralize(parent.productCount, 'product')} on sale</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">/shop/{parent.slug}</span>
                  {!parent.isActive && (
                    <Badge tone="neutral" variant="outline" size="sm">
                      Hidden
                    </Badge>
                  )}
                </div>
              </div>
              {controls(parent, tree, parentIndex)}
            </div>

            {parent.children.length > 0 ? (
              <ul className="mt-4 grid gap-2">
                {parent.children.map((child, childIndex) => {
                  const open = picksOpen === child.id;
                  return (
                    <li key={child.id} className="rounded-[18px] bg-raised p-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <ProductFrame image={child.image || null} alt="" artKind={child.artKind} className="size-12 shrink-0 overflow-hidden rounded-[12px]" />
                        <div className="grid min-w-0 flex-1 basis-40 gap-0.5">
                          <span className={cn('font-bold', !child.isActive && 'text-muted')}>
                            {child.name}
                            {!child.isActive && (
                              <Badge tone="neutral" variant="outline" size="sm" className="ml-2 align-middle">
                                Hidden
                              </Badge>
                            )}
                          </span>
                          <span className="type-small flex flex-wrap gap-x-3 text-muted">
                            <Link to={`/admin/products?category=${child.slug}`} className="link focus-ring tnum">
                              {pluralize(child.productCount, 'product')}
                            </Link>
                            <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[0.6875rem]">{child.slug}</span>
                          </span>
                        </div>
                        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto">
                          <Button
                            variant={open ? 'dark' : 'outline'}
                            size="sm"
                            className="rounded-full"
                            aria-expanded={open}
                            aria-controls={`picks-${child.id}`}
                            iconRight={<ChevronDown aria-hidden className={cn('transition-transform dur-quick', open && 'rotate-180')} />}
                            onClick={() => setPicksOpen(open ? null : child.id)}
                          >
                            Pick of Three
                          </Button>
                          {controls(child, parent.children, childIndex)}
                        </div>
                      </div>
                      {open && (
                        <div id={`picks-${child.id}`} className="mt-3 rounded-[16px] bg-surface p-3 md:p-4">
                          <PicksEditor category={child} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="type-small mt-3 text-muted">No subcategories yet. Products need one to live in.</p>
            )}
            <Button
              variant="link"
              size="sm"
              className="mt-3"
              iconLeft={<Plus aria-hidden />}
              onClick={() => setEditing({ category: null, parentId: parent.id, nextSortOrder: nextOrder(parent.children) })}
            >
              Add a subcategory to {parent.name}
            </Button>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Categories"
        meta={data ? `${pluralize(tree.length, 'category', 'categories')}, ${pluralize(subCount, 'subcategory', 'subcategories')}` : undefined}
        description="The shop's aisles. Products live in subcategories; each subcategory can open with a Pick of Three."
        actions={
          <Button iconLeft={<Plus aria-hidden />} onClick={() => setEditing({ category: null, parentId: null, nextSortOrder: nextOrder(tree) })}>
            Add category
          </Button>
        }
      />
      {body}

      <CategoryModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        category={editing?.category ?? null}
        parentId={editing?.parentId ?? null}
        parents={tree}
        nextSortOrder={editing?.nextSortOrder ?? 10}
        onSaved={(saved, created) => {
          toast.success(created ? 'Category added' : 'Category saved', { description: saved.name });
          setEditing(null);
          invalidate();
        }}
      />
      <ConfirmModal
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'category'}?`}
        confirmLabel="Delete category"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        <p>It has no products on sale and no subcategories. Hidden products still count: the shop will say so if any are left.</p>
      </ConfirmModal>
    </div>
  );
}
