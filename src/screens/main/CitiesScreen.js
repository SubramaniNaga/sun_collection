import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import VoiceMicButton from '../../components/common/VoiceMicButton';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess } from '../../utils/alertService';
import { safeGoBack } from '../../utils/navigationHelpers';

const CitiesScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const cityInputRef = useRef(null);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cityName, setCityName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [showAddCityModal, setShowAddCityModal] = useState(false);

  const loadCities = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const list = await apiServices.city.getActiveList();
      const rows = (Array.isArray(list) ? list : [])
        .map((item) => ({
          id: String(item.id ?? ''),
          name: String(item.city_name ?? '').trim(),
        }))
        .filter((item) => item.name);
      setCities(rows);
    } catch (err) {
      showError(t('common.error'), getApiErrorMessage(err, t('customer.loadingCities')));
      setCities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadCities();
    }, [loadCities])
  );

  useEffect(() => {
    if (!showAddCityModal) return undefined;
    const timer = setTimeout(() => cityInputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, [showAddCityModal]);

  const handleOpenAddCity = () => {
    setCityName('');
    setError('');
    setShowAddCityModal(true);
  };

  const handleCloseAddCity = () => {
    if (adding) return;
    setShowAddCityModal(false);
    setCityName('');
    setError('');
  };

  const handleAddCity = async () => {
    const name = String(cityName || '').trim();
    if (!name) {
      setError(t('customer.cityNameRequired'));
      cityInputRef.current?.focus();
      return;
    }
    if (adding) return;
    setAdding(true);
    setError('');
    try {
      await apiServices.city.create(name);
      setCityName('');
      setShowAddCityModal(false);
      showSuccess(t('common.success'), t('customer.cityAdded'));
      await loadCities({ silent: true });
    } catch (err) {
      showError(t('common.error'), getApiErrorMessage(err, t('errors.somethingWentWrong')));
    } finally {
      setAdding(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.cityRow}>
      <View style={styles.cityIcon}>
        <Ionicons name="location-outline" size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.cityName}>{item.name}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('cities.title')}
        showBackButton
        onBackPress={() => safeGoBack(navigation)}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('customer.loadingCities')}</Text>
        </View>
      ) : (
        <FlatList
          data={cities}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            cities.length === 0 && styles.listContentEmpty,
            { paddingBottom: 84 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadCities({ silent: true });
              }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="business-outline" size={40} color={COLORS.text.tertiary} />
              <Text style={styles.emptyText}>{t('customer.noCitiesFound')}</Text>
            </View>
          }
        />
      )}

      <View style={[styles.addBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleOpenAddCity}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.addButtonText}>{t('customer.addCity')}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAddCityModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseAddCity}
      >
        <KeyboardAvoidingView
          style={styles.addCityOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.addCityBackdrop} onPress={handleCloseAddCity} />
          <View style={styles.addCityCard}>
            <Text style={styles.addCityTitle}>{t('customer.addCity')}</Text>
            <View style={styles.voiceFieldRow}>
            <TextInput
              ref={cityInputRef}
              style={[styles.addCityInput, styles.voiceFieldInput, error ? styles.addInputError : null]}
              value={cityName}
              onChangeText={(text) => {
                setCityName(text);
                if (error) setError('');
              }}
              placeholder={t('customer.enterCityName')}
              placeholderTextColor={COLORS.text.tertiary}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={handleAddCity}
            />
            <VoiceMicButton
              value={cityName}
              onChangeText={(text) => {
                setCityName(text);
                if (error) setError('');
              }}
            />
            </View>
            {error ? <Text style={styles.addError}>{error}</Text> : null}
            <View style={styles.addCityActions}>
              <TouchableOpacity
                style={styles.addCityCancelBtn}
                onPress={handleCloseAddCity}
                disabled={adding}
              >
                <Text style={styles.addCityCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addCitySaveBtn, adding && styles.addButtonDisabled]}
                onPress={handleAddCity}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.addCitySaveText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  loadingText: {
    marginTop: SIZES.base,
    color: COLORS.text.tertiary,
    fontSize: SIZES.body3,
  },
  listContent: {
    padding: SIZES.padding,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyText: {
    marginTop: SIZES.base,
    color: COLORS.text.tertiary,
    fontSize: SIZES.body3,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    marginBottom: SIZES.base,
  },
  cityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cityName: {
    flex: 1,
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.black,
  },
  addBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: 12,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body3,
    fontWeight: '700',
    marginLeft: 6,
  },
  addCityOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addCityBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  addCityCard: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    padding: SIZES.padding,
    zIndex: 1,
  },
  addCityTitle: {
    fontSize: SIZES.h3,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SIZES.padding,
  },
  voiceFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  voiceFieldInput: {
    flex: 1,
    marginBottom: 0,
  },
  addCityInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    fontSize: SIZES.body2,
    color: COLORS.black,
    marginBottom: SIZES.base,
  },
  addInputError: {
    borderColor: COLORS.error,
  },
  addError: {
    color: COLORS.error,
    fontSize: SIZES.body4,
    marginBottom: SIZES.padding,
  },
  addCityActions: {
    flexDirection: 'row',
    gap: SIZES.base,
  },
  addCityCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.lightGray,
  },
  addCityCancelText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  addCitySaveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.primary,
  },
  addCitySaveText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default CitiesScreen;
