import { useEventListener } from 'expo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [videoHasFinished, setVideoHasFinished] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

  const player = useVideoPlayer(
    require('../assets/images/fen_intro.mp4'),
    (player) => {
      player.loop = false;
      player.muted = false;
      player.timeUpdateEventInterval = 0.25;
      player.play();
    }
  );

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && !splashHidden) {
      setSplashHidden(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const duration = player.duration ?? 0;

    if (!videoHasFinished && duration > 0 && currentTime >= duration - 0.1) {
      setVideoHasFinished(true);
    }
  });

  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  if (!videoHasFinished) {
    return (
      <View style={styles.container}>
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
        />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="auth/sign-up" />
      <Stack.Screen name="app" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0714',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
