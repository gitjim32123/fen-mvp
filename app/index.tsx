import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTheme } from '../components/ui/ThemeProvider';
import type { Theme } from '../components/ui/theme';

export default function Index() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isWeb = Platform.OS === "web";
  const [target, setTarget] = useState<"/app" | "/auth/sign-in" | null>(null);
  const [introDone, setIntroDone] = useState(!isWeb);
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setTarget(data.session ? "/app" : "/auth/sign-in");
    }).catch(() => {
      if (active) setTarget("/auth/sign-in");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isWeb) return;
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    });
    const timer = setTimeout(() => setIntroDone(true), 1700);
    animation.start();
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [fade, isWeb]);

  if (isWeb && !introDone) {
    return (
      <View style={styles.introScreen}>
        <View style={styles.glow} />
        <Animated.View
          style={[
            styles.introContent,
            {
              opacity: fade,
              transform: [
                {
                  scale: fade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Image source={require("../assets/images/fen-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.tagline}>Fast Earn Nearby</Text>
          <Text style={styles.subtle}>Local help. Clear agreements. Direct arrangements.</Text>
        </Animated.View>
      </View>
    );
  }

  if (!target) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return <Redirect href={target} />;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
  },
  introScreen: {
    flex: 1,
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
    overflow: "hidden",
    padding: 24,
  },
  glow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: theme.colors.accentSoft,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 80,
  },
  introContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  logo: {
    width: 220,
    height: 96,
    maxWidth: "80%",
  },
  tagline: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  subtle: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  });
}
