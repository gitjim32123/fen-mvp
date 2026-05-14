import { LegalScreen } from "../../components/legal/LegalScreen";
import { legalPages } from "../../components/legal/legalContent";

export default function PrivacyScreen() {
  return <LegalScreen page={legalPages.privacy} />;
}
