import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0E0A14',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text style={{ color: '#E7D9FF', fontSize: 28, fontWeight: '700' }}>
        FEN
      </Text>
      <Text style={{ color: '#CBB8F1', fontSize: 16, marginTop: 8 }}>
        Fast Earn Nearby
      </Text>
    </View>
  );
}
