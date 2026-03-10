import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';

const Header = ({ 
  title, 
  showBackButton = false, 
  showMenuButton = false,
  onBackPress,
  onMenuPress,
  rightComponent,
  style 
}) => {
  return (
    <View style={[styles.header, style]}>
      {showMenuButton && (
        <TouchableOpacity 
          onPress={onMenuPress} 
          style={styles.menuButton}
        >
          <Ionicons name="menu" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}
      
      {showBackButton && (
        <TouchableOpacity 
          onPress={onBackPress} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}
      
      <Text style={styles.headerTitle}>{title}</Text>
      
      {rightComponent ? (
        rightComponent
      ) : (
        <View style={styles.headerPlaceholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.primary,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  headerTitle: {
    flex: 1,
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40, // Same width as back/menu button for centering
  },
  backButton: {
    padding: SIZES.padding / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    padding: SIZES.padding / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Header;
