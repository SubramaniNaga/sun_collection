import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiServices from '../../api/services/apiServices';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../store/LanguageContext';
import { formatCurrency } from '../../utils/amountFormatters';
import { formatDisplayDate } from '../../utils/dateFormatter';

const UpfrontCashScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  // Local date formatter to avoid UTC conversion issues
  const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Test date formatting on component mount
  console.log('🧪 UpfrontCashScreen - Component mounted');
  console.log('🧪 Today\'s date (local):', formatDate(new Date()));
  console.log('🧪 Today\'s date (toISOString):', new Date().toISOString().split('T')[0]);
  console.log('🧪 Initial fromDate:', formatDate(fromDate));
  console.log('🧪 Initial toDate:', formatDate(toDate));

  // API call function
  const fetchOpeningBalance = useCallback(async (fromDateParam, toDateParam) => {
    setLoading(true);
    try {
      const formattedFromDate = formatDate(fromDateParam);
      const formattedToDate = formatDate(toDateParam);
      
      // Log API params before call
      console.log('🌐 API Params:', {
        from_date: formattedFromDate,
        to_date: formattedToDate,
        agent_id: '4',
        page: 1,
        limit: 20
      });
      
      const requestParams = {
        from_date: formattedFromDate,
        to_date: formattedToDate,
        agent_id: '4',
        page: 1,
        limit: 20,
      };
      
      // Log final API request parameters
      console.log('🌐 API Request Params:', JSON.stringify(requestParams, null, 2));
      console.log('🌐 Expected URL: /api/v1/frontcash/openingbalance?' + new URLSearchParams(requestParams).toString());
      
      const response = await apiServices.upfrontCash.getOpeningBalance(requestParams);

      const responseData = response?.data || [];
      console.log('📊 API Response - Records count:', responseData.length);
      setRecords(responseData);

    } catch (error) {
      console.error('❌ Opening balance fetch error:', error);
      console.error('❌ Error response status:', error.response?.status);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error config:', error.config);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []); // Keep empty dependency array to prevent recreation

  // API call when dates change (handles both initial load and subsequent changes)
  useEffect(() => {
    if (fromDate && toDate) {
      console.log('🔄 Dates changed, triggering API call');
      console.log('🔄 fromDate:', formatDate(fromDate));
      console.log('🔄 toDate:', formatDate(toDate));
      fetchOpeningBalance(fromDate, toDate);
    }
  }, [fromDate, toDate]); // Remove fetchOpeningBalance from dependencies to prevent infinite loop


  // Updated date picker handlers (no immediate API calls)
  const handleFromDateChange = (event, selectedDate) => {
    setShowFromDatePicker(false);
    if (selectedDate) {
      console.log('📅 Date picker - From date selected:', selectedDate);
      console.log('📅 Date picker - Formatted from date:', formatDate(selectedDate));
      setFromDate(selectedDate);
      // API call will be triggered by useEffect
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    setShowToDatePicker(false);
    if (selectedDate) {
      console.log('📅 Date picker - To date selected:', selectedDate);
      console.log('📅 Date picker - Formatted to date:', formatDate(selectedDate));
      setToDate(selectedDate);
      // API call will be triggered by useEffect
    }
  };

  const renderRecordCard = (record) => {
    // Use full text for both English and Tamil - no tooltips, single line
    const fields = [
      { 
        key: 'opening_balance', 
        label: language === 'en' ? 'Opening Balance' : 'துவக்க இருப்பு' 
      },
      { 
        key: 'total_expeses', 
        label: language === 'en' ? 'Total Expenses' : 'மொத்த செலவுகள்' 
      },
      { 
        key: 'total_frontcash', 
        label: language === 'en' ? 'Total Front Cash' : 'மொத்த முன் பணம்' 
      },
      { 
        key: 'total_collection', 
        label: language === 'en' ? 'Total Collection' : 'மொத்த சேகரிப்பு' 
      },
      { 
        key: 'total_loangiven', 
        label: language === 'en' ? 'Total Loan Given' : 'மொத்த கடன் வழங்கப்பட்டது' 
      },
      { 
        key: 'closing_balance', 
        label: language === 'en' ? 'Closing Balance' : 'மூடுதல் இருப்பு' 
      },
    ];

    return (
      <View style={styles.recordCard}>
        <View style={styles.fieldsContainer}>
          {fields.map((field, index) => (
            <View key={field.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel} numberOfLines={1}>{field.label}</Text>
              <View style={styles.fieldValueContainer}>
                <Text style={styles.fieldValue} numberOfLines={1}>
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
        <Text style={styles.emptyStateText}>{t('upfrontCash.noUpfrontCash')}</Text>
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
      <FlatList
        data={records}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={({ item }) => renderRecordCard(item)}
        contentContainerStyle={styles.recordsList}
        showsVerticalScrollIndicator={false}
      />
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
  contentContainer: {
    flex: 1,
    padding: SIZES.margin,
  },
  recordsList: {
    paddingBottom: SIZES.padding,
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
    alignItems: 'center',
    paddingVertical: SIZES.base / 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fieldLabel: {
    flex: 1,
    fontSize: SIZES.body5, // Further reduced font size to fit Tamil text on single line
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
