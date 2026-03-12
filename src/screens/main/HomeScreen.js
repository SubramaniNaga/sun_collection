import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const handleNotificationPress = () => {
    // Navigate to notifications screen or show notification drawer
    console.log('Notification pressed');
    // You can navigate to a notifications screen when it's ready
    // navigation.navigate('Notifications');
  };

  const menuItems = [
    {
      id: 'collection',
      title: t('home.collection'),
      icon: 'cash-outline',
      onPress: () => navigation.navigate('Collection'),
    },
    {
      id: 'loan',
      title: t('home.loanManagement'),
      icon: 'document-text-outline',
      onPress: () => navigation.navigate('Loan'),
    },
    {
      id: 'expenses',
      title: t('home.expenses'),
      icon: 'card-outline',
      onPress: () => navigation.navigate('Expenses'),
    },
    {
      id: 'upfront-cash',
      title: t('home.upfrontCash'),
      icon: 'wallet-outline',
      onPress: () => navigation.navigate('UpfrontCash'),
    },
    {
      id: 'collection-history',
      title: t('home.collectionHistory'),
      icon: 'bar-chart-outline',
      onPress: () => navigation.navigate('CollectionHistory'),
    },
    {
      id: 'nip',
      title: t('home.nip'),
      icon: 'link-outline',
      onPress: () => navigation.navigate('NIP'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={COLORS.primary} />
      
      <Header 
        title={t('home.title')} 
        showMenuButton={true}
        onMenuPress={() => navigation.openDrawer()}
        rightComponent={
          <TouchableOpacity 
            onPress={handleNotificationPress}
            style={styles.notificationButton}
          >
            <Ionicons name="notifications-outline" size={24} color={COLORS.white} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={28} color={COLORS.primary} />
              <Text style={styles.cardTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    padding: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
    minHeight: 100,
    marginBottom: SIZES.margin,
  },
  cardTitle: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  notificationButton: {
    padding: SIZES.padding / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
