import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../i18n';
import { IconButton } from './icon-button';
import { Text } from './text';
import { colors, spacing } from './theme';

interface ScreenHeaderProps {
  readonly title: string;
  /** Buttons on the right. */
  readonly actions?: ReactNode;
  readonly onBack?: () => void;
}

export function ScreenHeader({ title, actions, onBack }: ScreenHeaderProps) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: top + spacing.sm }]}>
      <IconButton
        icon="chevron-back"
        label={strings.common.back}
        style={styles.back}
        onPress={
          onBack ??
          (() => {
            router.back();
          })
        }
      />
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  back: { backgroundColor: colors.surfaceRaised },
  title: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
