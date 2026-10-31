import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { Text } from './text';
import { colors, radius, softShadow, spacing } from './theme';

const VISIBLE_MS = 1500;

interface NoticeState {
  readonly text: string;
  readonly id: number;
}

/** A short message that hides itself; showing it again restarts the timer. */
export function useNotice(): [notice: NoticeState | null, show: (text: string) => void] {
  const [notice, setNotice] = useState<NoticeState | null>(null);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);

  const show = useCallback((text: string) => {
    setNotice((previous) => ({ text, id: (previous?.id ?? 0) + 1 }));
  }, []);

  return [notice, show];
}

/** A bubble that pops in and out; announced to screen readers as it appears. */
export function Notice({ notice }: { readonly notice: NoticeState | null }) {
  if (notice === null) return null;
  return (
    <Animated.View
      key={notice.id}
      entering={ZoomIn.springify().damping(12)}
      exiting={ZoomOut.duration(150)}
      pointerEvents="none"
      style={[styles.bubble, softShadow]}
    >
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {notice.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.accentSoft,
    backgroundColor: colors.surface,
  },
  text: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});
