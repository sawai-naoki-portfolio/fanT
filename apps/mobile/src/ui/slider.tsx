import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { Gradient } from './gradient';
import { haptics } from './haptics';
import { Text } from './text';
import { colors, radius, softShadow, spacing } from './theme';

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  /** Shown beside the label, e.g. "80%". */
  readonly formatValue?: (value: number) => string;
  /** A centre mark for two-sided values (e.g. -1…1). */
  readonly centered?: boolean;
}

const STEPS = 20;
const THUMB = 28;

/**
 * A candy slider with a heart thumb, driven by touch, and by swipe up/down for
 * screen readers (accessibility "adjustable"). Ticks lightly at the ends and the
 * centre so the limits can be felt.
 */
export function Slider({ label, value, min, max, onChange, formatValue, centered }: SliderProps) {
  const [width, setWidth] = useState(0);
  const fraction = max > min ? (value - min) / (max - min) : 0;

  const valueAt = (x: number) => {
    const clamped = Math.min(1, Math.max(0, width > 0 ? x / width : 0));
    return min + clamped * (max - min);
  };
  const update = (x: number) => {
    const next = valueAt(x);
    const landmarks = centered === true ? [min, (min + max) / 2, max] : [min, max];
    if (landmarks.some((mark) => next === mark && value !== mark)) haptics.select();
    onChange(next);
  };
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (event) => {
      update(event.x);
    },
    onUpdate: (event) => {
      update(event.x);
    },
  });

  const step = (max - min) / STEPS;
  const display = formatValue?.(value) ?? `${String(Math.round(fraction * 100))}%`;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: display }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
        onChange(Math.min(max, Math.max(min, value + delta)));
      }}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{display}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.hitArea}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
        >
          <View style={styles.track}>
            {centered === true && <View style={styles.center} />}
            <Gradient style={[styles.fill, { width: `${String(fraction * 100)}%` }]} />
          </View>
          <View style={[styles.thumb, softShadow, { left: fraction * width - THUMB / 2 }]}>
            <Text style={styles.heart}>♥</Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  value: { color: colors.accent, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hitArea: { height: 36, justifyContent: 'center' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  center: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: 8,
    backgroundColor: colors.textMuted,
  },
  fill: { height: 8, borderRadius: radius.pill },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: colors.accentSoft,
    backgroundColor: colors.surface,
  },
  heart: { color: colors.accent, fontSize: 13, lineHeight: 16 },
});
