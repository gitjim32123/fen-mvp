import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../components/ui/theme";
import { supabase } from "../../lib/supabase";

const tabStyle = {
  backgroundColor: theme.colors.bgDeep,
  borderTopColor: theme.colors.border,
  height: 70,
  paddingTop: 8,
  paddingBottom: 8,
};

function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyle,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post",
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{
          title: "My Jobs",
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="job/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function AppLayout() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSignedIn(!!data.session);
        setCheckingSession(false);
      })
      .catch(() => {
        if (!active) return;
        setSignedIn(false);
        setCheckingSession(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(!!session);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={{ color: theme.colors.muted, marginTop: 12 }}>Checking sign in...</Text>
      </View>
    );
  }

  if (!signedIn) {
    return <Redirect href="/auth/sign-in" />;
  }

  return <AppTabs />;
}
