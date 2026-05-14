import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Index() {
  const [target, setTarget] = useState<"/app" | "/auth/sign-in" | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setTarget(data.session ? "/app" : "/auth/sign-in");
    }).catch(() => {
      if (active) setTarget("/auth/sign-in");
    });
    return () => { active = false; };
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0E0A14" }}>
        <ActivityIndicator size="large" color="#B56CFF" />
      </View>
    );
  }

  return <Redirect href={target} />;
}
