import { create } from 'zustand';

/**
 * Which overlay is showing. Not persisted. Only one overlay is open at a time:
 * opening one closes the others, so a drawer never sits under a menu.
 */
interface UiState {
  cartOpen: boolean;
  searchOpen: boolean;
  vehiclePickerOpen: boolean;
  mobileMenuOpen: boolean;

  openCart: () => void;
  closeCart: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openVehiclePicker: () => void;
  closeVehiclePicker: () => void;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  /** Closes whatever is open. The layout calls this on every navigation. */
  closeAll: () => void;
}

const ALL_CLOSED = { cartOpen: false, searchOpen: false, vehiclePickerOpen: false, mobileMenuOpen: false };

export const useUi = create<UiState>()((set) => ({
  ...ALL_CLOSED,

  openCart: () => set({ ...ALL_CLOSED, cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  openSearch: () => set({ ...ALL_CLOSED, searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openVehiclePicker: () => set({ ...ALL_CLOSED, vehiclePickerOpen: true }),
  closeVehiclePicker: () => set({ vehiclePickerOpen: false }),
  openMobileMenu: () => set({ ...ALL_CLOSED, mobileMenuOpen: true }),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  closeAll: () => set(ALL_CLOSED),
}));
