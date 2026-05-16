import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Index() {
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
          <Text style={styles.subtle}>Local help. Clear agreements. Direct payment.</Text>
        </Animated.View>
      </View>
    );
  }

  if (!target) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#B56CFF" />
      </View>
    );
  }

  return <Redirect href={target} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E0A14",
  },
  introScreen: {
    flex: 1,
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E0A14",
    overflow: "hidden",
    padding: 24,
  },
  glow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(181,108,255,0.18)",
    shadowColor: "#B56CFF",
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
    color: "#E7D9FF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  subtle: {
    color: "#CBB8F1",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
