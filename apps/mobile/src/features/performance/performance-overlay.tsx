import { Pressable, StyleSheet } from 'react-native';

import { strings } from '../../i18n';
import { Text } from '../../ui/text';
import type { FrameStatsSummary } from './frame-stats.worklet';

interface PerformanceOverlayProps {
  readonly stats: FrameStatsSummary | null;
  readonly analysisEnabled: boolean;
  readonly onToggleAnalysis: () => void;
  readonly top: number;
}

/**
 * Preview frame rate and frame-thread timings for measuring on devices (P-1), shown
 * in internal builds only. Refreshed every second. Tapping it
 * turns face detection on and off so its cost can be measured on its own.
 */
export function PerformanceOverlay({
  stats,
  analysisEnabled,
  onToggleAnalysis,
  top,
}: PerformanceOverlayProps) {
  const analysis = analysisEnabled
    ? strings.performance.faces(
        formatMs(stats?.analysisAvgMs ?? null),
        formatMs(stats?.analysisMaxMs ?? null),
      )
    : strings.performance.facesOff;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.performance.label}
      accessibilityHint={strings.performance.hint}
      style={[styles.overlay, { top: top + 8 }]}
      onPress={onToggleAnalysis}
    >
      <Text style={styles.line}>{stats === null ? '-- fps' : `${stats.fps.toFixed(1)} fps`}</Text>
      <Text style={styles.line}>
        {strings.performance.render(
          formatMs(stats?.renderAvgMs ?? null),
          formatMs(stats?.renderMaxMs ?? null),
        )}
      </Text>
      <Text style={styles.line}>{analysis}</Text>
    </Pressable>
  );
}

function formatMs(ms: number | null): string {
  return ms === null ? '--' : `${ms.toFixed(1)}ms`;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  line: { color: '#0f0', fontSize: 12, fontVariant: ['tabular-nums'] },
});
