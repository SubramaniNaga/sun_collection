import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDisplayDate } from '../../utils/dateFormatter';

const UpfrontCashScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const isLoadingRef = useRef(false);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  const fetchData = useCallback(async (page = 1) => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('📊 UpfrontCash - Already loading, skipping request');
      return;
    }
    
    isLoadingRef.current = true;
    setLoading(true);
    console.log('📊 UpfrontCash - Starting fetch for page:', page);
    try {
      const formattedFromDate = fromDate.toISOString().split('T')[0];
      const formattedToDate = toDate.toISOString().split('T')[0];
      
      const response = await apiServices.upfrontCash.getOpeningBalance({
        from_date: formattedFromDate,
        to_date: formattedToDate,
        page: page,
        limit: 20,
      });

      // Handle paginated response - the API returns { data: [...], pagination: {...} }
      const responseData = response?.data || [];
      const paginationData = response?.pagination || {};
      
      console.log('📊 UpfrontCash - Response data:', responseData);
      console.log('📊 UpfrontCash - Pagination data:', paginationData);
      console.log('📊 UpfrontCash - Data length:', responseData.length);
      
      setRecords(responseData);
      setPagination({
        currentPage: paginationData.currentPage || page,
        totalPages: paginationData.totalPages || 1,
        totalRecords: paginationData.totalRecords || 0,
        limit: paginationData.limit || 20,
        hasNextPage: paginationData.hasNextPage || false,
        hasPreviousPage: paginationData.hasPreviousPage || false,
      });
      console.log('📊 UpfrontCash - Data loaded successfully');

    } catch (error) {
      console.error('Opening balance fetch error:', error);
      setRecords([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
        limit: 20,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    } finally {
      console.log('📊 UpfrontCash - Setting loading to false');
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useFocusEffect(
    useCallback(() => {
      console.log('📊 UpfrontCash - useFocusEffect triggered, isLoadingRef:', isLoadingRef.current);
      if (!isLoadingRef.current) {
        fetchData();
      }
    }, [fetchData])
  );

  const handleFromDateChange = (event, selectedDate) => {
    setShowFromDatePicker(false);
    if (selectedDate) {
      setFromDate(selectedDate);
      // Automatically set to_date to current date when from_date is selected
      setToDate(new Date());
      // Reset to page 1 and fetch data with new date range
      setTimeout(() => fetchData(1), 0);
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    setShowToDatePicker(false);
    if (selectedDate) {
      setToDate(selectedDate);
      // Reset to page 1 and fetch data with new date range
      setTimeout(() => fetchData(1), 0);
    }
  };

  const handlePageChange = (newPage) => {
    fetchData(newPage);
  };

  const renderRecordCard = (record) => {
    const fields = [
      { key: 'opening_balance', label: t('upfrontCash.openingBalance') },
      { key: 'total_expeses', label: t('upfrontCash.totalExpenses') }, // Using exact API key
      { key: 'total_frontcash', label: t('upfrontCash.totalFrontCash') },
      { key: 'total_collection', label: t('upfrontCash.totalCollection') },
      { key: 'total_loangiven', label: t('upfrontCash.totalLoanGiven') },
      { key: 'closing_balance', label: t('upfrontCash.closingBalance') },
    ];

    // Format crondate for display
    const formattedDate = record.crondate ? 
      new Date(record.crondate).toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      }) : '';

    return (
      <View style={styles.recordCard}>
        {/* Card Header */}
        {/* <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderText}>{formattedDate}</Text>
          <Text style={styles.cardHeaderText}>{record.agent_name || 'Unknown Agent'}</Text>
        </View> */}
        
        {/* Fields as Label-Value Rows */}
        <View style={styles.fieldsContainer}>
          {fields.map((field, index) => (
            <View key={field.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={styles.fieldValue}>
                  {formatCurrency(record[field.key] || '0')}
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
        <Ionicons name="wallet-outline" size={48} color={COLORS.text.tertiary} />
        <Text style={styles.emptyStateText}>{t('upfrontCash.noUpfrontCash')}</Text>
        <Text style={styles.emptyStateSubText}>{t('upfrontCash.tapToAdd')}</Text>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return renderEmpty();
    }
    
    if (!records || records.length === 0) {
      return renderEmpty();
    }
    
    return (
      <View style={styles.contentContainer}>
      
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderRecordCard(item)}
          contentContainerStyle={styles.recordsList}
          showsVerticalScrollIndicator={false}
        />
        
        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[
                styles.paginationButton,
                !pagination.hasPreviousPage && styles.paginationButtonDisabled
              ]}
              onPress={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPreviousPage}
            >
              <Text style={[
                styles.paginationButtonText,
                !pagination.hasPreviousPage && styles.paginationButtonTextDisabled
              ]}>
                {t('upfrontCash.previous')}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.pageInfo}>
              <Text style={styles.pageInfoText}>
                {t('upfrontCash.page')} {pagination.currentPage} {t('upfrontCash.of')} {pagination.totalPages}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[
                styles.paginationButton,
                !pagination.hasNextPage && styles.paginationButtonDisabled
              ]}
              onPress={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
            >
              <Text style={[
                styles.paginationButtonText,
                !pagination.hasNextPage && styles.paginationButtonTextDisabled
              ]}>
                {t('upfrontCash.next')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderDateFilters = () => (
    <View style={styles.dateFilterContainer}>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowFromDatePicker(true)}
      >
        <Text style={styles.dateLabel}>{t('upfrontCash.fromDate')}</Text>
        <Text style={styles.dateValue}>{formatDisplayDate(fromDate.toISOString().split('T')[0])}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowToDatePicker(true)}
      >
        <Text style={styles.dateLabel}>{t('upfrontCash.toDate')}</Text>
        <Text style={styles.dateValue}>{formatDisplayDate(toDate.toISOString().split('T')[0])}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" backgroundColor={COLORS.statusBar} />
      <Header
        title={t('upfrontCash.title')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
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
          maximumDate={toDate}
        />
      )}
      {showToDatePicker && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display="default"
          onChange={handleToDateChange}
          minimumDate={fromDate}
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
  headerAddButton: {
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 0,
    paddingBottom: SIZES.padding,
  },
  listEmpty: {
    flexGrow: 1,
    paddingBottom: SIZES.padding,
  },
  tableHeader: {
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    marginHorizontal: 0,
    marginTop: SIZES.margin,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeaderCell: {
    flex: 1,
    padding: SIZES.base,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  idCell: {
    flex: 0.5,
  },
  tableHeaderCellLast: {
    borderRightWidth: 0,
  },
  tableRow: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  tableCell: {
    flex: 1,
    padding: SIZES.base,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    justifyContent: 'center',
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  tableHeaderText: {
    fontSize: SIZES.body4,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SIZES.base / 2,
  },
  tableRowText: {
    fontSize: SIZES.body4,
    fontWeight: '700',
    color: COLORS.black,
  },
  tableLabel: {
    fontSize: SIZES.body3,
    color: COLORS.black,
    marginBottom: SIZES.base / 4,
  },
  tableValue: {
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.black,
  },
  statusBadge: {
    paddingHorizontal: SIZES.base / 2,
    paddingVertical: SIZES.base / 4,
    borderRadius: SIZES.radius / 2,
    backgroundColor: COLORS.text.tertiary,
    alignSelf: 'flex-start',
  },
  statusSettled: {
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: SIZES.body4,
    fontWeight: '600',
    color: COLORS.white,
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
    marginTop: SIZES.margin,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: SIZES.body2,
    color: COLORS.primary,
    marginTop: SIZES.base,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: SIZES.margin,
  },
  recordsInfo: {
    backgroundColor: COLORS.primary,
    padding: SIZES.base,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin,
  },
  recordsInfoText: {
    fontSize: SIZES.body2,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  recordsList: {
    paddingBottom: SIZES.padding * 2,
  },
  recordCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    marginHorizontal: 0,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.base,
    borderTopLeftRadius: SIZES.radius,
    borderTopRightRadius: SIZES.radius,
  },
  cardHeaderText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.primary,
  },
  fieldsContainer: {
    padding: SIZES.base,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base / 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fieldLabel: {
    flex: 1,
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  fieldValueContainer: {
    flex: 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  fieldValue: {
    fontSize: SIZES.body2,
    fontWeight: '700',
    color: COLORS.black,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.base,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paginationButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.base * 1.5,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    minWidth: 80,
  },
  paginationButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  paginationButtonText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  paginationButtonTextDisabled: {
    color: COLORS.text.tertiary,
  },
  pageInfo: {
    flex: 1,
    alignItems: 'center',
  },
  pageInfoText: {
    fontSize: SIZES.body3,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  dateFilterContainer: {
    flexDirection: 'row',
    marginHorizontal: SIZES.margin,
    marginVertical: SIZES.base,
    gap: SIZES.base,
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
  dateLabel: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
    marginBottom: SIZES.base / 2,
  },
  dateValue: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.black,
  },
});

export default UpfrontCashScreen;
