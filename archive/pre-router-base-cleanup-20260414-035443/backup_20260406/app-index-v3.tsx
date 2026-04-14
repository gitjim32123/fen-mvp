import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { router } from "expo-router";

SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SCREEN_W } = Dimensions.get("window");
const EASE = Easing.bezier(0.3, 0.1, 0.25, 1);

export default function IntroScreen() {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  const logoOp = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const glowOp = useRef(new Animated.Value(0)).current;

  const fL = useRef(new Animated.Value(0)).current;
  const fW = useRef(new Animated.Value(0)).current;
  const eL = useRef(new Animated.Value(0)).current;
  const eW = useRef(new Animated.Value(0)).current;
  const nL = useRef(new Animated.Value(0)).current;
  const nW = useRef(new Animated.Value(0)).current;

  const fenOp = useRef(new Animated.Value(0)).current;
  const fenGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setReady(true);

    Animated.sequence([
      Animated.delay(300),

      Animated.parallel([
        Animated.timing(logoOp, { toValue: 1, duration: 800, easing: EASE, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 800, easing: EASE, useNativeDriver: true }),
        Animated.timing(glowOp, { toValue: 1, duration: 1000, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.delay(300),

      Animated.parallel([
        Animated.timing(fL, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(fW, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(fL, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(fW, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(250),

      Animated.parallel([
        Animated.timing(eL, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(eW, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(eL, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(eW, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(250),

      Animated.parallel([
        Animated.timing(nL, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(nW, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(nL, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(nW, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(250),

      Animated.parallel([
        Animated.timing(fenOp, { toValue: 1, duration: 500, easing: EASE, useNativeDriver: true }),
        Animated.timing(fenGlow, { toValue: 1, duration: 500, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.delay(900),
    ]).start();

    setTimeout(async () => {
      try { await SplashScreen.hideAsync(); } catch {}
    }, 500);

    setTimeout(() => {
      setDone(true);
      router.replace("/auth/sign-in");
    }, 7200);
  }, []);

  if (!ready || done) return null;

  const logoSize = Math.min(SCREEN_W * 0.48, 240);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glow, { opacity: glowOp }]} />

      <Animated.View style={[styles.logoWrap, { opacity: logoOp, transform: [{ scale: logoScale }] }]}>
        <Image
          source={require("../assets/images/fen-logo-mark.png")}
          style={{ width: logoSize, height: logoSize, resizeMode: "contain" }}
        />
      </Animated.View>

      <View style={styles.textArea}>
        <View style={styles.textRow}>
          <Animated.Text style={[styles.letter, { opacity: fL }]}>F</Animated.Text>
          <Animated.Text style={[styles.word, { opacity: fW }]}>Fast</Animated.Text>
        </View>
        <View style={styles.textRow}>
          <Animated.Text style={[styles.letter, { opacity: eL }]}>E</Animated.Text>
          <Animated.Text style={[styles.word, { opacity: eW }]}>Earn</Animated.Text>
        </View>
        <View style={styles.textRow}>
          <Animated.Text style={[styles.letter, { opacity: nL }]}>N</Animated.Text>
          <Animated.Text style={[styles.word, { opacity: nW }]}>Nearby</Animated.Text>
        </View>
      </View>

      <Animated.View style={[styles.finalBox, { opacity: fenOp }]}>
        <Animated.View style={[styles.fenGlow, { opacity: fenGlow }]} />
        <Text style={styles.fenText}>FEN</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0714",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#1a0e2e",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  textArea: {
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  letter: {
    color: "#E7D9FF",
    fontSize: 26,
    fontWeight: "800",
  },
  word: {
    color: "#B8A4DC",
    fontSize: 18,
    fontWeight: "600",
  },
  finalBox: {
    alignItems: "center",
    position: "relative",
  },
  fenGlow: {
    position: "absolute",
    top: -6,
    width: 100,
    height: 40,
    backgroundColor: "#6a4d9a",
    borderRadius: 20,
    opacity: 0.3,
  },
  fenText: {
    color: "#E7D9FF",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 10,
  },
});