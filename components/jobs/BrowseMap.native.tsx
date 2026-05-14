import BrowseMap from "./BrowseMap";
import type { Job } from "../../lib/types";

export default function NativeBrowseMap({ jobs, selectedId, onJobPress }: { jobs: Job[]; selectedId?: string; onJobPress?: (jobId: string) => void }) {
  return <BrowseMap jobs={jobs.filter(Boolean)} selectedId={selectedId} onJobPress={onJobPress} />;
}
