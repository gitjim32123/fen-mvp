import { LegalScreen } from "../../components/legal/LegalScreen";
import { legalPages } from "../../components/legal/legalContent";

export default function PaymentsScreen() {
  return <LegalScreen page={legalPages.payments} />;
}
