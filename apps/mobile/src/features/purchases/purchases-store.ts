import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { create } from 'zustand';

import { APP_CONFIG } from '../../config';
import { reportError, track } from '../analytics/analytics';
import { useSettings } from '../settings/settings-store';

/** RevenueCat entitlement that unlocks premium content (04 §2). */
const PREMIUM_ENTITLEMENT = 'premium';
/** RevenueCat offering with the AI credit packs (PAY-03). */
const CREDITS_OFFERING = 'credits';

export interface StorePackage {
  readonly id: string;
  readonly priceString: string;
  /** Free trial length of a subscription (PAY-01), if any. */
  readonly trialDays: number | null;
  /** Credits in a credit pack, from its product ID (`credits_10` → 10). */
  readonly credits: number | null;
}

interface PurchasesState {
  /** Whether purchases are configured and the store responded. */
  readonly available: boolean;
  readonly entitled: boolean;
  readonly annual: StorePackage | null;
  readonly lifetime: StorePackage | null;
  readonly creditPacks: readonly StorePackage[];
}

const packages = new Map<string, PurchasesPackage>();

export const usePurchases = create<PurchasesState>()(() => ({
  available: false,
  entitled: false,
  annual: null,
  lifetime: null,
  creditPacks: [],
}));

function trialDaysOf(pkg: PurchasesPackage): number | null {
  const intro = pkg.product.introPrice;
  if (intro?.price !== 0) return null;
  const units: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
  return intro.periodNumberOfUnits * (units[intro.periodUnit] ?? 1);
}

function toStorePackage(pkg: PurchasesPackage): StorePackage {
  packages.set(pkg.identifier, pkg);
  const credits = /credits_(\d+)/.exec(pkg.product.identifier)?.[1];
  return {
    id: pkg.identifier,
    priceString: pkg.product.priceString,
    trialDays: trialDaysOf(pkg),
    credits: credits === undefined ? null : Number(credits),
  };
}

function applyCustomerInfo(info: CustomerInfo): void {
  usePurchases.setState({ entitled: PREMIUM_ENTITLEMENT in info.entitlements.active });
}

let configured = false;
let loading: Promise<void> | null = null;

/**
 * Connects to the stores through RevenueCat (PAY-06). The entitlement is verified by
 * RevenueCat's servers, never decided by the app alone (03 §5). Without an API key
 * (e.g. local development) purchases stay unavailable and nothing is unlocked.
 */
export async function startPurchases(): Promise<void> {
  const apiKey = APP_CONFIG.revenueCatApiKey;
  if (apiKey === null || configured) return;
  configured = true;
  try {
    Purchases.configure({ apiKey });
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
  } catch (error) {
    reportError(error, 'purchases.configure');
    return;
  }
  await loadPurchases();
}

/**
 * Loads the entitlement and the plans on sale. Safe to call again: the paywall and
 * credit screens do when the first attempt failed (e.g. offline at launch).
 */
export function loadPurchases(): Promise<void> {
  if (!configured || usePurchases.getState().available) return Promise.resolve();
  loading ??= fetchPurchases().finally(() => {
    loading = null;
  });
  return loading;
}

async function fetchPurchases(): Promise<void> {
  try {
    applyCustomerInfo(await Purchases.getCustomerInfo());
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    usePurchases.setState({
      available: true,
      annual: current?.annual ? toStorePackage(current.annual) : null,
      lifetime: current?.lifetime ? toStorePackage(current.lifetime) : null,
      creditPacks: (offerings.all[CREDITS_OFFERING]?.availablePackages ?? [])
        .map(toStorePackage)
        .sort((a, b) => (a.credits ?? 0) - (b.credits ?? 0)),
    });
  } catch (error) {
    reportError(error, 'purchases.load');
  }
}

/** Links purchases to the AI account, so credit packs reach the right balance. */
export async function linkPurchasesAccount(accountId: string): Promise<void> {
  if (!configured) return;
  try {
    applyCustomerInfo((await Purchases.logIn(accountId)).customerInfo);
  } catch (error) {
    reportError(error, 'purchases.logIn');
  }
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

export async function purchase(packageId: string): Promise<PurchaseOutcome> {
  const pkg = packages.get(packageId);
  if (pkg === undefined) throw new Error(`Unknown package ${packageId}`);
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    track({ name: 'purchase_completed', productId: pkg.product.identifier });
    return 'purchased';
  } catch (error) {
    if ((error as { userCancelled?: boolean }).userCancelled === true) return 'cancelled';
    throw error;
  }
}

/** Restores purchases (PAY-05); returns whether premium is now active. */
export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  applyCustomerInfo(info);
  return PREMIUM_ENTITLEMENT in info.entitlements.active;
}

/**
 * Whether premium content can be saved: the store entitlement, or the developer
 * switch in internal builds (for testing without a store account).
 */
export function usePremium(): boolean {
  const entitled = usePurchases((state) => state.entitled);
  const developerPremium = useSettings((state) => state.developerPremium);
  return entitled || (APP_CONFIG.isInternalBuild && developerPremium);
}

/** Whether an item needs premium the user does not have (PAY-04). */
export function isLocked(item: { readonly tier: 'free' | 'premium' }, premium: boolean): boolean {
  return item.tier === 'premium' && !premium;
}
