import type { Character } from '@fant/content-schema';
import { FlatList, StyleSheet, View } from 'react-native';

import { CharacterPreview } from '../../engine/character-preview';
import { localized, strings } from '../../i18n';
import { Chip } from '../../ui/chip';
import { Sheet } from '../../ui/sheet';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { findCharacter } from '../content/lookup';
import { isLocked } from '../purchases/purchases-store';
import { useCameraSettings } from './camera-store';
import { useContent } from '../content/content-store';
import { Text } from '../../ui/text';

const SIZE = 64;

interface CharacterStripProps {
  readonly characters: readonly Character[];
  readonly selectedId: string;
  readonly premium: boolean;
  readonly onSelect: (character: Character) => void;
  readonly onOpenSettings: () => void;
}

/** The characters to wear (CHR-02); tapping the selected one opens its colours (S-13). */
export function CharacterStrip({
  characters,
  selectedId,
  premium,
  onSelect,
  onOpenSettings,
}: CharacterStripProps) {
  const variants = useCameraSettings((state) => state.characterVariants);
  return (
    <FlatList
      horizontal
      data={characters}
      keyExtractor={(character) => character.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const variant =
          item.variants.find(({ id }) => id === variants[item.id]) ?? item.variants[0];
        const selected = item.id === selectedId;
        const name = localized(item.name);
        const locked = isLocked(item, premium);
        return (
          <Bouncy
            accessibilityRole="button"
            accessibilityLabel={locked ? strings.common.premiumItem(name) : name}
            accessibilityState={{ selected }}
            style={styles.item}
            onPress={() => {
              if (selected) onOpenSettings();
              else onSelect(item);
            }}
          >
            <View style={[styles.thumb, selected && styles.selected]}>
              {variant !== undefined && (
                <CharacterPreview character={item} variant={variant} size={SIZE} />
              )}
              {locked && <Text style={styles.lock}>👑</Text>}
            </View>
            <Text numberOfLines={1} style={[styles.name, selected && styles.selectedName]}>
              {name}
            </Text>
          </Bouncy>
        );
      }}
    />
  );
}

/** Colour variants of the selected character (CHR-03). */
export function CharacterSheet({
  characterId,
  visible,
  onClose,
}: {
  readonly characterId: string;
  readonly visible: boolean;
  readonly onClose: () => void;
}) {
  const manifest = useContent((state) => state.manifest);
  const variantId = useCameraSettings((state) => state.characterVariants[characterId]);
  const resolved = findCharacter(manifest, characterId, variantId);
  if (resolved === null) return null;
  const { character, variant } = resolved;
  return (
    <Sheet visible={visible} title={localized(character.name)} onClose={onClose}>
      <Text style={styles.label}>{strings.character.colors}</Text>
      <View style={styles.variants}>
        {character.variants.map((candidate) => (
          <Chip
            key={candidate.id}
            label={localized(candidate.name)}
            selected={candidate.id === variant.id}
            onPress={() => {
              useCameraSettings.getState().selectCharacterVariant(character.id, candidate.id);
            }}
          />
        ))}
      </View>
      <View style={styles.preview}>
        <CharacterPreview character={character} variant={variant} size={160} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  item: { width: SIZE + 8, alignItems: 'center', gap: 4 },
  thumb: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: colors.surface,
    overflow: 'hidden',
    backgroundColor: colors.lavenderSoft,
    ...softShadow,
  },
  selected: { borderColor: colors.accent },
  lock: { position: 'absolute', top: 2, left: 6, fontSize: 11 },
  name: { color: colors.textMuted, fontSize: 11 },
  selectedName: { color: colors.accent, fontWeight: '800' },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preview: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.lavenderSoft,
  },
});
