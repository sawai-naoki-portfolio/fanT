import { Redirect, useLocalSearchParams } from 'expo-router';

import { isLegalDocument } from '../../../features/legal/documents';
import { LegalDocumentScreen } from '../../../features/legal/legal-screens';

export default function LegalDocumentRoute() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  if (!isLegalDocument(doc)) return <Redirect href="/settings/legal" />;
  return <LegalDocumentScreen doc={doc} />;
}
