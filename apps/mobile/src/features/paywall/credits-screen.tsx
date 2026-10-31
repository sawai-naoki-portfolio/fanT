import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { sleep } from '../../lib/sleep';
import { Button } from '../../ui/button';
import { showError, showMessage } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { HeroEmoji } from '../../ui/hero-emoji';
import { colors, spacing } from '../../ui/theme';
import { useAi } from '../ai/ai-store';
import { reportError } from '../analytics/analytics';
import { loadPurchases, purchase, usePurchases } from '../purchases/purchases-store';
import { Text } from '../../ui/text';

/** Credit packs and the annual plan's monthly credits (S-61, PAY-03). */
export function CreditsScreen() {
  const credits = useAi((state) => state.credits);
  const { available, creditPacks } = usePurchases();
  const { bottom } = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void useAi.getState().refreshCredits();
    // Retries when the packs could not be loaded at launch.
    void loadPurchases();
  }, []);

  const buy = async (packageId: string) => {
    setBusy(packageId);
    try {
      if ((await purchase(packageId)) !== 'purchased') return;
      // The server credits the pack when the store confirms it; check a few times.
      const before = useAi.getState().credits?.purchased ?? 0;
      for (let attempt = 0; attempt < 5; attempt++) {
        await sleep(1500);
        await useAi.getState().refreshCredits();
        if ((useAi.getState().credits?.purchased ?? 0) > before) break;
      }
      showMessage(strings.credits.purchased);
    } catch (error) {
      reportError(error, 'credits.purchase');
      showError();
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]}
    >
      <ScreenHeader title={strings.credits.title} />
      <HeroEmoji emoji="💎" tint={colors.lavenderSoft} />
      <Text style={styles.balance}>
        {credits === null ? '…' : strings.credits.balance(credits.total)}
      </Text>
      {!available && <Text style={styles.note}>{strings.paywall.unavailable}</Text>}
      {creditPacks.map((pack) => (
        <Button
          key={pack.id}
          label={`${strings.credits.pack(pack.credits ?? 0)} ${pack.priceString}`}
          variant="premium"
          busy={busy === pack.id}
          disabled={busy !== null}
          onPress={() => void buy(pack.id)}
        />
      ))}
      <Text style={styles.note}>{strings.credits.annualHint}</Text>
      <Button
        label={strings.paywall.title}
        variant="secondary"
        onPress={() => {
          router.push({ pathname: '/paywall', params: { trigger: 'credits' } });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, paddingHorizontal: spacing.md },
  balance: { color: colors.accent, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  note: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
