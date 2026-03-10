import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';

const NIPScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      
      <Header 
        title="NIP" 
        showBackButton={true}
        onBackPress={() => navigation.goBack()} 
      />

      <View style={styles.content}>
        <View style={styles.contentHeader}>
          <Ionicons name="link-outline" size={24} color={COLORS.primary} style={{ marginRight: SIZES.base }} />
          <Text style={styles.title}>NIP</Text>
          <Text style={styles.subtitle}>Network Integration Point</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingBottom: SIZES.padding * 2, // Add bottom padding to avoid navigation bar overlap
  },
  contentHeader: {
    marginBottom: SIZES.padding,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SIZES.base,
  },
  subtitle: {
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
});

export default NIPScreen;
