import type { Film } from '@fant/content-schema';
import { calendarDateOf, DATE_STAMP_FORMATS, formatDateStamp } from '@fant/filters';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { localized, strings } from '../../i18n';
import { Chip } from '../../ui/chip';
import { Sheet } from '../../ui/sheet';
import { Slider } from '../../ui/slider';
import { colors, spacing } from '../../ui/theme';
import { Toggle } from '../../ui/toggle';
import { filmIntensityOf, useCameraSettings } from './camera-store';
import { DateStepper } from './date-stepper';
import { Text } from '../../ui/text';

interface FilmSheetProps {
  readonly film: Film;
  readonly premium: boolean;
  readonly visible: boolean;
  readonly onClose: () => void;
}

/** Strength, date imprint and favourite for the selected film (S-11). */
export function FilmSheet({ film, premium, visible, onClose }: FilmSheetProps) {
  const intensity = useCameraSettings((state) => filmIntensityOf(state, film.id));
  const dateStamp = useCameraSettings((state) => state.dateStamp);
  const favorite = useCameraSettings((state) => state.favoriteFilms.includes(film.id));
  const { setFilmIntensity, setDateStampFormat, toggleFavorite, update } =
    useCameraSettings.getState();
  const today = calendarDateOf(new Date());

  return (
    <Sheet visible={visible} title={localized(film.name)} onClose={onClose}>
      <Slider
        label={strings.camera.strength}
        value={intensity}
        min={0}
        max={1}
        onChange={(value) => {
          setFilmIntensity(film.id, value);
        }}
      />
      <View style={styles.row}>
        <Text style={styles.label}>{strings.film.dateStamp}</Text>
        <Toggle
          label={strings.film.dateStamp}
          value={dateStamp.enabled}
          onChange={(enabled) => {
            update({ dateStamp: { ...dateStamp, enabled } });
          }}
        />
      </View>
      {dateStamp.enabled && (
        <>
          <Text style={styles.label}>{strings.film.dateFormat}</Text>
          <View style={styles.chips}>
            {DATE_STAMP_FORMATS.map((format, index) => {
              // The standard format is free; the others are a premium customization (04 §2).
              const locked = index > 0 && !premium;
              return (
                <Chip
                  key={format}
                  label={formatDateStamp(dateStamp.customDate ?? today, format)}
                  selected={dateStamp.format === format}
                  locked={locked}
                  onPress={() => {
                    if (locked)
                      router.push({ pathname: '/paywall', params: { trigger: 'date_format' } });
                    else setDateStampFormat(format);
                  }}
                />
              );
            })}
          </View>
          <View style={styles.chips}>
            <Chip
              label={strings.film.today}
              selected={dateStamp.customDate === null}
              onPress={() => {
                update({ dateStamp: { ...dateStamp, customDate: null } });
              }}
            />
            <Chip
              label={strings.film.customDate}
              selected={dateStamp.customDate !== null}
              onPress={() => {
                update({ dateStamp: { ...dateStamp, customDate: dateStamp.customDate ?? today } });
              }}
            />
          </View>
          {dateStamp.customDate !== null && (
            <DateStepper
              date={dateStamp.customDate}
              onChange={(customDate) => {
                update({ dateStamp: { ...dateStamp, customDate } });
              }}
            />
          )}
        </>
      )}
      <View style={styles.row}>
        <Text style={styles.label}>{strings.film.favorites}</Text>
        <Toggle
          label={favorite ? strings.film.removeFavorite : strings.film.addFavorite}
          value={favorite}
          onChange={() => {
            toggleFavorite(film.id);
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
