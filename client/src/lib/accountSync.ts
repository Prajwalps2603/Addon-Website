/**
 * Keeps the wishlist and the garage in step with the signed-in account.
 *
 *  - Signing in (or creating an account) MERGES: what is on this device plus what the
 *    account holds, written back to the account.
 *  - Opening the site already signed in ADOPTS the account's lists, so a change made on
 *    another device arrives here. An empty account list never wipes what this device holds.
 *  - While signed in, every change to either store is saved to the account a moment later.
 *
 * hooks/useAppSync.ts drives this from the session; pages never call it.
 */
import { api } from '@/lib/api';
import { useGarage, type GarageCar } from '@/stores/garage';
import { useWishlist } from '@/stores/wishlist';
import type { GarageEntry, GarageVehicle } from '@/types/api';

export type SyncMode = 'merge' | 'adopt';

const PUSH_DELAY_MS = 800;

let userId: number | null = null;
/** True once this user's first merge or adopt has finished. Nothing is pushed before that. */
let ready = false;
let starting = false;
/** Bumped on sign-out so work still in flight for the old session is discarded. */
let session = 0;
/** What the account is known to hold, as snapshots. */
let wishlistSaved = '';
let garageSaved = '';
let pushTimer: number | undefined;
let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => undefined);
  return queue;
}

const idsSnapshot = (ids: readonly number[]) => JSON.stringify([...ids].sort((a, b) => a - b));
const wishlistSnapshot = () => idsSnapshot(useWishlist.getState().ids);

function toServerGarage(cars: readonly GarageCar[], activeVehicleId: number | null): GarageVehicle[] {
  return cars.map((car) => ({
    vehicleId: car.vehicleId,
    year: car.year,
    nickname: car.nickname,
    isActive: car.vehicleId === activeVehicleId,
  }));
}

const garageSnapshotOf = (vehicles: readonly GarageVehicle[]) =>
  JSON.stringify(vehicles.map((v) => [v.vehicleId, v.year, v.nickname, v.isActive]));

function garageSnapshot(): string {
  const { vehicles, activeVehicleId } = useGarage.getState();
  return garageSnapshotOf(toServerGarage(vehicles, activeVehicleId));
}

function toCars(entries: readonly GarageEntry[]): GarageCar[] {
  return entries.map((entry) => ({
    vehicleId: entry.vehicleId,
    year: entry.year,
    nickname: entry.nickname,
    vehicle: entry.vehicle,
  }));
}

function applyGarage(entries: readonly GarageEntry[]): void {
  useGarage.getState().setAll(toCars(entries), entries.find((entry) => entry.isActive)?.vehicleId ?? null);
}

/** Saves whichever list differs from what the account holds, then takes the account's cleaned-up answer. */
async function push(): Promise<void> {
  if (userId === null || !ready) return;
  const mine = session;

  const wishlistSent = wishlistSnapshot();
  if (wishlistSent !== wishlistSaved) {
    const saved = await api.account.wishlist.set(useWishlist.getState().ids);
    if (mine !== session) return;
    wishlistSaved = idsSnapshot(saved.productIds);
    // The account drops ids of products that no longer exist: follow it unless the list changed meanwhile.
    if (wishlistSnapshot() === wishlistSent && wishlistSaved !== wishlistSent) useWishlist.getState().setAll(saved.productIds);
  }

  const garageSent = garageSnapshot();
  if (garageSent !== garageSaved) {
    const { vehicles, activeVehicleId } = useGarage.getState();
    const saved = await api.account.garage.set(toServerGarage(vehicles, activeVehicleId));
    if (mine !== session) return;
    garageSaved = garageSnapshotOf(saved);
    if (garageSnapshot() === garageSent && garageSaved !== garageSent) applyGarage(saved);
  }
}

async function start(mode: SyncMode): Promise<void> {
  const mine = session;
  const wishlistBefore = wishlistSnapshot();
  const garageBefore = garageSnapshot();
  const [wishlist, garage] = await Promise.all([api.account.wishlist.get(), api.account.garage.get()]);
  if (mine !== session) return;

  wishlistSaved = idsSnapshot(wishlist.productIds);
  garageSaved = garageSnapshotOf(garage);

  const localIds = useWishlist.getState().ids;
  if (mode === 'merge') {
    useWishlist.getState().setAll([...localIds, ...wishlist.productIds]);
  } else if (wishlist.productIds.length > 0 && wishlistSnapshot() === wishlistBefore) {
    useWishlist.getState().setAll(wishlist.productIds);
  }

  const local = useGarage.getState();
  if (mode === 'merge') {
    const known = new Set(local.vehicles.map((car) => car.vehicleId));
    const merged = [...local.vehicles, ...toCars(garage).filter((car) => !known.has(car.vehicleId))];
    const serverActive = garage.find((entry) => entry.isActive)?.vehicleId ?? null;
    useGarage.getState().setAll(merged, local.activeVehicleId ?? serverActive);
  } else if (garage.length > 0 && garageSnapshot() === garageBefore) {
    applyGarage(garage);
  }

  ready = true;
  await push();
}

/**
 * Runs the first sync for a signed-in user. Safe to call repeatedly: it does the work once
 * per session, and again only if the first attempt failed. Never rejects.
 */
export function syncAccount(id: number, mode: SyncMode): Promise<void> {
  if (userId === id && (ready || starting)) return queue;
  if (userId !== id) {
    session += 1;
    ready = false;
  }
  userId = id;
  starting = true;
  const mine = session;
  return enqueue(async () => {
    if (mine !== session) return;
    try {
      await start(mode);
    } finally {
      if (mine === session) starting = false;
    }
  });
}

/** Called when either store changes, and when the connection returns. */
function localChanged(): void {
  if (userId === null) return;
  if (!ready) {
    // The first sync failed (offline at sign-in). Merging is the safe way to try again.
    if (!starting) void syncAccount(userId, 'merge');
    return;
  }
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void enqueue(push), PUSH_DELAY_MS);
}

/** Saves any change still waiting. Sign-out awaits this so the last edit is not lost. */
export function flushAccountSync(): Promise<void> {
  window.clearTimeout(pushTimer);
  return enqueue(push);
}

/** Forget the session (sign-out). Local lists are left for the caller to clear or keep. */
export function resetAccountSync(): void {
  window.clearTimeout(pushTimer);
  session += 1;
  userId = null;
  ready = false;
  starting = false;
  wishlistSaved = '';
  garageSaved = '';
}

/** Starts watching the stores. Returns the function that stops it. */
export function watchAccountStores(): () => void {
  const stopWishlist = useWishlist.subscribe(localChanged);
  const stopGarage = useGarage.subscribe(localChanged);
  window.addEventListener('online', localChanged);
  return () => {
    stopWishlist();
    stopGarage();
    window.removeEventListener('online', localChanged);
  };
}
