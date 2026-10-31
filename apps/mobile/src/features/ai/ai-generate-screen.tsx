import { isVideoTool, REPORT_REASONS } from '@fant/api-types';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markAiGenerated } from '../../engine/photo';
import { strings } from '../../i18n';
import { Button } from '../../ui/button';
import { showError } from '../../ui/dialogs';
import { ScreenHeader } from '../../ui/screen-header';
import { HeroEmoji } from '../../ui/hero-emoji';
import { colors, radius, spacing } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { addPhoto } from '../album/album-db';
import { newPhotoId } from '../photo/photo-service';
import { LoopingVideo } from '../video/looping-video';
import { saveAiVideo } from '../video/video-service';
import { useSettings } from '../settings/settings-store';
import { reportGeneration } from './ai-client';
import { useGeneration } from './use-generation';
import { Text } from '../../ui/text';

/** Progress with cancel (S-43) and the result with save, report and retry (S-44). */
export function AiGenerateScreen({
  sourceUri,
  styleId,
  maskUri,
}: {
  readonly sourceUri: string;
  readonly styleId: string;
  /** A masked tool's mask (AI-10, AI-13). */
  readonly maskUri: string | null;
}) {
  const { state, cancel } = useGeneration(sourceUri, styleId, maskUri);
  const { bottom } = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const video = isVideoTool(styleId);

  const saveVideo = async (resultUri: string) => {
    setSaving(true);
    try {
      const photo = await saveAiVideo(resultUri);
      router.replace({ pathname: '/photo/[id]', params: { id: photo.id } });
    } catch (error) {
      reportError(error, 'ai.saveVideo');
      showError();
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (state.phase !== 'done') return;
    if (video) {
      void saveVideo(state.resultUri);
      return;
    }
    setSaving(true);
    try {
      const marked = markAiGenerated(new File(state.resultUri).bytesSync());
      const photo = addPhoto({
        id: newPhotoId(),
        kind: 'ai',
        output: marked.jpeg,
        width: marked.width,
        height: marked.height,
        hasOriginal: false,
        recipe: null,
        originalRetentionDays: useSettings.getState().originalRetentionDays,
      });
      router.replace({ pathname: '/photo/[id]', params: { id: photo.id } });
    } catch (error) {
      reportError(error, 'ai.save');
      showError();
    } finally {
      setSaving(false);
    }
  };

  const report = () => {
    if (state.phase !== 'done') return;
    Alert.alert(strings.ai.report, undefined, [
      ...REPORT_REASONS.map((reason) => ({
        text: strings.ai.reasons[reason],
        onPress: () => {
          void reportGeneration(state.id, reason)
            .then(() => {
              Alert.alert(strings.ai.reported);
            })
            .catch((error: unknown) => {
              reportError(error, 'ai.report');
              showError();
            });
        },
      })),
      { text: strings.common.cancel, style: 'cancel' as const },
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: bottom + spacing.md }]}>
      <ScreenHeader title={state.phase === 'done' ? strings.ai.result : strings.ai.title} />
      <View style={styles.body}>
        {state.phase === 'running' && (
          <>
            <HeroEmoji emoji="🪄" tint={colors.lavenderSoft} />
            <ActivityIndicator size="large" color={colors.accent} />
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {video ? strings.ai.generatingVideo : strings.ai.generating}
            </Text>
          </>
        )}
        {state.phase === 'done' &&
          (video ? (
            <LoopingVideo uri={state.resultUri} style={styles.result} />
          ) : (
            <Image source={{ uri: state.resultUri }} style={styles.result} contentFit="contain" />
          ))}
        {state.phase === 'failed' && <HeroEmoji emoji="🥺" />}
        {state.phase === 'failed' && (
          <Text style={styles.message}>
            {state.code === 'moderation_blocked'
              ? strings.ai.blocked
              : state.code === 'offline'
                ? strings.common.offline
                : state.code === 'insufficient_credits'
                  ? strings.ai.notEnoughCredits
                  : strings.ai.failed}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        {state.phase === 'running' && (
          <Button label={strings.ai.cancel} variant="secondary" onPress={() => void cancel()} />
        )}
        {state.phase === 'done' && (
          <>
            <Button label={strings.common.save} busy={saving} onPress={save} />
            <Button label={strings.ai.report} variant="secondary" onPress={report} />
          </>
        )}
        {state.phase !== 'running' && (
          <Button
            label={strings.ai.regenerate}
            variant="secondary"
            onPress={() => {
              router.back();
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  message: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },
  result: {
    ...StyleSheet.absoluteFill,
    margin: spacing.md,
    borderRadius: radius.lg,
  },
  actions: { gap: spacing.sm, paddingHorizontal: spacing.md },
});
