import {
  calendarDateOf,
  DATE_STAMP_FORMATS,
  DATE_STAMP_ORANGE,
  formatDateStamp,
} from '@fant/filters';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../../i18n';
import { Chip } from '../../ui/chip';
import { showError } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { ScreenHeader } from '../../ui/screen-header';
import { colors, spacing } from '../../ui/theme';
import { Toggle } from '../../ui/toggle';
import { reportError } from '../analytics/analytics';
import { useContent } from '../content/content-store';
import { usePhotoSession } from '../edit/use-photo-session';
import { saveEdit } from '../photo/photo-service';
import type { PhotoRecipe } from '../photo/recipe';
import { usePremium } from '../purchases/purchases-store';
import { DecoEditor } from './deco-editor';
import { Text } from '../../ui/text';

/** Whether the decorations use premium stamps the user does not have. */
function usesLockedStamps(recipe: PhotoRecipe, premiumStampIds: ReadonlySet<string>): boolean {
  return recipe.deco.some((layer) => layer.type === 'stamp' && premiumStampIds.has(layer.stampId));
}

/** Decorations on a photo (S-22), saved into its recipe so they stay editable. */
export function DecoScreen({ id }: { readonly id: string }) {
  const session = usePhotoSession(id, { previewWithoutDeco: true });
  const { bottom } = useSafeAreaInsets();
  const premium = usePremium();
  const stamps = useContent((state) => state.manifest.stamps);
  const [saving, setSaving] = useState(false);
  const { recipe, source, outputSize } = session;

  if (recipe === null || source === null || outputSize === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={strings.deco.title} />
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      </View>
    );
  }

  const save = async () => {
    const premiumStamps = new Set(
      stamps.filter(({ tier }) => tier === 'premium').map(({ id: stampId }) => stampId),
    );
    if (!premium && usesLockedStamps(recipe, premiumStamps)) {
      router.push({ pathname: '/paywall', params: { trigger: 'stamp' } });
      return;
    }
    setSaving(true);
    try {
      await saveEdit(id, source.originalUri, recipe);
      router.back();
    } catch (error) {
      reportError(error, 'deco.save');
      showError();
    } finally {
      setSaving(false);
    }
  };

  const date = recipe.dateStamp;
  const dateControls = (
    <View style={styles.dateControls}>
      <View style={styles.row}>
        <Text style={styles.label}>
          {date === null ? strings.deco.dateOn : strings.deco.dateOff}
        </Text>
        <Toggle
          label={strings.deco.dateOn}
          value={date !== null}
          onChange={(enabled) => {
            session.change({
              ...recipe,
              dateStamp: enabled
                ? {
                    date: calendarDateOf(new Date(session.photo?.createdAt ?? Date.now())),
                    format: 'yy mm dd',
                    color: DATE_STAMP_ORANGE,
                  }
                : null,
            });
          }}
        />
      </View>
      {date !== null && (
        <View style={styles.row}>
          {DATE_STAMP_FORMATS.map((format, index) => (
            <Chip
              key={format}
              label={formatDateStamp(date.date, format)}
              selected={date.format === format}
              locked={index > 0 && !premium}
              onPress={() => {
                if (index > 0 && !premium)
                  router.push({ pathname: '/paywall', params: { trigger: 'date_format' } });
                else session.change({ ...recipe, dateStamp: { ...date, format } });
              }}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <ScreenHeader
        title={strings.deco.title}
        actions={
          <>
            <IconButton
              icon="arrow-undo"
              label={strings.edit.undo}
              disabled={!session.canUndo}
              onPress={session.undo}
            />
            <IconButton
              icon="arrow-redo"
              label={strings.edit.redo}
              disabled={!session.canRedo}
              onPress={session.redo}
            />
            <IconButton
              icon="checkmark"
              label={strings.common.save}
              disabled={saving}
              onPress={() => void save()}
            />
          </>
        }
      />
      <DecoEditor
        image={session.preview}
        photoSize={outputSize}
        layers={recipe.deco}
        premium={premium}
        dateControls={dateControls}
        onChange={(deco, key) => {
          session.change({ ...recipe, deco }, key);
        }}
      />
      {saving && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.accent} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
  dateControls: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
