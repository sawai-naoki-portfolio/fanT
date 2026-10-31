import { useVideoPlayer, VideoView } from 'expo-video';
import type { StyleProp, ViewStyle } from 'react-native';

import { strings } from '../../i18n';

/** Plays an album video on a loop, like a moving photo (CAM-13). */
export function LoopingVideo({
  uri,
  style,
}: {
  readonly uri: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(uri, (created) => {
    created.loop = true;
    created.play();
  });
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls={false}
      accessibilityLabel={strings.photo.video}
    />
  );
}
