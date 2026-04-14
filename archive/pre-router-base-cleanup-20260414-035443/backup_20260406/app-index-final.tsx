import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Defs, RadialGradient, Stop, LinearGradient, Circle, Ellipse } from "react-native-svg";
import * as SplashScreen from "expo-splash-screen";
import { router } from "expo-router";

SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SCREEN_W } = Dimensions.get("window");
const EASE = Easing.bezier(0.3, 0.1, 0.25, 1);
const EASE_OUT = Easing.out(Easing.cubic);

const VW = 200;
const VH = 240;

const VINE =
  "M 100 225" +
  " C 100 208 106 188 100 162" +
  " C 94 136 78 112 60 88" +
  " C 46 68 50 48 68 38" +
  " C 86 28 100 38 100 50" +
  " C 100 38 114 28 132 38" +
  " C 150 48 154 68 140 88" +
  " C 122 112 106 136 100 162" +
  " C 94 188 100 208 100 225";

const PLEN = 520;
const PDASH = `${PLEN} ${PLEN}`;

const AnimPath = Animated.createAnimatedComponent(Path);

const VineGrowth = ({ growth }: { growth: Animated.Value }) => {
  const off = growth.interpolate({ inputRange: [0, 1], outputRange: [PLEN, 0] }) as any;
  const glowOp = growth.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [1, 1, 0.4, 0] }) as any;
  const thickOp = growth.interpolate({ inputRange: [0, 0.5, 0.9], outputRange: [0, 0, 1] }) as any;

  return (
    <Svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}>
      <Defs>
        <LinearGradient id="vgBase" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#0a1f12" />
          <Stop offset="100%" stopColor="#152a1f" />
        </LinearGradient>
        <LinearGradient id="vgMid" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#143020" />
          <Stop offset="50%" stopColor="#1f4d30" />
          <Stop offset="100%" stopColor="#2a6a45" />
        </LinearGradient>
      </Defs>

      <AnimPath d={VINE} fill="none" stroke="url(#vgBase)" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={PDASH} strokeDashoffset={off} opacity={thickOp} />
      <AnimPath d={VINE} fill="none" stroke="url(#vgMid)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={PDASH} strokeDashoffset={off} />
      <AnimPath d={VINE} fill="none" stroke="#5ab070" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={PDASH} strokeDashoffset={off} />
      <AnimPath d={VINE} fill="none" stroke="#8affb0" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={PDASH} strokeDashoffset={off} opacity={glowOp} />
    </Svg>
  );
};

const FlowerBloom = ({ cx, cy, opacity }: { cx: number; cy: number; opacity: Animated.Value }) => {
  const op = opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) as any;
  return (
    <Animated.View style={{ position: "absolute", opacity: op }} pointerEvents="none">
      <Svg width={28} height={28} viewBox="0 0 28 28">
        <Defs>
          <RadialGradient id="fg" cx="35%" cy="35%">
            <Stop offset="0%" stopColor="#f0d0ff" />
            <Stop offset="50%" stopColor="#c480ff" />
            <Stop offset="100%" stopColor="#9a50cc" />
          </RadialGradient>
          <RadialGradient id="fc" cx="35%" cy="35%">
            <Stop offset="0%" stopColor="#fff8f5" />
            <Stop offset="100%" stopColor="#e8d8c8" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={14} cy={14} rx={4.5} ry={3} fill="url(#fg)" transform="rotate(-30 14 14)" />
        <Ellipse cx={14} cy={14} rx={4.5} ry={3} fill="url(#fg)" transform="rotate(30 14 14)" />
        <Ellipse cx={14} cy={14} rx={4.5} ry={3} fill="url(#fg)" transform="rotate(90 14 14)" />
        <Ellipse cx={14} cy={14} rx={4.5} ry={3} fill="url(#fg)" transform="rotate(-60 14 14)" />
        <Ellipse cx={14} cy={14} rx={4.5} ry={3} fill="url(#fg)" transform="rotate(60 14 14)" />
        <Circle cx={14} cy={14} r={2.2} fill="url(#fc)" />
      </Svg>
    </Animated.View>
  );
};

export default function IntroScreen() {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  const glowOp = useRef(new Animated.Value(0)).current;
  const growth = useRef(new Animated.Value(0)).current;
  const vineOut = useRef(new Animated.Value(1)).current;
  const logoIn = useRef(new Animated.Value(0)).current;
  const f1 = useRef(new Animated.Value(0)).current;
  const f2 = useRef(new Animated.Value(0)).current;
  const f3 = useRef(new Animated.Value(0)).current;
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

    Animated.timing(glowOp, { toValue: 1, duration: 800, easing: EASE, useNativeDriver: true }).start();
    Animated.timing(growth, { toValue: 1, duration: 1800, delay: 500, easing: EASE_OUT, useNativeDriver: false }).start();

    Animated.sequence([
      Animated.delay(2300),

      Animated.parallel([
        Animated.timing(f1, { toValue: 1, duration: 400, easing: EASE, useNativeDriver: true }),
        Animated.timing(f2, { toValue: 1, duration: 400, delay: 100, easing: EASE, useNativeDriver: true }),
        Animated.timing(f3, { toValue: 1, duration: 400, delay: 200, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.delay(200),

      Animated.parallel([
        Animated.timing(vineOut, { toValue: 0, duration: 500, easing: EASE, useNativeDriver: true }),
        Animated.timing(logoIn, { toValue: 1, duration: 500, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.delay(150),

      Animated.parallel([
        Animated.timing(fL, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
        Animated.timing(fW, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(fL, { toValue: 0, duration: 220, easing: EASE, useNativeDriver: true }),
        Animated.timing(fW, { toValue: 0, duration: 220, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.parallel([
        Animated.timing(eL, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
        Animated.timing(eW, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(eL, { toValue: 0, duration: 220, easing: EASE, useNativeDriver: true }),
        Animated.timing(eW, { toValue: 0, duration: 220, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.parallel([
        Animated.timing(nL, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
        Animated.timing(nW, { toValue: 1, duration: 280, easing: EASE, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(nL, { toValue: 0, duration: 220, easing: EASE, useNativeDriver: true }),
        Animated.timing(nW, { toValue: 0, duration: 220, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.delay(150),

      Animated.parallel([
        Animated.timing(fenOp, { toValue: 1, duration: 450, easing: EASE, useNativeDriver: true }),
        Animated.timing(fenGlow, { toValue: 1, duration: 450, easing: EASE, useNativeDriver: true }),
      ]),

      Animated.delay(900),
    ]).start();

    setTimeout(async () => {
      try { await SplashScreen.hideAsync(); } catch {}
    }, 500);

    setTimeout(() => {
      setDone(true);
      router.replace("/auth/sign-in");
    }, 9000);
  }, []);

  if (!ready || done) return null;

  const logoSize = Math.min(SCREEN_W * 0.48, 220);
  const sc = logoSize / VW;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glow, { opacity: glowOp }]} />

      <View style={styles.logoArea}>
        <Animated.View style={[styles.vineSlot, { opacity: vineOut }]}>
          <VineGrowth growth={growth} />
          <View style={[styles.flowerSlot, { transform: [{ scale: sc }] }]}>
            <FlowerBloom cx={46} cy={86} opacity={f1} />
            <FlowerBloom cx={154} cy={80} opacity={f2} />
            <FlowerBloom cx={100} cy={30} opacity={f3} />
          </View>
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
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#1a0e2e",
  },
  logoArea: {
    position: "relative",
    width: 220,
    height: 240,
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
  flowerSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 200,
    height: 240,
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