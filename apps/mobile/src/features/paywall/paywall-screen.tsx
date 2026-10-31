import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { Bouncy } from '../../ui/bouncy';
import { Button } from '../../ui/button';
import { showError, showMessage } from '../../ui/dialogs';
import { HeroEmoji } from '../../ui/hero-emoji';
import { IconButton } from '../../ui/icon-button';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError, track } from '../analytics/analytics';
import { usePaywallLead } from '../remote-config/remote-config';
import {
  loadPurchases,
  purchase,
  restorePurchases,
  usePremium,
  usePurchases,
  type StorePackage,
} from '../purchases/purchases-store';
import { Text } from '../../ui/text';

/** One plan with its price, period and terms in plain view (04 §5). */
function Plan({
  title,
  price,
  note,
  selected,
  onPress,
}: {
  readonly title: string;
  readonly price: string;
  readonly note: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Bouncy
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={strings.common.list([title, price])}
      accessibilityHint={note}
      style={[styles.plan, selected && styles.selectedPlan]}
      onPress={onPress}
    >
      <Text style={styles.planTitle}>
        {selected ? '💗 ' : ''}
        {title}
      </Text>
      <Text style={styles.price}>{price}</Text>
      <Text style={styles.note}>{note}</Text>
    </Bouncy>
  );
}

/**
 * Plan comparison (S-60, PAY-01/02/04/05). Shown only when the user reaches for a
 * premium item or opens it from settings, never at launch; the close button is
 * there from the start (04 §5).
 */
export function PaywallScreen({ trigger }: { readonly trigger: string }) {
  const { available, annual, lifetime } = usePurchases();
  const premium = usePremium();
  const { top, bottom } = useSafeAreaInsets();
  const [selected, setSelected] = useState<StorePackage | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = selected ?? annual ?? lifetime;
  const remoteLead = usePaywallLead();
  const leadVariant = remoteLead?.variant;

  useEffect(() => {
    track({ name: 'paywall_shown', trigger, leadVariant });
    // Retries when the plans could not be loaded at launch.
    void loadPurchases();
  }, [trigger, leadVariant]);

  const buy = async () => {
    if (chosen === null) return;
    setBusy(true);
    try {
      if ((await purchase(chosen.id)) === 'purchased') {
        showMessage(strings.paywall.purchased);
        router.back();
      }
    } catch (error) {
      reportError(error, 'paywall.purchase');
      showError();
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const restored = await restorePurchases();
      showMessage(restored ? strings.paywall.restored : strings.paywall.nothingToRestore);
    } catch (error) {
      reportError(error, 'paywall.restore');
      showError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <IconButton
        icon="close"
        label={strings.common.close}
        style={styles.close}
        onPress={() => {
          router.back();
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]}>
        <HeroEmoji emoji="👑" tint={colors.lemon} />
        <Text accessibilityRole="header" style={styles.title}>
          {strings.paywall.title}
        </Text>
        {trigger !== 'settings' && <Text style={styles.lead}>{strings.paywall.locked}</Text>}
        <Text style={styles.lead}>{remoteLead?.text ?? strings.paywall.lead}</Text>
        <View style={styles.features}>
          {strings.paywall.features.map((feature) => (
            <Text key={feature} style={styles.feature}>
              {feature}
            </Text>
          ))}
        </View>
        {premium ? (
          <Text style={styles.lead}>{strings.settings.premiumActive}</Text>
        ) : !available ? (
          <Text style={styles.note}>{strings.paywall.unavailable}</Text>
        ) : (
          <>
            {annual !== null && (
              <Plan
                title={strings.paywall.annual}
                price={strings.paywall.perYear(annual.priceString)}
                note={
                  annual.trialDays === null
                    ? strings.paywall.renewal
                    : `${strings.paywall.trial(annual.trialDays)}\n${strings.paywall.renewal}`
                }
                selected={chosen?.id === annual.id}
                onPress={() => {
                  setSelected(annual);
                }}
              />
            )}
            {lifetime !== null && (
              <Plan
                title={strings.paywall.lifetime}
                price={strings.paywall.once(lifetime.priceString)}
                note={strings.paywall.lifetimeNote}
                selected={chosen?.id === lifetime.id}
                onPress={() => {
                  setSelected(lifetime);
                }}
              />
            )}
            <Button
              label={strings.paywall.subscribe}
              variant="premium"
              busy={busy}
              disabled={chosen === null}
              onPress={() => void buy()}
            />
          </>
        )}
        <View style={styles.links}>
          <Button
            label={strings.paywall.restore}
            variant="secondary"
            disabled={busy || !available}
            onPress={() => void restore()}
          />
          <Button
            label={strings.paywall.terms}
            variant="secondary"
            onPress={() => {
              router.push({ pathname: '/settings/legal/[doc]', params: { doc: 'terms' } });
            }}
          />
          <Button
            label={strings.paywall.privacy}
            variant="secondary"
            onPress={() => {
              router.push({ pathname: '/settings/legal/[doc]', params: { doc: 'privacy' } });
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  close: { alignSelf: 'flex-end', margin: spacing.md },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  lead: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  features: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  feature: { color: colors.text, fontSize: 15, fontWeight: '700' },
  plan: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedPlan: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  planTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  // Price and renewal period in large type (03 §7).
  price: { color: colors.text, fontSize: 22, fontWeight: '800' },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  links: { gap: spacing.sm, marginTop: spacing.md },
});
