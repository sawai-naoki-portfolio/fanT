import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { samplePixels } from '../../engine/sample-pixels';
import type { SkImage } from '../../engine/skia';
import { strings } from '../../i18n';
import { colors, radius } from '../../ui/theme';
import { lumaHistogram } from './histogram';

const HEIGHT = 48;

/** The edited photo's brightness spread, as bars from black to white (EDT-30). */
export function HistogramView({ image }: { readonly image: SkImage | null }) {
  const bins = useMemo(
    () => (image === null ? [] : lumaHistogram(samplePixels(image, 160).pixels)),
    [image],
  );
  return (
    <View accessible accessibilityLabel={strings.edit.histogram} style={styles.frame}>
      {bins.map((value, index) => (
        <View key={String(index)} style={[styles.bar, { height: Math.max(1, value * HEIGHT) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  bar: { flex: 1, backgroundColor: colors.accentSoft },
});
