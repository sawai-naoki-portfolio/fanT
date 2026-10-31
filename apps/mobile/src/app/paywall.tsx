import { useLocalSearchParams } from 'expo-router';

import { PaywallScreen } from '../features/paywall/paywall-screen';

export default function PaywallRoute() {
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  return <PaywallScreen trigger={trigger ?? 'settings'} />;
}
