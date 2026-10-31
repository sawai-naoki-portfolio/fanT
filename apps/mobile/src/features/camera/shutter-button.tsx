import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../i18n';
import { Bouncy } from '../../ui/bouncy';
import { Gradient } from '../../ui/gradient';
import { colors, softShadow } from '../../ui/theme';

interface ShutterButtonProps {
  readonly disabled: boolean;
  readonly onPress: () => void;
  /** Records videos (CAM-13): a red dot, and a square while recording. */
  readonly video?: { readonly recording: boolean };
}

/** A candy shutter with a heart; the shutter itself gives the haptic tap. */
export function ShutterButton({ disabled, onPress, video }: ShutterButtonProps) {
  const label =
    video === undefined
      ? strings.camera.shutter
      : video.recording
        ? strings.camera.stopRecording
        : strings.camera.record;
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      squash={0.84}
      feedback="none"
      style={[styles.ring, disabled && styles.dimmed]}
      onPress={onPress}
    >
      {video === undefined ? (
        <Gradient style={styles.core}>
          <Ionicons name="heart" size={30} color={colors.accentText} />
        </Gradient>
      ) : (
        <View style={video.recording ? styles.stop : styles.record} />
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 42,
    borderWidth: 4,
    borderColor: colors.accentSoft,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  core: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
  },
  record: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.danger },
  stop: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.danger },
  dimmed: { opacity: 0.5 },
});
