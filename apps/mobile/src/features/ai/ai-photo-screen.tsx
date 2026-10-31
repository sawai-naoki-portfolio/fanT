import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { showError } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { useAlbum } from '../album/use-album';
import { pickImageFile } from '../photo/import-photo';
import { tempDirectory } from '../../lib/temp-files';

const COLUMNS = 3;

/** Choose the photo to transform, from the album or the device (S-40, AI-01). */
export function AiPhotoScreen() {
  const photos = useAlbum().filter(({ kind }) => kind !== 'ai' && kind !== 'video');
  const { width } = useWindowDimensions();
  const size = (width - spacing.sm * (COLUMNS + 1)) / COLUMNS;

  const choose = (uri: string) => {
    router.push({ pathname: '/ai/styles', params: { uri } });
  };

  const pickFromDevice = async () => {
    try {
      const picked = await pickImageFile();
      if (picked === null) return;
      // A private copy: the picker's file may be removed when the app is backgrounded.
      const copy = new File(tempDirectory('ai'), `source-${String(Date.now())}.jpg`);
      picked.copySync(copy);
      choose(copy.uri);
    } catch (error) {
      reportError(error, 'ai.pick');
      showError();
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={strings.ai.choosePhoto} />
      <View style={styles.actions}>
        <Button
          label={strings.ai.fromDevice}
          variant="secondary"
          onPress={() => void pickFromDevice()}
        />
      </View>
      <FlatList
        data={photos}
        numColumns={COLUMNS}
        keyExtractor={(photo) => photo.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <Bouncy
            accessibilityRole="imagebutton"
            accessibilityLabel={new Date(item.createdAt).toLocaleString(strings.date.locale)}
            onPress={() => {
              choose(item.outputUri);
            }}
          >
            <Image
              source={{ uri: item.outputUri, cacheKey: `${item.id}-${String(item.updatedAt)}` }}
              style={[styles.tile, { width: size, height: size }]}
              contentFit="cover"
            />
          </Bouncy>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  actions: { padding: spacing.md },
  grid: { gap: spacing.sm, padding: spacing.sm },
  row: { gap: spacing.sm },
  tile: { borderRadius: radius.md, borderWidth: 3, borderColor: colors.surface },
});
