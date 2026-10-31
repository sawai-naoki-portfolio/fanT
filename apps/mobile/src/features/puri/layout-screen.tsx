import type { Layout } from '@fant/content-schema';
import { router } from 'expo-router';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { localized, strings } from '../../i18n';
import { ScreenHeader } from '../../ui/screen-header';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { useContent } from '../content/content-store';
import { available } from '../content/lookup';
import { isLocked, usePremium } from '../purchases/purchases-store';
import { usePuriSession } from './puri-session';
import { Text } from '../../ui/text';

/** A sheet drawn with views: background and empty cells. */
function LayoutPreview({ layout, width }: { readonly layout: Layout; readonly width: number }) {
  const height = (width * layout.height) / layout.width;
  return (
    <View style={{ width, height, backgroundColor: layout.background.color, borderRadius: 8 }}>
      {layout.cells.map((cell, index) => (
        <View
          key={String(index)}
          style={[
            styles.cell,
            {
              left: cell.x * width,
              top: cell.y * height,
              width: cell.width * width,
              height: cell.height * height,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Choose a sheet (S-30, PRI-01). Premium sheets can be shot; finishing asks for premium. */
export function LayoutScreen() {
  const layouts = available(useContent((state) => state.manifest).layouts);
  const premium = usePremium();
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.md * 3) / 2 - spacing.sm * 2;
  return (
    <View style={styles.container}>
      <ScreenHeader title={strings.puri.chooseLayout} />
      <FlatList
        data={layouts}
        numColumns={2}
        keyExtractor={(layout) => layout.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const name = localized(item.name);
          const locked = isLocked(item, premium);
          return (
            <Bouncy
              accessibilityRole="button"
              accessibilityLabel={strings.common.list([
                locked ? strings.common.premiumItem(name) : name,
                strings.puri.shots(item.cells.length),
              ])}
              style={styles.card}
              onPress={() => {
                usePuriSession.getState().start(item.id, item.cells.length);
                router.push('/puri/shoot');
              }}
            >
              <LayoutPreview layout={item} width={cardWidth} />
              <Text style={styles.name}>{locked ? `👑 ${name}` : name}</Text>
            </Bouncy>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  grid: { gap: spacing.md, padding: spacing.md },
  row: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  cell: { position: 'absolute', borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  name: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
