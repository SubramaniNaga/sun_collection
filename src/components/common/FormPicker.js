import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES } from '../../constants/theme';

const FormPicker = ({
  label,
  value,
  onValueChange,
  items,
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
  loading = false,
  loadingText = 'Loading...',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = items.find((item) => item.value === value);
  const resolvedModalTitle = modalTitle || (label ? `Select ${label}` : 'Select');

  const filteredItems = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return items;
    }
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => item.label?.toLowerCase().includes(query));
  }, [items, searchQuery, searchable]);

  const closeModal = () => {
    setModalVisible(false);
    setSearchQuery('');
  };

  const openModal = () => {
    if (!editable) return;
    setSearchQuery('');
    setModalVisible(true);
    onOpen?.();
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
      transparent
      visible={modalVisible}
      onRequestClose={closeModal}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.sheetOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{resolvedModalTitle}</Text>
              <Pressable onPress={closeModal} hitSlop={8}>
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {loading ? renderLoadingState() : items.map((item) => renderItemRow(item))}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
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
          error && styles.triggerError,
          !editable && styles.triggerDisabled,
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedItem && styles.triggerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        {editable ? (
          <Ionicons name="chevron-down" size={20} color={COLORS.text.tertiary} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetPanel: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
