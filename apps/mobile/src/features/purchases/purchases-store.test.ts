import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analytics = vi.hoisted(() => ({ track: vi.fn(), reportError: vi.fn() }));
vi.mock('../analytics/analytics', () => analytics);

const Purchases = vi.hoisted(() => ({
  configure: vi.fn(),
  addCustomerInfoUpdateListener: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  logIn: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));
vi.mock('react-native-purchases', () => ({ default: Purchases }));

function customerInfo(premium: boolean) {
  return { entitlements: { active: premium ? { premium: {} } : {} } };
}

function storePackage(
  identifier: string,
  productId: string,
  introPrice: { price: number; periodNumberOfUnits: number; periodUnit: string } | null = null,
) {
  return { identifier, product: { identifier: productId, priceString: '¥100', introPrice } };
}

const ANNUAL = storePackage('$rc_annual', 'premium_annual', {
  price: 0,
  periodNumberOfUnits: 1,
  periodUnit: 'WEEK',
});
const LIFETIME = storePackage('$rc_lifetime', 'premium_lifetime');
const CREDITS_30 = storePackage('credits30', 'credits_30');
const CREDITS_10 = storePackage('credits10', 'credits_10');

/** A fresh module: `startPurchases` configures once per launch. */
async function load() {
  vi.resetModules();
  const store = await import('./purchases-store');
  const { APP_CONFIG } = await import('../../config');
  return { ...store, APP_CONFIG };
}

describe('purchases-store', () => {
  beforeEach(() => {
    Purchases.getCustomerInfo.mockResolvedValue(customerInfo(false));
    Purchases.getOfferings.mockResolvedValue({
      current: { annual: ANNUAL, lifetime: LIFETIME },
      all: { credits: { availablePackages: [CREDITS_30, CREDITS_10] } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads the entitlement and the plans on sale', async () => {
    const { startPurchases, usePurchases } = await load();
    Purchases.getCustomerInfo.mockResolvedValue(customerInfo(true));

    await startPurchases();

    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_test' });
    expect(usePurchases.getState()).toEqual({
      available: true,
      entitled: true,
      annual: { id: '$rc_annual', priceString: '¥100', trialDays: 7, credits: null },
      lifetime: { id: '$rc_lifetime', priceString: '¥100', trialDays: null, credits: null },
      creditPacks: [
        { id: 'credits10', priceString: '¥100', trialDays: null, credits: 10 },
        { id: 'credits30', priceString: '¥100', trialDays: null, credits: 30 },
      ],
    });
  });

  it('stays unavailable and unlocks nothing without an API key', async () => {
    const { startPurchases, loadPurchases, linkPurchasesAccount, usePurchases, APP_CONFIG } =
      await load();
    Object.assign(APP_CONFIG, { revenueCatApiKey: null });

    await startPurchases();
    await loadPurchases();
    await linkPurchasesAccount('account');

    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.logIn).not.toHaveBeenCalled();
    expect(usePurchases.getState()).toMatchObject({ available: false, entitled: false });
  });

  it('can load again after the store did not answer', async () => {
    const { startPurchases, loadPurchases, usePurchases } = await load();
    const error = new Error('offline');
    Purchases.getOfferings.mockRejectedValueOnce(error);

    await startPurchases();
    expect(usePurchases.getState().available).toBe(false);
    expect(analytics.reportError).toHaveBeenCalledWith(error, 'purchases.load');

    await loadPurchases();
    expect(usePurchases.getState().available).toBe(true);
  });

  it('loads once when several screens ask together, and not again once loaded', async () => {
    const { startPurchases, loadPurchases } = await load();
    Purchases.getOfferings.mockRejectedValueOnce(new Error('offline'));
    await startPurchases();

    await Promise.all([loadPurchases(), loadPurchases()]);
    await loadPurchases();

    expect(Purchases.getOfferings).toHaveBeenCalledTimes(2);
  });

  it('follows entitlement changes reported by the store', async () => {
    const { startPurchases, usePurchases } = await load();
    await startPurchases();
    const [listener] = Purchases.addCustomerInfoUpdateListener.mock.calls[0] as [
      (info: unknown) => void,
    ];

    listener(customerInfo(true));

    expect(usePurchases.getState().entitled).toBe(true);
  });

  it('unlocks premium after a purchase', async () => {
    const { startPurchases, purchase, usePurchases } = await load();
    await startPurchases();
    Purchases.purchasePackage.mockResolvedValue({ customerInfo: customerInfo(true) });

    await expect(purchase('$rc_annual')).resolves.toBe('purchased');

    expect(Purchases.purchasePackage).toHaveBeenCalledWith(ANNUAL);
    expect(usePurchases.getState().entitled).toBe(true);
    expect(analytics.track).toHaveBeenCalledWith({
      name: 'purchase_completed',
      productId: 'premium_annual',
    });
  });

  it('tells a cancelled purchase apart from a failed one', async () => {
    const { startPurchases, purchase } = await load();
    await startPurchases();
    const failure = new Error('payment declined');
    Purchases.purchasePackage
      .mockRejectedValueOnce({ userCancelled: true })
      .mockRejectedValueOnce(failure);

    await expect(purchase('credits10')).resolves.toBe('cancelled');
    await expect(purchase('credits10')).rejects.toBe(failure);
    await expect(purchase('unknown')).rejects.toThrow('Unknown package');
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('restores purchases', async () => {
    const { startPurchases, restorePurchases, usePurchases } = await load();
    await startPurchases();
    Purchases.restorePurchases.mockResolvedValue(customerInfo(true));

    await expect(restorePurchases()).resolves.toBe(true);
    expect(usePurchases.getState().entitled).toBe(true);
  });

  it('links purchases to the AI account', async () => {
    const { startPurchases, linkPurchasesAccount, usePurchases } = await load();
    await startPurchases();
    Purchases.logIn.mockResolvedValue({ customerInfo: customerInfo(true) });

    await linkPurchasesAccount('account');

    expect(Purchases.logIn).toHaveBeenCalledWith('account');
    expect(usePurchases.getState().entitled).toBe(true);
  });

  it('locks premium items only for users without premium', async () => {
    const { isLocked } = await load();

    expect(isLocked({ tier: 'premium' }, false)).toBe(true);
    expect(isLocked({ tier: 'premium' }, true)).toBe(false);
    expect(isLocked({ tier: 'free' }, false)).toBe(false);
  });
});
