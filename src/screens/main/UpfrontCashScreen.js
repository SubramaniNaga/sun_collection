import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError } from '../../utils/alertService';
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDisplayDate, getCalendarDate } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

const UpfrontCashScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState([]);
  const [fromDate, setFromDate] = useState(getCalendarDate());
  const [toDate, setToDate] = useState(getCalendarDate());
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [dateError, setDateError] = useState('');
  // 'pending' → screen just opened, toDate disabled
  // 'valid'   → valid fromDate chosen, toDate enabled
  // 'error'   → future fromDate chosen, toDate hidden
  const [fromDateStatus, setFromDateStatus] = useState('pending');

  // Local date formatter to avoid UTC conversion issues
  const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const fetchOpeningBalance = useCallback(async (fromDateParam, toDateParam, skipPageLoader = false) => {
    if (!skipPageLoader) setLoading(true);
    try {
      const formattedFromDate = formatDate(fromDateParam);
      const formattedToDate = formatDate(toDateParam);
      const storedUserId = await AsyncStorage.getItem('userId');
      const agentId = storedUserId && storedUserId.trim() ? storedUserId.trim() : '4';

      const requestParams = {
        from_date: formattedFromDate,
        to_date: formattedToDate,
        agent_id: agentId,
        page: 1,
        limit: 20,
      };

      const response = await apiServices.upfrontCash.getOpeningBalance(requestParams);

      const responseData = response?.data || [];
      console.log('📊 API Response - Records count:', responseData.length);
      setRecords(responseData);

    } catch (error) {
      showError(t('common.error'), getApiErrorMessage(error, t('upfrontCash.failedToLoad')));
      setRecords([]);
    } finally {
      if (!skipPageLoader) setLoading(false);
    }
  }, [t]);

  const onRefresh = useCallback(async () => {
    if (refreshing || !fromDate || !toDate || fromDateStatus === 'error') return;
    setRefreshing(true);
    try {
      await fetchOpeningBalance(fromDate, toDate, true);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fromDate, toDate, fromDateStatus, fetchOpeningBalance]);

  useFocusEffect(
    useCallback(() => {
      if (fromDate && toDate && fromDateStatus !== 'error') {
        fetchOpeningBalance(fromDate, toDate);
      }
    }, [fromDate, toDate, fromDateStatus, fetchOpeningBalance]),
  );

  const today = getCalendarDate();
  today.setHours(23, 59, 59, 999);

  const handleFromDateChange = (event, selectedDate) => {
    setShowFromDatePicker(false);
    if (selectedDate) {
      console.log('📅 Date picker - From date selected:', selectedDate);
      if (selectedDate > today) {
        // Future date — hide toDate entirely until user corrects fromDate
        setFromDateStatus('error');
        setDateError(t('upfrontCash.futureDateError'));
      } else {
        // Valid fromDate — enable toDate
        setFromDateStatus('valid');
        setFromDate(selectedDate);
        if (selectedDate > toDate) {
          // fromDate moved past current toDate — warn but keep toDate accessible
          setDateError(t('upfrontCash.startDateError'));
        } else {
          setDateError('');
        }
      }
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    setShowToDatePicker(false);
    if (selectedDate) {
      console.log('📅 Date picker - To date selected:', selectedDate);
      if (selectedDate > today) {
        setDateError(t('upfrontCash.futureDateError'));
      } else if (selectedDate < fromDate) {
        setDateError(t('upfrontCash.endDateError'));
      } else {
        setDateError('');
        setToDate(selectedDate);
      }
    }
  };

  const getFrontCashTotal = (record) =>
    Number(record?.total_frontcash || 0) + Number(record?.total_frontcash_online || 0);

  const renderRecordCard = (record) => {
    const fields = [
      { key: 'opening_balance', labelKey: 'openingBalance' },
      { key: 'total_collection', labelKey: 'totalCollection' },
      { key: 'total_expeses', labelKey: 'totalExpenses' },
      { key: 'total_frontcash_combined', labelKey: 'totalFrontCashCombined' },
      { key: 'total_loangiven', labelKey: 'totalLoanGiven' },
      { key: 'closing_balance', labelKey: 'closingBalance' },
    ];

    return (
      <View style={styles.recordCard}>
        <View style={styles.fieldsContainer}>
          {record.crondate ? (
            <View style={[styles.fieldRow, styles.dateRow]}>
              <Text style={styles.dateRowLabel}>{t('upfrontCash.date')}</Text>
              <Text style={styles.dateRowValue}>
                {formatDisplayDate(record.crondate)}
              </Text>
            </View>
          ) : null}
          {fields.map((field) => (
            <View key={field.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t(`upfrontCash.${field.labelKey}`)}</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={styles.fieldValue} numberOfLines={1}>
                  {formatCurrency(
                    field.key === 'total_frontcash_combined'
                      ? getFrontCashTotal(record)
                      : (record[field.key] || 0),
                  )}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('upfrontCash.loadingUpfrontCash')}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>{t('upfrontCash.noUpfrontCash')}</Text>
      </View>
    );
  };

  const renderContent = () => {
    return (
      <FlatList
        data={records}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={({ item }) => renderRecordCard(item)}
        contentContainerStyle={[
          styles.recordsList,
          records.length === 0 && styles.recordsListEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />
    );
  };

  const renderDateFilters = () => (
    <View style={styles.dateFilterWrapper}>
      <View style={styles.dateFilterContainer}>
        {/* From Date — always visible and enabled */}
        <TouchableOpacity
          style={[
            styles.dateButton,
            fromDateStatus === 'error' && styles.dateButtonError,
          ]}
          onPress={() => setShowFromDatePicker(true)}
        >
          <Text style={styles.dateLabel}>{t('upfrontCash.fromDate')}</Text>
          <Text style={styles.dateValue}>
            {formatDisplayDate(fromDate.toISOString().split('T')[0])}
          </Text>
        </TouchableOpacity>

        {/* To Date — hidden on error, disabled until fromDate is valid */}
        {fromDateStatus !== 'error' && (
          <TouchableOpacity
            style={[
              styles.dateButton,
              fromDateStatus === 'pending' && styles.dateButtonDisabled,
            ]}
            onPress={() => fromDateStatus === 'valid' && setShowToDatePicker(true)}
            activeOpacity={fromDateStatus === 'valid' ? 0.7 : 1}
          >
            <Text style={[
              styles.dateLabel,
              fromDateStatus === 'pending' && styles.dateLabelDisabled,
            ]}>
              {t('upfrontCash.toDate')}
            </Text>
            <Text style={[
              styles.dateValue,
              fromDateStatus === 'pending' && styles.dateValueDisabled,
            ]}>
              {formatDisplayDate(toDate.toISOString().split('T')[0])}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {dateError ? (
        <Text style={styles.dateErrorText}>{dateError}</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Header
        title={t('upfrontCash.title')}
        showBackButton={true}
        onBackPress={() => safeGoBack(navigation)}
        // rightComponent={
        //   <TouchableOpacity
        //     onPress={() => navigation.navigate('UpfrontCashAdd')}
        //     style={styles.headerAddButton}
        //     activeOpacity={0.7}
        //     accessibilityLabel={t('upfrontCash.addUpfrontCash')}
        //   >
        //     <Ionicons name="add" size={24} color={COLORS.white} />
        //   </TouchableOpacity>
        // }
      />
      {renderDateFilters()}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
      {showFromDatePicker && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="default"
          onChange={handleFromDateChange}
        />
      )}
      {showToDatePicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display="default"
          onChange={handleToDateChange}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    flex: 1,
    padding: SIZES.margin,
  },
  recordsList: {
    paddingBottom: SIZES.padding,
  },
  recordsListEmpty: {
    flexGrow: 1,
  },
  recordCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fieldsContainer: {
    padding: SIZES.base,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SIZES.base * 0.75,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fieldLabel: {
    flex: 1,
    flexShrink: 1,
    paddingRight: SIZES.base,
    fontSize: SIZES.body3,
    lineHeight: 20,
    color: COLORS.text.secondary,
    fontWeight: '400',
  },
  fieldValueContainer: {
    maxWidth: '48%',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  fieldValue: {
    fontSize: SIZES.body3,
    fontWeight: '400',
    color: COLORS.black,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 4,
  },
  loadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body2,
    color: COLORS.text.secondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.padding * 4,
  },
  emptyStateText: {
    fontSize: SIZES.body1,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  dateFilterWrapper: {
    marginHorizontal: SIZES.margin,
    marginVertical: SIZES.base,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    gap: SIZES.base,
  },
  dateErrorText: {
    marginTop: SIZES.base / 2,
    fontSize: SIZES.body4,
    color: COLORS.error || '#e53935',
    textAlign: 'center',
  },
  dateRow: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius / 2,
    marginBottom: SIZES.base / 2,
    paddingVertical: SIZES.base,
    borderBottomColor: COLORS.border,
  },
  dateRowLabel: {
    flex: 1,
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  dateRowValue: {
    fontSize: SIZES.body3,
    fontWeight: '700',
    color: COLORS.black,
  },
  dateButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    padding: SIZES.base,
    alignItems: 'center',
  },
  dateButtonDisabled: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    opacity: 0.5,
  },
  dateButtonError: {
    borderColor: COLORS.error || '#e53935',
  },
  dateLabel: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
  },
  dateLabelDisabled: {
    color: COLORS.text.secondary,
  },
  dateValue: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.black,
  },
  dateValueDisabled: {
    color: COLORS.text.secondary,
  },
  headerAddButton: {
    padding: SIZES.padding / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default UpfrontCashScreen;
