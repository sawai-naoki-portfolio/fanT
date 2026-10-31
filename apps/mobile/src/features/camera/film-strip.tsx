import { isNew, type Film } from '@fant/content-schema';
import { FlatList, StyleSheet, View } from 'react-native';

import { useFilmThumbnail } from '../../engine/film-thumbnails';
import { Canvas, SkiaImage } from '../../engine/skia';
import { localized, strings } from '../../i18n';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { isLocked } from '../purchases/purchases-store';
import { Text } from '../../ui/text';

const THUMB_WIDTH = 54;
const THUMB_HEIGHT = 72;

interface FilmStripProps {
  readonly films: readonly Film[];
  readonly selectedId: string;
  readonly favorites: readonly string[];
  readonly premium: boolean;
  readonly onSelect: (film: Film) => void;
  /** Tapping the selected film opens its settings (S-11). */
  readonly onOpenSettings: () => void;
  readonly onToggleFavorite: (film: Film) => void;
}

/** Favourites first (FLM-08), then the manifest's order. */
export function orderFilms(films: readonly Film[], favorites: readonly string[]): Film[] {
  const favoriteSet = new Set(favorites);
  return [
    ...films.filter(({ id }) => favoriteSet.has(id)),
    ...films.filter(({ id }) => !favoriteSet.has(id)),
  ];
}

function FilmItem({
  film,
  index,
  selected,
  favorite,
  locked,
  onPress,
  onLongPress,
}: {
  readonly film: Film;
  /** Alternates the tilt so the strip looks like scattered prints. */
  readonly index: number;
  readonly selected: boolean;
  readonly favorite: boolean;
  readonly locked: boolean;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
}) {
  const thumbnail = useFilmThumbnail(film);
  const name = localized(film.name);
  const badge = isNew(film, new Date()) ? strings.common.new : null;
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={locked ? strings.common.premiumItem(name) : name}
      accessibilityState={{ selected }}
      accessibilityHint={favorite ? strings.film.removeFavorite : strings.film.addFavorite}
      style={styles.item}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View
        style={[
          styles.print,
          { transform: [{ rotate: selected ? '0deg' : index % 2 === 0 ? '-4deg' : '4deg' }] },
          selected && styles.selectedPrint,
        ]}
      >
        <View style={styles.thumb}>
          {thumbnail !== null && (
            <Canvas style={styles.canvas}>
              <SkiaImage
                image={thumbnail}
                x={0}
                y={0}
                width={THUMB_WIDTH}
                height={THUMB_HEIGHT}
                fit="cover"
              />
            </Canvas>
          )}
          {locked && <Text style={styles.lock}>👑</Text>}
          {favorite && <Text style={styles.favorite}>💗</Text>}
          {badge !== null && <Text style={styles.newBadge}>{badge}</Text>}
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.name, selected && styles.selectedName]}>
        {name}
      </Text>
    </Bouncy>
  );
}

/** The films to shoot with (FLM-01): sample thumbnails, premium and NEW badges. */
export function FilmStrip({
  films,
  selectedId,
  favorites,
  premium,
  onSelect,
  onOpenSettings,
  onToggleFavorite,
}: FilmStripProps) {
  return (
    <FlatList
      horizontal
      data={orderFilms(films, favorites)}
      keyExtractor={(film) => film.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => (
        <FilmItem
          film={item}
          index={index}
          selected={item.id === selectedId}
          favorite={favorites.includes(item.id)}
          locked={isLocked(item, premium)}
          onPress={() => {
            if (item.id === selectedId) onOpenSettings();
            else onSelect(item);
          }}
          onLongPress={() => {
            onToggleFavorite(item);
          }}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  item: { width: THUMB_WIDTH + 14, alignItems: 'center', gap: 6 },
  // A tiny instant print: white frame, thicker at the bottom.
  print: {
    padding: 3,
    paddingBottom: 9,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    ...softShadow,
  },
  selectedPrint: { borderColor: colors.accent },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  canvas: { width: THUMB_WIDTH, height: THUMB_HEIGHT },
  lock: { position: 'absolute', top: 2, left: 3, fontSize: 11 },
  favorite: { position: 'absolute', top: 1, right: 3, fontSize: 11 },
  newBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.accentText,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: colors.accent,
  },
  name: { color: colors.textMuted, fontSize: 11 },
  selectedName: { color: colors.accent, fontWeight: '800' },
});
