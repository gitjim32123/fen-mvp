import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Defs, RadialGradient, Stop, LinearGradient } from "react-native-svg";
import * as SplashScreen from "expo-splash-screen";
import { router } from "expo-router";

SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SCREEN_W } = Dimensions.get("window");
const EASE = Easing.bezier(0.3, 0.1, 0.25, 1);
const EASE_OUT = Easing.out(Easing.cubic);

const PIN_PATH =
  "M 100 235" +
  " C 100 215 108 190 100 160" +
  " C 92 130 75 105 55 80" +
  " C 40 60 45 40 65 30" +
  " C 85 20 100 30 100 45" +
  " C 100 30 115 20 135 30" +
  " C 155 40 160 60 145 80" +
  " C 125 105 108 130 100 160" +
  " C 92 190 100 215 100 235";

const PATH_LEN = 540;
const DASH_STR = `${PATH_LEN} ${PATH_LEN}`;

const AP = Animated.createAnimatedComponent(Path);

const VineGrowth = ({ growth }: { growth: Animated.Value }) => {
  const dashOff = growth.interpolate({
    inputRange: [0, 1],
    outputRange: [PATH_LEN, 0],
  }) as any;

  const thinOp = growth.interpolate({
    inputRange: [0, 0.01],
    outputRange: [0, 1],
  }) as any;

  const medOp = growth.interpolate({
    inputRange: [0, 0.45, 0.75],
    outputRange: [0, 0, 1],
  }) as any;

  const thickOp = growth.interpolate({
    inputRange: [0, 0.6, 0.9],
    outputRange: [0, 0, 1],
  }) as any;

  return (
    <Svg width={200} height={260} viewBox="0 0 200 260">
      <Defs>
        <LinearGradient id="vg0" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#0a1f12" />
          <Stop offset="100%" stopColor="#152a1f" />
        </LinearGradient>
        <LinearGradient id="vg1" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#143020" />
          <Stop offset="50%" stopColor="#1f4d30" />
          <Stop offset="100%" stopColor="#2a6a45" />
        </LinearGradient>
        <LinearGradient id="vg2" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#1a4025" />
          <Stop offset="50%" stopColor="#2a6a40" />
          <Stop offset="100%" stopColor="#3a8a55" />
        </LinearGradient>
      </Defs>

      <Animated.View style={{ opacity: thickOp }}>
        <Svg width={200} height={260} viewBox="0 0 200 260">
          <AP
            d={PIN_PATH}
            fill="none"
            stroke="url(#vg0)"
            strokeWidth={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={DASH_STR}
            strokeDashoffset={dashOff}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={{ opacity: medOp }}>
        <Svg width={200} height={260} viewBox="0 0 200 260">
          <AP
            d={PIN_PATH}
            fill="none"
            stroke="url(#vg1)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={DASH_STR}
            strokeDashoffset={dashOff}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={{ opacity: thinOp }}>
        <Svg width={200} height={260} viewBox="0 0 200 260">
          <AP
            d={PIN_PATH}
            fill="none"
            stroke="url(#vg2)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={DASH_STR}
            strokeDashoffset={dashOff}
          />
          <AP
            d={PIN_PATH}
            fill="none"
            stroke="#5ab070"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={DASH_STR}
            strokeDashoffset={dashOff}
          />
        </Svg>
      </Animated.View>
    </Svg>
  );
};

export default function IntroScreen() {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  const bgGlow = useRef(new Animated.Value(0)).current;
  const growth = useRef(new Animated.Value(0)).current;
  const vineOut = useRef(new Animated.Value(1)).current;
  const logoIn = useRef(new Animated.Value(0)).current;
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

    Animated.timing(bgGlow, { toValue: 1, duration: 1000, easing: EASE, useNativeDriver: true }).start();

    Animated.timing(growth, { toValue: 1, duration: 2600, delay: 600, easing: EASE_OUT, useNativeDriver: false }).start();

    Animated.sequence([
      Animated.delay(3400),

      Animated.parallel([
        Animated.timing(vineOut, { toValue: 0, duration: 800, easing: EASE, useNativeDriver: true }),
        Animated.timing(logoIn, { toValue: 1, duration: 800, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.delay(600),

      Animated.parallel([
        Animated.timing(fL, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
        Animated.timing(fW, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(fL, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(fW, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(250),

      Animated.parallel([
        Animated.timing(eL, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
        Animated.timing(eW, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(eL, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(eW, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(250),

      Animated.parallel([
        Animated.timing(nL, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
        Animated.timing(nW, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(nL, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
        Animated.timing(nW, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(400),

      Animated.parallel([
        Animated.timing(fenOp, { toValue: 1, duration: 600, easing: EASE, useNativeDriver: true }),
        Animated.timing(fenGlow, { toValue: 1, duration: 600, easing: EASE, useNativeDriver: true }),
      ]),
    ]).start();

    setTimeout(async () => {
      try { await SplashScreen.hideAsync(); } catch {}
    }, 500);

    setTimeout(() => {
      setDone(true);
      router.replace("/auth/sign-in");
    }, 7500);
  }, []);

  if (!ready || done) return null;

  const logoSize = Math.min(SCREEN_W * 0.55, 210);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glow, { opacity: bgGlow }]} />

      <View style={styles.logoArea}>
        <Animated.View style={[styles.vineSlot, { opacity: vineOut }]}>
          <VineGrowth growth={growth} />
        </Animated.View>

        <Animated.View style={[styles.logoSlot, { opacity: logoIn }]}>
          <Image
            source={require("../assets/images/fen-logo-mark.png")}
            style={{ width: logoSize, height: logoSize, resizeMode: "contain" }}
          />
        </Animated.View>
      </View>

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
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#1a0e2e",
  },
  logoArea: {
    position: "relative",
    width: 210,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  vineSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  logoSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 24,
    fontWeight: "800",
  },
  word: {
    color: "#B8A4DC",
    fontSize: 16,
    fontWeight: "600",
  },
  finalBox: {
    alignItems: "center",
    position: "relative",
  },
  fenGlow: {
    position: "absolute",
    top: -6,
    width: 90,
    height: 36,
    backgroundColor: "#6a4d9a",
    borderRadius: 18,
    opacity: 0.28,
  },
  fenText: {
    color: "#E7D9FF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 9,
  },
});