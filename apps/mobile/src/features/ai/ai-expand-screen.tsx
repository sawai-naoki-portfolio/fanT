import { UPLOAD_LONG_EDGE } from '@fant/api-types';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildExpandInput } from '../../engine/expand-canvas';
import { decodeImage, imageSize } from '../../engine/photo';
import { PhotoCanvas } from '../../engine/photo-canvas';
import { strings } from '../../i18n';
import { tempDirectory } from '../../lib/temp-files';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { showError } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { Text } from '../../ui/text';
import { colors, radius, softShadow, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { EXPAND_SHAPES, expandLayout, type ExpandShape } from './expand-layout';

/** The upload and its preview for one shape; `null` when the photo cannot be read. */
function useExpandInput(sourceUri: string, shape: ExpandShape) {
  const bytes = useMemo(() => {
    try {
      return new File(sourceUri).bytesSync();
    } catch (error) {
      reportError(error, 'ai.expand.read');
      return null;
    }
  }, [sourceUri]);
  const input = useMemo(() => {
    if (bytes === null) return null;
    try {
      const original = decodeImage(bytes);
      const size = imageSize(original);
      original.dispose();
      const layout = expandLayout(size, shape, UPLOAD_LONG_EDGE);
      return { layout, ...buildExpandInput(bytes, layout) };
    } catch (error) {
      reportError(error, 'ai.expand.build');
      return null;
    }
  }, [bytes, shape]);
  const preview = useMemo(() => (input === null ? null : decodeImage(input.jpeg)), [input]);
  useEffect(() => () => preview?.dispose(), [preview]);
  return { input, preview };
}

/**
 * Widen a photo (AI-13): pick a shape, see the new margin around the photo, and the
 * AI fills it in to continue the scene. The mask goes with it to the generation screen.
 */
export function AiExpandScreen({ sourceUri }: { readonly sourceUri: string }) {
  const { bottom } = useSafeAreaInsets();
  const [shape, setShape] = useState<ExpandShape>('9:16');
  const { input, preview } = useExpandInput(sourceUri, shape);

  const expand = () => {
    if (input === null) return;
    try {
      const stamp = String(Date.now());
      const photo = new File(tempDirectory('ai'), `expand-${stamp}.jpg`);
      const mask = new File(tempDirectory('ai'), `expand-mask-${stamp}.png`);
      photo.writeSync(input.jpeg);
      mask.writeSync(input.mask);
      router.push({
        pathname: '/ai/generate',
        params: { uri: photo.uri, styleId: 'expand', maskUri: mask.uri },
      });
    } catch (error) {
      reportError(error, 'ai.expand.write');
      showError();
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom + spacing.md }]}>
      <ScreenHeader title={strings.ai.expand.title} />
      {input !== null && <PhotoCanvas image={preview} photoSize={input.layout.canvas} />}
      <View style={styles.panel}>
        <Text style={styles.hint}>{strings.ai.expand.hint}</Text>
        <View style={styles.row}>
          {EXPAND_SHAPES.map((candidate) => (
            <Chip
              key={candidate}
              label={strings.ai.expand.shapes[candidate]}
              selected={shape === candidate}
              onPress={() => {
                setShape(candidate);
              }}
            />
          ))}
        </View>
        <Button label={strings.ai.expand.run} disabled={input === null} onPress={expand} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  panel: {
    gap: spacing.md,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...softShadow,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 14 },
});
