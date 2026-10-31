import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../i18n';
import { IconButton } from './icon-button';
import { Text } from './text';
import { colors, radius, spacing } from './theme';

interface SheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * A rounded bottom sheet over the camera (S-11/S-12/S-13). The camera stays visible
 * above it so changes show live in the preview.
 */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={strings.common.close}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View style={[styles.sheet, { paddingBottom: bottom + spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <IconButton icon="close" label={strings.common.close} size={20} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '55%',
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.background,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  content: { gap: spacing.md, paddingBottom: spacing.md },
});
