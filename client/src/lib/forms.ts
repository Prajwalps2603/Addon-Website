import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';

/**
 * Shows a failed request on a react-hook-form form. Each entry of the error's `fields`
 * is set on the field of the same name (the first one is focused); `rename` maps a server
 * field path to the form's own name where they differ. Returns the message for the
 * form-level alert.
 *
 *   const onSubmit = handleSubmit(async (values) => {
 *     try {
 *       await api.account.addresses.create(values);
 *     } catch (error) {
 *       setFormError(applyApiError(error, setError));
 *     }
 *   });
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  rename: Partial<Record<string, Path<T>>> = {},
): string {
  if (error instanceof ApiError) {
    let first = true;
    for (const [field, message] of Object.entries(error.fields)) {
      setError(rename[field] ?? (field as Path<T>), { type: 'server', message }, { shouldFocus: first });
      first = false;
    }
  }
  return errorMessage(error);
}
