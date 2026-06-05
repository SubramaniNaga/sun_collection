import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, TouchableOpacity } from 'react-native';
import CustomDrawerContent from '../components/navigation/CustomDrawerContent';
import { COLORS, SIZES } from '../constants/theme';
import { safeGoBack } from '../utils/navigationHelpers';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import AddCustomerScreen from '../screens/main/AddCustomerScreen';
import CollectionDetailsScreen from '../screens/main/CollectionDetailsScreen';
import CollectionHistoryScreen from '../screens/main/CollectionHistoryScreen';
import CollectionScreen from '../screens/main/CollectionScreen';
import CustomerWithLoanScreen from '../screens/main/CustomerWithLoanScreen';
import ExpenseAddScreen from '../screens/main/ExpenseAddScreen';
import ExpensesScreen from '../screens/main/ExpensesScreen';
import CashAccountScreen from '../screens/main/CashAccountScreen';
import HomeScreen from '../screens/main/HomeScreen';
import LoanCustomerListScreen from '../screens/main/LoanCustomerListScreen';
import LoanScreen from '../screens/main/LoanScreen';
import NIPCollectionDetailsScreen from '../screens/main/NIPCollectionDetailsScreen';
import NIPScreen from '../screens/main/NIPScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import UpfrontCashAddScreen from '../screens/main/UpfrontCashAddScreen';
import UpfrontCashScreen from '../screens/main/UpfrontCashScreen';
import { useAuthContext } from '../store/AuthContext';
const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const BackButton = () => {
  const navigation = useNavigation();
  
  return (
    <TouchableOpacity
      onPress={() => safeGoBack(navigation)}
      style={styles.backButton}
    >
      <Ionicons name="arrow-back" size={24} color={COLORS.white} />
    </TouchableOpacity>
  );
};

const HamburgerButton = () => {
  const navigation = useNavigation();
  
  return (
    <TouchableOpacity
      onPress={() => navigation.openDrawer()}
      style={styles.hamburgerButton}
    >
      <Ionicons name="menu" size={24} color={COLORS.white} />
    </TouchableOpacity>
  );
};

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const HomeStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: true,
      headerStyle: {
        backgroundColor: COLORS.statusBar,
        elevation: 2,
        shadowOpacity: 0.1,
        shadowColor: COLORS.black,
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowRadius: 3,
        borderBottomWidth: 0,
        height: 60,
      },
      headerTintColor: COLORS.white,
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: SIZES.h3,
        color: COLORS.white,
      },
      headerTitleAlign: 'center',
    }}
  >
    <Stack.Screen 
      name="HomeScreen" 
      component={HomeScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="CashAccount"
      component={CashAccountScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="Collection" 
      component={CollectionScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="CollectionDetails" 
      component={CollectionDetailsScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="Loan" 
      component={LoanCustomerListScreen} 
      options={{ 
        headerShown: false,
      }} 
    />
    <Stack.Screen 
      name="LoanScreen" 
      component={LoanScreen} 
      options={{ 
        headerShown: false,
      }} 
    />
    <Stack.Screen 
      name="AddCustomer" 
      component={AddCustomerScreen} 
      options={{ 
        headerShown: false,
      }} 
    />
    <Stack.Screen 
      name="CustomerWithLoan" 
      component={CustomerWithLoanScreen} 
      options={{ 
        headerShown: false,
      }} 
    />
    <Stack.Screen 
      name="Expenses" 
      component={ExpensesScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="ExpenseAdd" 
      component={ExpenseAddScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="UpfrontCash" 
      component={UpfrontCashScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="UpfrontCashAdd" 
      component={UpfrontCashAddScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="CollectionHistory" 
      component={CollectionHistoryScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="NIP" 
      component={NIPScreen} 
      options={{ 
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="NIPCollectionDetails" 
      component={NIPCollectionDetailsScreen} 
      options={{ 
        headerShown: false,
      }}
    />
  </Stack.Navigator>
);

const MainDrawer = () => (
  <Drawer.Navigator
    drawerContent={(props) => <CustomDrawerContent {...props} />}
    screenOptions={{
      headerShown: false,
      drawerType: 'slide',
      drawerPosition: 'left',
      swipeEnabled: false,
      gestureEnabled: false,
      drawerStyle: {
        width: 280,
        backgroundColor: COLORS.white,
        shadowColor: COLORS.black,
        shadowOffset: {
          width: -2,
          height: 0,
        },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
      },
      sceneContainerStyle: {
        backgroundColor: '#F8F9FA',
      },
    }}
  >
    <Drawer.Screen name="Home" component={HomeStack} />
    <Drawer.Screen name="Profile" component={ProfileScreen} />
    <Drawer.Screen name="Settings" component={SettingsScreen} />
  </Drawer.Navigator>
);

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainDrawer /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;

const styles = StyleSheet.create({
  backButton: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerButton: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
