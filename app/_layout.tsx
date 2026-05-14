import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { theme } from '../components/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppShell() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="auth/sign-up" />
      <Stack.Screen name="app" />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/safety" />
      <Stack.Screen name="legal/payments" />
    </Stack>
  );
}

function WebAppShell() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return <AppShell />;
}

export default function RootLayout() {
  if (Platform.OS === 'web') {
    return <WebAppShell />;
  }

  return <NativeIntroShell />;
}

function NativeIntroShell() {
  const { useCallback, useEffect, useRef, useState } = require('react');
  const { useVideoPlayer, VideoView } = require('expo-video');
  const { useEventListener } = require('expo');

  const [videoHasFinished, setVideoHasFinished] = useState(false);
  const splashHiddenRef = useRef(false);
  const finishIntro = useCallback(() => {
    if (!splashHiddenRef.current) {
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
    setVideoHasFinished(true);
  }, []);

  const player = useVideoPlayer(
    require('../assets/images/fen_intro.mp4'),
    (p: import('expo-video').VideoPlayer) => {
      p.loop = false;
      p.muted = false;
      p.timeUpdateEventInterval = 0.25;
      p.play();
    }
  );

  useEffect(() => {
    if (videoHasFinished) return;
    const timer = setTimeout(finishIntro, 6500);
    return () => clearTimeout(timer);
  }, [finishIntro, videoHasFinished]);

  useEventListener(player, 'statusChange', ({ status }: { status: string }) => {
    if (status === 'readyToPlay' && !splashHiddenRef.current) {
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
    if (status === 'error') {
      finishIntro();
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }: { currentTime: number }) => {
    const duration = player.duration ?? 0;
    if (!videoHasFinished && duration > 0 && currentTime >= duration - 0.1) {
      finishIntro();
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
    backgroundColor: theme.colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
