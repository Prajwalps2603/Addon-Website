/** The custom payload of a designed show plate (from the Show Plate Designer). */
export function isShowPlate(custom: Record<string, unknown> | null | undefined): boolean {
  return typeof custom === 'object' && custom !== null && custom.kind === 'show-plate';
}

/** The fixed wording shown on every show plate line: cart, checkout, order and invoice. */
export const SHOW_PLATE_NOTE =
  'Custom show plate. Decorative use only, not for road use. Made to order: not eligible for return unless damaged, defective or different from the approved design.';
