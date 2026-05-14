import { LegalScreen } from "../../components/legal/LegalScreen";
import { legalPages } from "../../components/legal/legalContent";

export default function TermsScreen() {
  return <LegalScreen page={legalPages.terms} />;
}
