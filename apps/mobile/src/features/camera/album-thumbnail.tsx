import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../i18n';
import { Bouncy } from '../../ui/bouncy';
import { colors, radius, softShadow, TOUCH_TARGET } from '../../ui/theme';
import { useAlbum } from '../album/use-album';

/** The latest photo as a little tilted print; opens the album (S-50). */
export function AlbumThumbnail() {
  const latest = useAlbum()[0];
  return (
    // Tilted from outside: Bouncy owns its own transform.
    <View style={styles.tilt}>
      <Bouncy
        accessibilityRole="button"
        accessibilityLabel={strings.camera.album}
        squash={0.85}
        style={styles.thumb}
        onPress={() => {
          router.push('/album');
        }}
      >
        {latest === undefined ? (
          <View style={styles.empty}>
            <Ionicons name="images" size={22} color={colors.accent} />
          </View>
        ) : (
          <Image
            source={{ uri: latest.outputUri, cacheKey: `${latest.id}-${String(latest.updatedAt)}` }}
            style={styles.image}
            contentFit="cover"
          />
        )}
      </Bouncy>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: TOUCH_TARGET + 4,
    height: TOUCH_TARGET + 4,
    padding: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  tilt: { transform: [{ rotate: '-6deg' }] },
  image: { flex: 1, borderRadius: radius.sm - 4 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm - 4,
    backgroundColor: colors.accentSoft,
  },
});
