import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, StyleSheet, View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppShell() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="auth/sign-up" />
      <Stack.Screen name="app" />
    </Stack>
  );
}

export default function RootLayout() {
  if (Platform.OS === 'web') {
    return <AppShell />;
  }

  const { useEffect, useRef, useState } = require('react');
  const { useVideoPlayer, VideoView } = require('expo-video');
  const { useEventListener } = require('expo');

  const [videoHasFinished, setVideoHasFinished] = useState(false);
  const splashHiddenRef = useRef(false);

  const player = useVideoPlayer(
    require('../assets/images/fen_intro.mp4'),
    (p: import('expo-video').VideoPlayer) => {
      p.loop = false;
      p.muted = false;
      p.timeUpdateEventInterval = 0.25;
      p.play();
    }
  );

  useEventListener(player, 'statusChange', ({ status }: { status: string }) => {
    if (status === 'readyToPlay' && !splashHiddenRef.current) {
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }: { currentTime: number }) => {
    const duration = player.duration ?? 0;
    if (!videoHasFinished && duration > 0 && currentTime >= duration - 0.1) {
      setVideoHasFinished(true);
    }
  });
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

  return <AppShell />;
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