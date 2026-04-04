import { ScrollView, StyleSheet, Switch, Text, TextInput, View, Pressable } from "react-native";

export default function PostScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Post a job</Text>
      <Text style={styles.subtitle}>Keep it simple. The aim is to post in under a minute.</Text>

      <TextInput placeholder="Job title" placeholderTextColor="#8D79AF" style={styles.input} />
      <TextInput
        placeholder="Description"
        placeholderTextColor="#8D79AF"
        style={[styles.input, styles.textArea]}
        multiline
        textAlignVertical="top"
      />
      <TextInput placeholder="Budget in GBP" placeholderTextColor="#8D79AF" style={styles.input} keyboardType="numeric" />
      <TextInput placeholder="Postcode" placeholderTextColor="#8D79AF" style={styles.input} autoCapitalize="characters" />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Urgency</Text>
          <View style={styles.pillRow}>
            <View style={styles.pillActive}><Text style={styles.pillActiveText}>Need now</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>Today</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>Flexible</Text></View>
          </View>
        </View>
      </View>

      <TextInput placeholder="Preferred time (optional)" placeholderTextColor="#8D79AF" style={styles.input} />

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>Tools supplied</Text>
          <Text style={styles.small}>Turn on if the worker does not need to bring tools.</Text>
        </View>
        <Switch value={true} thumbColor="#B56CFF" trackColor={{ false: "#3A2B52", true: "#6E46A3" }} />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>AI suggestion</Text>
        <Text style={styles.noticeText}>Suggestions are guidance only. Final job details, pricing, and arrangements are chosen by the users.</Text>
      </View>

      <Pressable style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Post job</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0E0A14",
  },
  content: {
    padding: 20,
    paddingBottom: 110,
    gap: 14,
  },
  title: {
    color: "#E7D9FF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    color: "#CBB8F1",
    fontSize: 16,
    lineHeight: 23,
  },
  input: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
    color: "#E7D9FF",
    fontSize: 16,
  },
  textArea: {
    minHeight: 110,
  },
  row: {
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  label: {
    color: "#E7D9FF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  small: {
    color: "#CBB8F1",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillText: {
    color: "#CBB8F1",
    fontSize: 13,
    fontWeight: "700",
  },
  pillActive: {
    backgroundColor: "#2A1E3D",
    borderColor: "#B56CFF",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pillActiveText: {
    color: "#F0E2FF",
    fontSize: 13,
    fontWeight: "800",
  },
  switchRow: {
    backgroundColor: "#171024",
    borderWidth: 1,
    borderColor: "#231A33",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  notice: {
    backgroundColor: "#20172E",
    borderWidth: 1,
    borderColor: "#5B3A87",
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  noticeTitle: {
    color: "#E7D9FF",
    fontSize: 14,
    fontWeight: "800",
  },
  noticeText: {
    color: "#CBB8F1",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#B56CFF",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#140E1D",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
});
