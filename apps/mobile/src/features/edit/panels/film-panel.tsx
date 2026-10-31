import { calendarDateOf, DATE_STAMP_ORANGE } from '@fant/filters';
import { StyleSheet, View } from 'react-native';

import { localized, strings } from '../../../i18n';
import { Slider } from '../../../ui/slider';
import { Text } from '../../../ui/text';
import { colors } from '../../../ui/theme';
import { Toggle } from '../../../ui/toggle';
import { useCameraSettings } from '../../camera/camera-store';
import { FilmStrip } from '../../camera/film-strip';
import { useContent } from '../../content/content-store';
import { available, findFilm } from '../../content/lookup';
import { usePremium } from '../../purchases/purchases-store';
import type { PanelProps } from './panel-props';

/** The film, its strength and the date imprint (EDT-01, DCO-04). */
/** `takenAt` dates the imprint; without it, today. */
export function FilmPanel({
  recipe,
  update,
  takenAt,
}: PanelProps & { readonly takenAt: number | null }) {
  const manifest = useContent((state) => state.manifest);
  const favorites = useCameraSettings((state) => state.favoriteFilms);
  const premium = usePremium();
  const film = findFilm(manifest, recipe.film.id);
  return (
    <>
      <FilmStrip
        films={available(manifest.films)}
        selectedId={film.id}
        favorites={favorites}
        premium={premium}
        onSelect={(next) => {
          update({
            film: {
              id: next.id,
              intensity: recipe.film.intensity === 0 ? 1 : recipe.film.intensity,
            },
          });
        }}
        onOpenSettings={() => undefined}
        onToggleFavorite={(next) => {
          useCameraSettings.getState().toggleFavorite(next.id);
        }}
      />
      <Slider
        label={strings.camera.filmStrength(localized(film.name))}
        value={recipe.film.intensity}
        min={0}
        max={1}
        onChange={(intensity) => {
          update({ film: { ...recipe.film, intensity } }, 'intensity');
        }}
      />
      <View style={styles.row}>
        <Text style={styles.label}>{strings.film.dateStamp}</Text>
        <Toggle
          label={strings.film.dateStamp}
          value={recipe.dateStamp !== null}
          onChange={(enabled) => {
            update({
              dateStamp: enabled
                ? {
                    date: calendarDateOf(new Date(takenAt ?? Date.now())),
                    format: 'yy mm dd',
                    color: DATE_STAMP_ORANGE,
                  }
                : null,
            });
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
