import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useFocusEffect } from "expo-router";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LoadingState } from "../../components/ui/Premium";
import { useTheme } from "../../components/ui/ThemeProvider";
import { supabase } from "../../lib/supabase";
import { getActivitySummary, type ActivitySummary } from "../../lib/activitySummary";

const emptySummary: ActivitySummary = {
  myJobsBadge: 0,
  messagesBadge: 0,
  pendingApplicants: 0,
  workerActions: 0,
  recentMessages: 0,
};

function badgeValue(count: number) {
  return count > 0 ? count : undefined;
}

function AppTabs({ summary }: { summary: ActivitySummary }) {
  const theme = useTheme();
  const tabStyle = useMemo(() => ({
    backgroundColor: theme.colors.bgDeep,
    borderTopColor: theme.colors.border,
    height: 70,
    paddingTop: 8,
    paddingBottom: 8,
  }), [theme]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyle,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        tabBarBadgeStyle: {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          fontSize: 10,
          fontWeight: "800",
          backgroundColor: theme.colors.accent,
          color: theme.colors.accentText,
        },
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
          tabBarBadge: badgeValue(summary.myJobsBadge),
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarBadge: badgeValue(summary.messagesBadge),
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
  const [summary, setSummary] = useState<ActivitySummary>(emptySummary);

  const refreshSummary = useCallback(async (active = true) => {
    if (!signedIn) {
      if (active) setSummary(emptySummary);
      return;
    }
    try {
      const data = await getActivitySummary();
      if (active) setSummary(data);
    } catch (error) {
      console.log("Could not load activity summary", error);
      if (active) setSummary(emptySummary);
    }
  }, [signedIn]);

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
      if (!session) setSummary(emptySummary);
      setCheckingSession(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    refreshSummary(active);
    return () => {
      active = false;
    };
  }, [refreshSummary]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refreshSummary(active);
      return () => {
        active = false;
      };
    }, [refreshSummary])
  );

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    const timer = setInterval(() => {
      refreshSummary(active);
    }, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refreshSummary, signedIn]);

  if (checkingSession) {
    return <LoadingState text="Checking sign in..." fullScreen />;
  }

  if (!signedIn) {
    return <Redirect href="/auth/sign-in" />;
  }

  return <AppTabs summary={summary} />;
}
