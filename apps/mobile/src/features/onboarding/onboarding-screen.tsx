import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { HeroEmoji } from '../../ui/hero-emoji';
import { Text } from '../../ui/text';
import { colors, radius, spacing } from '../../ui/theme';
import { useSettings } from '../settings/settings-store';

/** One bubble tint per page so each page feels different. */
const TINTS = [colors.accentSoft, colors.lavenderSoft, colors.mintSoft] as const;

/**
 * The first launch (S-02, ONB-01): the modes in three pages at most, ending with
 * how the camera and photos are used. Camera access is asked for on the camera
 * screen right after, with its own explanation (ONB-02).
 */
export function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const { top, bottom } = useSafeAreaInsets();
  const pages = strings.onboarding.pages;
  const current = pages[page];
  const last = page === pages.length - 1;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: top + spacing.xl, paddingBottom: bottom + spacing.lg },
      ]}
    >
      <View style={styles.dots} accessibilityElementsHidden>
        {pages.map((_, index) => (
          <View key={String(index)} style={[styles.dot, index === page && styles.activeDot]} />
        ))}
      </View>
      {current !== undefined && (
        // Keyed by page so each page slides in.
        <Animated.View key={page} entering={FadeInRight.springify()} style={styles.body}>
          <HeroEmoji emoji={current.emoji} tint={TINTS[page % TINTS.length]} />
          <Text accessibilityRole="header" style={styles.title}>
            {current.title}
          </Text>
          <Text style={styles.text}>{current.body}</Text>
        </Animated.View>
      )}
      <Button
        label={last ? strings.onboarding.start : strings.onboarding.next}
        onPress={() => {
          if (!last) {
            setPage(page + 1);
            return;
          }
          useSettings.getState().update({ onboardingCompleted: true });
          router.replace('/');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  activeDot: { width: 24, backgroundColor: colors.accent },
  body: { gap: spacing.lg },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 40,
  },
  text: { color: colors.textMuted, fontSize: 16, lineHeight: 28, textAlign: 'center' },
});
