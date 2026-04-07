import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';

const STATUS_BAR_COLOR = '#1d7ee2';

const Header = ({
  title,
  showBackButton = false,
  showMenuButton = false,
  onBackPress,
  onMenuPress,
  rightComponent,
  /** Optional row below the title bar (e.g. search), same blue header background */
  bottomContent,
  /** Renders in the same row as the title (e.g. compact search). Hides bottomContent when set. */
  inlineHeaderContent,
  /** Full-width search/toolbar row: back stays; title and right slot hidden. */
  searchExpanded = false,
  searchExpandedContent,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const useExpandedSearch = Boolean(searchExpanded && searchExpandedContent != null);
  const useInline = !useExpandedSearch && inlineHeaderContent != null;

  return (
    <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
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

        {useExpandedSearch ? (
          <View style={styles.headerSearchExpandedFill}>{searchExpandedContent}</View>
        ) : useInline ? (
          <>
            <Text style={styles.headerTitleCompact} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.headerInlineFill}>{inlineHeaderContent}</View>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>{title}</Text>
            {rightComponent ? (
              rightComponent
            ) : (
              <View style={styles.headerPlaceholder} />
            )}
          </>
        )}
      </View>
      {bottomContent != null && !useInline && !useExpandedSearch ? (
        <View style={styles.headerBottom}>{bottomContent}</View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: STATUS_BAR_COLOR,
  },
  header: {
    backgroundColor: STATUS_BAR_COLOR,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  headerBottom: {
    backgroundColor: STATUS_BAR_COLOR,
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  headerTitle: {
    flex: 1,
    fontSize: SIZES.h4, // Reduced font size for Tamil text to fit on single line
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  headerTitleCompact: {
    flexShrink: 0,
    fontSize: SIZES.h4,
    fontWeight: '600',
    color: COLORS.white,
    marginRight: SIZES.base,
    maxWidth: 72,
  },
  headerInlineFill: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerSearchExpandedFill: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
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
