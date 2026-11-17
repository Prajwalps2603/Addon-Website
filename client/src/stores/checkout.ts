import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';
import { uuid } from '@/lib/uuid';
import type { PaymentMethod, ShippingAddress } from '@/types/api';

const STORAGE_KEY = 'addon-checkout-v1';

export interface CheckoutContact {
  name: string;
  email: string;
  phone: string;
}

const EMPTY_CONTACT: CheckoutContact = { name: '', email: '', phone: '' };
const EMPTY_ADDRESS: ShippingAddress = {
  name: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
};

interface CheckoutDraft {
  contact: CheckoutContact;
  /** Who receives the parcel and where. `name` and `phone` may differ from the contact. */
  address: ShippingAddress;
  gstin: string;
  notes: string;
  paymentMethod: PaymentMethod | null;
  /** Token from POST /checkout/lead: sent again on later lead updates and with the order. */
  leadToken: string | null;
  idempotencyKey: string | null;
  /** What `idempotencyKey` was issued for. */
  idempotencyFor: string | null;
}

interface CheckoutState extends CheckoutDraft {
  setContact: (patch: Partial<CheckoutContact>) => void;
  setAddress: (patch: Partial<ShippingAddress>) => void;
  setDetails: (patch: Partial<Pick<CheckoutDraft, 'gstin' | 'notes' | 'paymentMethod'>>) => void;
  setLeadToken: (token: string | null) => void;
  /**
   * The idempotency key for this exact order attempt. Pass a fingerprint of the order
   * (for example JSON of the request without the key). The same fingerprint returns
   * the same key, so a retry after a dropped connection cannot place the order twice; any change
   * to the order gets a fresh key, so an edited cart is never answered with the old order.
   */
  idempotencyKeyFor: (fingerprint: string) => string;
  /** Call once the order exists: drops the lead token, the key and the notes, keeps contact and address for next time. */
  orderPlaced: () => void;
  /** Forgets everything (sign out). */
  clear: () => void;
}

const EMPTY_DRAFT: CheckoutDraft = {
  contact: EMPTY_CONTACT,
  address: EMPTY_ADDRESS,
  gstin: '',
  notes: '',
  paymentMethod: null,
  leadToken: null,
  idempotencyKey: null,
  idempotencyFor: null,
};

/** A stored group of text fields, with anything missing or not text put back to its default. */
function strings<T extends object>(defaults: T, stored: unknown): T {
  const source = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<string, unknown>;
  const entries = Object.entries(defaults).map(([key, value]) => [key, typeof source[key] === 'string' ? source[key] : value]);
  return Object.fromEntries(entries) as T;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export const useCheckout = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...EMPTY_DRAFT,

      setContact: (patch) => set((state) => ({ contact: { ...state.contact, ...patch } })),
      setAddress: (patch) => set((state) => ({ address: { ...state.address, ...patch } })),
      setDetails: (patch) => set(patch),
      setLeadToken: (token) => set({ leadToken: token }),

      idempotencyKeyFor: (fingerprint) => {
        const { idempotencyKey, idempotencyFor } = get();
        if (idempotencyKey && idempotencyFor === fingerprint) return idempotencyKey;
        const key = uuid();
        set({ idempotencyKey: key, idempotencyFor: fingerprint });
        return key;
      },

      orderPlaced: () => set({ leadToken: null, idempotencyKey: null, idempotencyFor: null, notes: '', paymentMethod: null }),
      clear: () => set(EMPTY_DRAFT),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: persistStorage(),
      partialize: (state): CheckoutDraft => ({
        contact: state.contact,
        address: state.address,
        gstin: state.gstin,
        notes: state.notes,
        paymentMethod: state.paymentMethod,
        leadToken: state.leadToken,
        idempotencyKey: state.idempotencyKey,
        idempotencyFor: state.idempotencyFor,
      }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Record<keyof CheckoutDraft, unknown>>;
        const method = stored.paymentMethod;
        return {
          ...current,
          contact: strings(EMPTY_CONTACT, stored.contact),
          address: strings(EMPTY_ADDRESS, stored.address),
          gstin: typeof stored.gstin === 'string' ? stored.gstin : '',
          notes: typeof stored.notes === 'string' ? stored.notes : '',
          paymentMethod: method === 'cod' || method === 'razorpay' || method === 'upi' ? method : null,
          leadToken: textOrNull(stored.leadToken),
          idempotencyKey: textOrNull(stored.idempotencyKey),
          idempotencyFor: textOrNull(stored.idempotencyFor),
        };
      },
    },
  ),
);
