// Powered by OnSpace.AI
import { AuthRouter } from '@/template';
import { Redirect } from 'expo-router';

export default function RootScreen() {
  return (
    <AuthRouter loginRoute="/login" excludeRoutes={[]}>
      <Redirect href="/(tabs)" />
    </AuthRouter>
  );
}
