import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import * as z from 'zod';
import { ProductFrame } from '@/components/commerce';
import { Button, Callout, Field, Input, Modal, Select, Switch, Textarea } from '@/components/ui';
import { api, errorMessage, type AdminCategoryInput } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import type { Category } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, { error: 'Give it a name of at least two letters.' }).max(80),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine((v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), { error: 'Use lower-case letters, numbers and single dashes.' }),
  parentId: z.string(),
  blurb: z.string().trim().max(400),
  artKind: z.string().trim().max(40),
  image: z.string(),
  isActive: z.boolean(),
});

type CategoryFormValues = z.infer<typeof schema>;

export interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  /** The category to edit, or null to add one. */
  category: Category | null;
  /** For a new subcategory: its parent. */
  parentId?: number | null;
  /** Top-level categories, for the parent choice. */
  parents: readonly Category[];
  /** Sort position for a new category. */
  nextSortOrder: number;
  onSaved: (category: Category, created: boolean) => void;
}

/** Add or edit one category: name, address, parent, blurb, icon and tile photo. */
export function CategoryModal({ open, onClose, category, parentId = null, parents, nextSortOrder, onSaved }: CategoryModalProps) {
  const defaults = (): CategoryFormValues => ({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    parentId: String(category ? (category.parentId ?? '') : (parentId ?? '')),
    blurb: category?.blurb ?? '',
    artKind: category?.artKind ?? '',
    image: category?.image ?? '',
    isActive: category?.isActive ?? true,
  });
  const { register, control, handleSubmit, reset, setError, watch, setValue, formState } = useForm<CategoryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });
  const { errors, isSubmitting } = formState;
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      reset(defaults());
      setFormError(null);
    }
    // Reset only when the dialog opens for a category.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.id, parentId]);

  const image = watch('image');
  const artKind = watch('artKind');
  const hasChildren = (category?.children.length ?? 0) > 0;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body: AdminCategoryInput = {
      name: values.name.trim(),
      slug: values.slug.trim() || undefined,
      parentId: values.parentId ? Number(values.parentId) : null,
      blurb: values.blurb.trim(),
      artKind: values.artKind.trim() || 'generic',
      image: values.image,
      sortOrder: category?.sortOrder ?? nextSortOrder,
      isActive: values.isActive,
    };
    try {
      const saved = category ? await api.admin.categories.update(category.id, body) : await api.admin.categories.create(body);
      onSaved(saved, !category);
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const { urls } = await api.admin.uploads.images([file]);
      if (urls[0]) setValue('image', urls[0], { shouldDirty: true });
    } catch (error) {
      setFormError(`The photo was not uploaded: ${errorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const formId = category ? `category-form-${category.id}` : 'category-form-new';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? `Edit ${category.name}` : parentId ? 'Add a subcategory' : 'Add a category'}
      size="md"
      dismissible={!isSubmitting}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} disabled={uploading}>
            {category ? 'Save category' : 'Add category'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <Field label="Name" error={errors.name?.message}>
          <Input {...register('name')} autoComplete="off" />
        </Field>
        <Field label="Web address" optional hint={category ? `/shop/.../${category.slug}` : 'Blank = made from the name.'} error={errors.slug?.message}>
          <Input {...register('slug')} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field
          label="Sits under"
          hint={hasChildren ? 'It has subcategories, so it stays at the top level.' : 'Products go in subcategories only.'}
          error={errors.parentId?.message}
        >
          <Select {...register('parentId')} disabled={hasChildren}>
            <option value="">Top level</option>
            {parents
              .filter((p) => p.id !== category?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Blurb" optional hint="One line shown on the category page." error={errors.blurb?.message}>
          <Textarea rows={2} {...register('blurb')} />
        </Field>
        <Field label="Icon and photo pool" optional hint="A key such as alloy-wheel or fog-light. Blank = generic." error={errors.artKind?.message}>
          <Input {...register('artKind')} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>

        <div className="grid gap-2">
          <span className="type-small font-bold">Tile photo</span>
          <div className="flex items-start gap-4">
            <ProductFrame image={image || null} alt={image ? 'Tile photo' : ''} artKind={artKind || 'generic'} className="size-24 shrink-0 border border-line" />
            <div className="grid gap-2">
              <Button variant="outline" size="sm" iconLeft={<ImagePlus aria-hidden />} loading={uploading} onClick={() => fileInput.current?.click()}>
                {image ? 'Replace photo' : 'Upload photo'}
              </Button>
              {image && (
                <Button variant="ghost" size="sm" iconLeft={<Trash2 aria-hidden />} onClick={() => setValue('image', '', { shouldDirty: true })}>
                  Remove photo
                </Button>
              )}
              <p className="type-small text-muted">JPG, PNG or WebP. Without one, the tile shows the icon.</p>
            </div>
          </div>
          {errors.image?.message && (
            <p role="alert" className="type-small text-stop">
              {errors.image.message}
            </p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void upload(file);
            }}
          />
        </div>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch label="Shown in the shop" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} labelFirst />
          )}
        />
      </form>
    </Modal>
  );
}
