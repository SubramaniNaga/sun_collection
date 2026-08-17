import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';

const FormPicker = ({
  label,
  value,
  onValueChange,
  items = [],
  placeholder,
  error,
  editable = true,
  required = false,
  style = {},
  fullScreenModal = false,
  searchable = false,
  modalTitle,
  searchPlaceholder = 'Search...',
  noResultsText = 'No results found',
  onOpen,
  onAddPress,
  visible: visibleProp,
  onVisibleChange,
  loading = false,
  loadingText = 'Loading...',
  compact = false,
  fitSheetToContent = false,
  compactUseFullLabel = false,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const overlayKeyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));
  const sheetKeyboardStyle = useAnimatedStyle(() => {
    const kb = keyboard.height.value;
    const available = windowHeight - kb;
    const height = kb > 0
      ? Math.max(available - 12, 280)
      : Math.min(windowHeight * 0.7, available);
    return { height, maxHeight: height };
  });
  const isControlled = visibleProp !== undefined;
  const [internalVisible, setInternalVisible] = useState(false);
  const modalVisible = isControlled ? visibleProp : internalVisible;
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  const setModalVisible = (next) => {
    if (!isControlled) setInternalVisible(next);
    onVisibleChange?.(next);
  };

  const selectedItem = items.find((item) => item.value === value);
  const selectedLabel = selectedItem
    ? (compact && selectedItem.shortLabel && !compactUseFullLabel
        ? selectedItem.shortLabel
        : selectedItem.label)
    : null;
  const resolvedModalTitle = modalTitle || (label ? `Select ${label}` : 'Select');
  const useStaticSheetList = fitSheetToContent && !searchable && !loading && items.length <= 15;

  const filteredItems = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return items;
    }
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => item.label?.toLowerCase().includes(query));
  }, [items, searchQuery, searchable]);

  const closeModal = () => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setModalVisible(false);
    setSearchQuery('');
  };

  const openAddForm = () => {
    if (!onAddPress) return;
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setModalVisible(false);
    setTimeout(() => onAddPress(), 350);
  };

  const openModal = () => {
    if (!editable) return;
    // onOpen may return false to block opening (e.g. check-in required)
    if (onOpen && onOpen() === false) return;
    setSearchQuery('');
    setModalVisible(true);
  };

  const handleSelect = (itemValue) => {
    onValueChange(itemValue);
    closeModal();
  };

  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>{loadingText}</Text>
    </View>
  );

  const renderItemRow = (item) => (
    <Pressable
      key={item.value}
      onPress={() => handleSelect(item.value)}
      style={[
        styles.optionRow,
        value === item.value && styles.optionRowSelected,
      ]}
    >
      <Text
        style={[
          styles.optionText,
          value === item.value && styles.optionTextSelected,
        ]}
      >
        {item.label}
      </Text>
      {value === item.value ? (
        <Ionicons name="checkmark" size={20} color={COLORS.primary} />
      ) : null}
    </Pressable>
  );

  const renderSheetModal = () => (
    <Modal
      animationType="slide"
      transparent={Platform.OS === 'ios' || !searchable}
      visible={modalVisible}
      onRequestClose={closeModal}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Animated.View style={[styles.sheetOverlay, overlayKeyboardStyle]}>
        <Pressable style={styles.sheetBackdrop} onPress={closeModal} />
        <Animated.View
          style={[
            styles.sheetPanel,
            fitSheetToContent ? styles.sheetPanelFitContent : sheetKeyboardStyle,
            fitSheetToContent && { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{resolvedModalTitle}</Text>
              {(onAddPress) ? (
                <Pressable
                  onPress={openAddForm}
                  hitSlop={8}
                  style={styles.headerAddBtn}
                >
                  <Ionicons name="add" size={26} color={COLORS.primary} />
                </Pressable>
              ) : null}
              <Pressable onPress={closeModal} hitSlop={8}>
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </Pressable>
            </View>

            {searchable ? (
              <View style={styles.sheetSearchContainer}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={COLORS.text.secondary}
                  style={styles.searchIcon}
                />
                <TextInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={COLORS.text.tertiary}
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  showSoftInputOnFocus
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={COLORS.text.secondary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {useStaticSheetList ? (
              <ScrollView
                style={fitSheetToContent ? styles.sheetListFit : styles.sheetList}
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                bounces={false}
              >
                {items.map((item) => renderItemRow(item))}
              </ScrollView>
            ) : (
              <FlatList
                data={loading ? [] : (searchable ? filteredItems : items)}
                keyExtractor={(item, index) => String(item.value ?? index)}
                renderItem={({ item }) => renderItemRow(item)}
                style={fitSheetToContent ? styles.sheetListFit : styles.sheetList}
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                nestedScrollEnabled
                ListEmptyComponent={
                  loading ? renderLoadingState() : (
                    searchable ? (
                      <View style={styles.emptyStateCompact}>
                        <Text style={styles.emptyStateText}>{noResultsText}</Text>
                      </View>
                    ) : null
                  )
                }
              />
            )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const renderFullScreenModal = () => (
    <Modal
      animationType="slide"
      visible={modalVisible}
      onRequestClose={closeModal}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.fullScreenContainer} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.fullScreenHeader}>
          <Pressable onPress={closeModal} style={styles.backButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </Pressable>
          <Text style={styles.fullScreenTitle} numberOfLines={1}>
            {resolvedModalTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {searchable ? (
          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color={COLORS.text.secondary}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={COLORS.text.tertiary}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={COLORS.text.secondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.modalBodyLoader}>
            {renderLoadingState()}
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => String(item.value)}
            renderItem={({ item }) => renderItemRow(item)}
            contentContainerStyle={
              filteredItems.length === 0 ? styles.emptyListContent : styles.listContent
            }
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={40} color={COLORS.text.tertiary} />
                <Text style={styles.emptyStateText}>{noResultsText}</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.labelRequired}> *</Text> : null}
        </Text>
      ) : null}

      <Pressable
        onPress={openModal}
        style={[
          styles.trigger,
          compact && styles.triggerCompact,
          error && styles.triggerError,
          !editable && styles.triggerDisabled,
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            compact && styles.triggerTextCompact,
            compact && compactUseFullLabel && styles.triggerTextCompactFull,
            !selectedItem && styles.triggerPlaceholder,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit={compactUseFullLabel}
          minimumFontScale={0.75}
        >
          {selectedItem ? selectedLabel : placeholder}
        </Text>
        {editable ? (
          <Ionicons
            name="chevron-down"
            size={compact ? 16 : 20}
            color={COLORS.text.tertiary}
          />
        ) : null}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {fullScreenModal ? renderFullScreenModal() : renderSheetModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SIZES.margin,
  },
  label: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  labelRequired: {
    color: COLORS.error,
    fontWeight: '600',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.8,
    backgroundColor: COLORS.white,
  },
  triggerCompact: {
    height: 45,
    paddingHorizontal: SIZES.base,
    paddingVertical: 0,
    backgroundColor: '#f8f9fa',
  },
  triggerError: {
    borderColor: 'red',
  },
  triggerDisabled: {
    backgroundColor: COLORS.lightGray,
  },
  triggerText: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
  },
  triggerTextCompact: {
    fontSize: SIZES.body4,
    fontWeight: '600',
  },
  triggerTextCompactFull: {
    fontSize: SIZES.body5,
    fontWeight: '600',
  },
  triggerPlaceholder: {
    color: COLORS.text.tertiary,
  },
  errorText: {
    fontSize: SIZES.body3,
    color: 'red',
    marginTop: SIZES.base / 2,
  },
  sheetOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetPanel: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    overflow: 'hidden',
  },
  sheetPanelScrollable: {
    maxHeight: '70%',
  },
  sheetPanelFitContent: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: '90%',
  },
  sheetScroll: {
    flexGrow: 1,
    minHeight: 140,
  },
  sheetList: {
    flex: 1,
    minHeight: 180,
  },
  sheetListFit: {
    flexGrow: 0,
    flexShrink: 0,
  },
  sheetScrollContent: {
    paddingBottom: SIZES.padding,
    flexGrow: 0,
  },
  sheetOptionsList: {
    paddingBottom: SIZES.padding,
  },
  emptyStateCompact: {
    paddingVertical: SIZES.padding,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerAddBtn: {
    marginRight: SIZES.base,
  },
  sheetSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SIZES.padding,
    marginTop: SIZES.base,
    marginBottom: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding * 0.75,
    paddingVertical: SIZES.base / 2,
    backgroundColor: COLORS.white,
  },
  modalTitle: {
    flex: 1,
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.black,
    marginRight: SIZES.base,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.statusBar,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  backButton: {
    padding: SIZES.base / 2,
  },
  fullScreenTitle: {
    flex: 1,
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.margin,
    marginTop: SIZES.margin,
    marginBottom: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
  },
  searchIcon: {
    marginRight: SIZES.base,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
    paddingVertical: SIZES.base / 2,
  },
  listContent: {
    paddingBottom: SIZES.padding,
  },
  modalBodyLoader: {
    flex: 1,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: SIZES.padding,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(29, 126, 226, 0.06)',
  },
  optionText: {
    flex: 1,
    fontSize: SIZES.body2,
    color: COLORS.black,
    fontWeight: '400',
    marginRight: SIZES.base,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 4,
    paddingHorizontal: SIZES.padding,
  },
  emptyStateText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 4,
    paddingHorizontal: SIZES.padding,
  },
  loadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});

export default FormPicker;
