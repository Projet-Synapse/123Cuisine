// Powered by OnSpace.AI
import { View, ViewProps } from 'react-native';
import { Layout } from '@/constants/layout';

export function ScreenContainer({ style, ...props }: ViewProps) {
  return (
    <View
      style={[{ width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center' }, style]}
      {...props}
    />
  );
}
