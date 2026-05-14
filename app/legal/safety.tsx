import { LegalScreen } from "../../components/legal/LegalScreen";
import { legalPages } from "../../components/legal/legalContent";

export default function SafetyScreen() {
  return <LegalScreen page={legalPages.safety} />;
}
