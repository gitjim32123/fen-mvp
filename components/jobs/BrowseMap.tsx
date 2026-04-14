import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Job } from "../../lib/types";

type Pin = { x: number; y: number; id: string };

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pinsFromJobs(jobs: Job[]): Pin[] {
  return jobs.map((job) => {
    const h = hashStr(job.id + (job.postcode_district || job.postcode || ""));
    return {
      x: 8 + (h % 80),
      y: 10 + ((h >> 8) % 70),
      id: job.id,
    };
  });
}

type Props = {
  jobs: Job[];
  selectedId?: string;
};

export default function BrowseMap({ jobs, selectedId }: Props) {
  const [pins, setPins] = useState<Pin[]>([]);

  useEffect(() => {
    setPins(pinsFromJobs(jobs));
  }, [jobs]);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <View style={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={`v${i}`} style={[styles.gridLine, styles.vLine, { left: `${(i + 1) * 8}%` }]} />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={`h${i}`} style={[styles.gridLine, styles.hLine, { top: `${(i + 1) * 11}%` }]} />
          ))}
        </View>

        {pins.map((pin) => {
          const isSelected = pin.id === selectedId;
          return (
            <View
              key={pin.id}
              style={[
                styles.pin,
                { left: `${pin.x}%`, top: `${pin.y}%` },
                isSelected && styles.pinSelected,
              ]}
            />
          );
        })}

        {pins.length === 0 && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyText}>No job locations to show yet</Text>
          </View>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>Approximate job locations</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#171024",
    borderColor: "#231A33",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  mapArea: {
    height: 160,
    position: "relative",
    backgroundColor: "#120D1B",
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "#1E1630",
  },
  vLine: {
    width: 1,
    top: 0,
    bottom: 0,
  },
  hLine: {
    height: 1,
    left: 0,
    right: 0,
  },
  pin: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#B56CFF",
    borderWidth: 2,
    borderColor: "#E7D9FF",
    shadowColor: "#B56CFF",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pinSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F0E2FF",
    borderColor: "#B56CFF",
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#CBB8F1",
    fontSize: 13,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#B56CFF",
  },
  legendText: {
    color: "#CBB8F1",
    fontSize: 12,
    fontWeight: "700",
  },
});
