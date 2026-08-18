import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiServices } from '../../api/services/apiServices';
import DatePicker from '../../components/common/DatePicker';
import Header from '../../components/common/Header';
import { COLORS, SIZES } from '../../constants/theme';
import Collection from '../../models/Collection';
import Dashboard from '../../models/Dashboard';
import { useLanguage } from '../../store/LanguageContext';
import { getApiErrorMessage, showError, showSuccess, showWarning } from '../../utils/alertService';
import { formatCurrency } from '../../utils/amountFormatters';
import { guardAttendanceGatedEntry } from '../../utils/attendanceEntryGate';
import { formatDateForAPI, getCalendarDateISO, getCurrentDateString } from '../../utils/dateFormatter';
import { safeGoBack } from '../../utils/navigationHelpers';

/**
 * `stats.closingbalance` (or `closing_balance`) from GET /collection/history:
 * when boolean/1 flag (not a currency total), period is closed — hide Close Account UI.
 */
function isClosingBalanceDone(statsLike) {
  if (!statsLike || typeof statsLike !== 'object') return false;
  const v = statsLike.closingbalance ?? statsLike.closing_balance;
  if (v === true) return true;
  if (v === 1 || v === '1') return true;
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  // Numeric closing balances from the API are monetary totals, not "closed" flags.
  return false;
}

/** Normalize GET /frontcash/dashboard/today response for {@link Dashboard.fromApiResponse} */
function dashboardDataFromTodayApi(res) {
  if (!res || typeof res !== 'object') return {};
  if (res.success && res.data && typeof res.data === 'object') return res.data;
  if (res.data && typeof res.data === 'object') {
    const d = res.data;
    if (
      d.expenses != null ||
      d.collections != null ||
      d.frontcash != null ||
      d.loans_given != null ||
      d.processing_fee != null ||
      d.processing_fees != null
    ) {
      return d;
    }
  }
  if (
    res.expenses != null ||
    res.collections != null ||
    res.frontcash != null ||
    res.loans_given != null ||
    res.processing_fee != null ||
    res.processing_fees != null
  ) {
    return res;
  }
  return {};
}

const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 50;

/**
 * Sum collection receipt amounts by payment_type from /collection/history pages.
 */
async function sumPaymentSplitAcrossPages(fromDate, toDate, firstPageRes, fetchHistoryFn) {
  let cash = 0;
  let online = 0;
  const addCollections = (cols) => {
    if (!Array.isArray(cols)) return;
    for (const row of cols) {
      const amt = parseFloat(row.amount_paid ?? 0) || 0;
      const pt = String(row.payment_type ?? '').toLowerCase().trim();
      if (pt === 'cash') {
        cash += amt;
      } else {
        online += amt;
      }
    }
  };

  addCollections(firstPageRes?.data?.collections);

  let page = 2;
  let pag = firstPageRes?.pagination ?? {};
  while (Boolean(pag.hasNextPage) && page <= HISTORY_MAX_PAGES) {
    const res = await fetchHistoryFn({
      from_date: fromDate,
      to_date: toDate,
      page,
      limit: HISTORY_PAGE_SIZE,
    });
    addCollections(res?.data?.collections);
    pag = res?.pagination ?? {};
    page += 1;
  }

  return { cash, online };
}

/** YYYY-MM-DD keys after POST closeaccount returns `data.inserted === true` (one close per day). */
const CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY = 'cash_account_closed_inserted_dates_v1';

async function loadClosedInsertedDatesMap() {
  try {
    const raw = await AsyncStorage.getItem(CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY);
    if (!raw) return {};
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return {};
    return Object.fromEntries(arr.map((d) => [String(d), true]));
  } catch {
    return {};
  }
}

async function persistClosedInsertedDate(apiDateStr) {
  const d = String(apiDateStr);
  try {
    const raw = await AsyncStorage.getItem(CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    if (!list.includes(d)) {
      list.push(d);
      await AsyncStorage.setItem(CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}

function roundMoney2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Whole rupees only; `cash + online` equals `totalInt` (Hamilton / largest remainder, two-way). */
function splitBalanceIntoChannelInts(totalInt, weightCash, weightOnline) {
  const t = Math.round(Number(totalInt));
  const wc = Math.max(0, Number(weightCash) || 0);
  const wo = Math.max(0, Number(weightOnline) || 0);
  const sumW = wc + wo;
  if (!Number.isFinite(t) || sumW <= 0) {
    const half = Math.trunc(t / 2);
    return { cashNet: half, onlineNet: t - half };
  }
  const rawCash = (t * wc) / sumW;
  const rawOnline = (t * wo) / sumW;
  let cashNet = Math.floor(rawCash);
  let onlineNet = Math.floor(rawOnline);
  let rem = t - cashNet - onlineNet;
  const fracCash = rawCash - cashNet;
  const fracOnline = rawOnline - onlineNet;
  while (rem > 0) {
    if (fracCash >= fracOnline) {
      cashNet += 1;
      rem -= 1;
    } else {
      onlineNet += 1;
      rem -= 1;
    }
  }
  while (rem < 0) {
    if (fracCash <= fracOnline) {
      cashNet -= 1;
      rem += 1;
    } else {
      onlineNet -= 1;
      rem += 1;
    }
  }
  return { cashNet, onlineNet };
}

const CashAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [startDate, setStartDate] = useState(getCalendarDateISO());
  const [endDate, setEndDate] = useState(getCalendarDateISO());
  const [stats, setStats] = useState(null); // from /collection/history
  const [openingSummary, setOpeningSummary] = useState(null); // from /frontcash/openingbalance
  const [processingFeeTotal, setProcessingFeeTotal] = useState(0);
  /** Today's GET /frontcash/dashboard/today parsed model — drives upfront, fees, expenses for single-day today */
  const [todayDashboard, setTodayDashboard] = useState(null);
  /** Cash vs online: today's dashboard {@link Dashboard#getCashPositionSplit}, else collection history. */
  const [collectionPaymentSplit, setCollectionPaymentSplit] = useState({ cash: 0, online: 0 });
  /** YYYY-MM-DD → true when close account succeeded with `data.inserted` (persisted). */
  const [closedInsertedDates, setClosedInsertedDates] = useState({});
  const [expenseDetailsVisible, setExpenseDetailsVisible] = useState(false);

  const expenseDetailRows = useMemo(() => {
    const list =
      (Array.isArray(openingSummary?.expenses_list) && openingSummary.expenses_list) ||
      (Array.isArray(openingSummary?.expense_list) && openingSummary.expense_list) ||
      (Array.isArray(stats?.expenses_list) && stats.expenses_list) ||
      [];
    return list.map((item, index) => ({
      id: item?.id != null ? String(item.id) : `expense-${index}`,
      label: String(item?.category_name || item?.title || '').trim() || t('cashAccount.expenses'),
      amount: Number(item?.amount ?? 0) || 0,
    }));
  }, [openingSummary, stats, t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const map = await loadClosedInsertedDatesMap();
        if (!cancelled) setClosedInsertedDates(map);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const validateDates = useCallback(() => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start > end) {
      newErrors.dateRange = t('validation.startDateGreater');
    }
    if (end > today) {
      newErrors.dateRange = t('validation.endDateBeyond');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [startDate, endDate, t]);

  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    setExpenseDetailsVisible(false);
    setErrors({});
  };

  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate);
    setExpenseDetailsVisible(false);
    setErrors({});
  };

  /** Apply raw GET /frontcash/dashboard/today response to screen state. */
  const applyTodayDashboardResponse = useCallback((todayDashRes) => {
    if (todayDashRes == null) return;
    try {
      const raw = dashboardDataFromTodayApi(todayDashRes);
      const dash = Dashboard.fromApiResponse(raw);
      setTodayDashboard(dash);
      setProcessingFeeTotal(Number(dash.processingFees?.totalAmount ?? 0) || 0);
      setCollectionPaymentSplit(dash.getCashPositionSplit());
    } catch (err) {
      console.warn('CashAccountScreen: applyTodayDashboardResponse', err);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!validateDates()) return;
    setLoading(true);
    try {
      const fromDate = formatDateForAPI(startDate);
      const toDate = formatDateForAPI(endDate);
      const todayStr = getCurrentDateString();
      const useTodayDashboardForFees = fromDate === toDate && fromDate === todayStr;

      const [openingRes, historyRes, todayDashRes] = await Promise.all([
        apiServices.upfrontCash.getOpeningBalance({ from_date: fromDate, to_date: toDate, page: 1, limit: 1 }),
        apiServices.collection.getCollectionHistory({
          from_date: fromDate,
          to_date: toDate,
          page: 1,
          limit: HISTORY_PAGE_SIZE,
        }),
        useTodayDashboardForFees
          ? apiServices.dashboard.getTodayStats().catch((err) => {
            console.warn('CashAccountScreen: dashboard today (processing fee):', err);
            return null;
          })
          : Promise.resolve(null),
      ]);

      const historyStats = historyRes?.data?.stats ?? null;
      setStats(historyStats);

      const openingList = Array.isArray(openingRes?.data) ? openingRes.data : Array.isArray(openingRes) ? openingRes : [];
      setOpeningSummary(openingList?.[0] ?? null);

      if (useTodayDashboardForFees && todayDashRes != null) {
        applyTodayDashboardResponse(todayDashRes);
      } else {
        setTodayDashboard(null);
        const paySplit = await sumPaymentSplitAcrossPages(
          fromDate,
          toDate,
          historyRes,
          (p) => apiServices.collection.getCollectionHistory(p)
        );
        setCollectionPaymentSplit(paySplit);
        // Processing fee for non-today ranges: sum daily collection lists when range is small.
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const days = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        if (days >= 1 && days <= 31) {
          let sumProcessing = 0;
          for (let i = 0; i < days; i += 1) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const dateStr = formatDateForAPI(d);
            const collectionsRes = await apiServices.collection.getCollectionList({ collection_date: dateStr });
            const colRaw = collectionsRes?.response ?? collectionsRes?.data ?? [];
            const colArr = Array.isArray(colRaw) ? colRaw : [];
            const collections = Collection.fromApiResponseArray(colArr);
            sumProcessing += collections.reduce((sum, c) => sum + (parseFloat(c.processingFees) || 0), 0);
          }
          setProcessingFeeTotal(sumProcessing);
        } else {
          setProcessingFeeTotal(0);
        }
      }
    } catch (err) {
      showError(t('common.error'), getApiErrorMessage(err, t('errors.somethingWentWrong')));
      setStats(null);
      setOpeningSummary(null);
      setProcessingFeeTotal(0);
      setTodayDashboard(null);
      setCollectionPaymentSplit({ cash: 0, online: 0 });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, validateDates, applyTodayDashboardResponse]);

  useFocusEffect(
    useCallback(() => {
      fetchSummary();
    }, [fetchSummary])
  );

  // Prefer dashboard frontcashByType (cash vs upi+bank+other). Fall back to openingbalance totals.
  const upfrontByCash =
    todayDashboard != null
      ? Number(todayDashboard.frontcashByType?.cash ?? 0) || 0
      : Number(
          openingSummary?.total_frontcash_by_type?.cash ??
            openingSummary?.total_frontcash ??
            0
        ) || 0;
  const upfrontByOnline =
    todayDashboard != null
      ? Number(
          (todayDashboard.frontcashByType?.upi ?? 0) +
            (todayDashboard.frontcashByType?.bank ?? 0) +
            (todayDashboard.frontcashByType?.other ?? 0)
        ) || 0
      : Number(
          openingSummary?.total_frontcash_online ??
            openingSummary?.total_frontcash_by_type?.online ??
            openingSummary?.total_frontcash_by_type?.upi ??
            0
        ) || 0;
  const upfrontCash =
    todayDashboard != null
      ? Number(todayDashboard.frontcash?.totalAmount ?? 0) || upfrontByCash + upfrontByOnline
      : Number(openingSummary?.total_frontcash ?? 0) || upfrontByCash + upfrontByOnline;
  const loanGiven =
    todayDashboard != null
      ? Number(todayDashboard.loansGiven?.totalAmount ?? 0) || 0
      : Number(stats?.loan_given_amount ?? openingSummary?.total_loangiven ?? 0) || 0;
  const expenses =
    todayDashboard != null
      ? Number(todayDashboard.expenses?.totalAmount ?? 0) || 0
      : Number(stats?.expenses_spent ?? openingSummary?.total_expeses ?? 0) || 0;
  const collectionCompleted =
    todayDashboard != null
      ? Number(todayDashboard.collections?.totalAmount ?? 0) || 0
      : Number(stats?.collected_amount ?? openingSummary?.total_collection ?? 0) || 0;

  const previousBalance = Number(
    openingSummary?.opening_balance ?? openingSummary?.previous_balance ?? 0
  ) || 0;

  /** Received total: previous balance + collection + magimai. */
  const totalReceived = useMemo(
    () => previousBalance + processingFeeTotal + collectionCompleted,
    [previousBalance, processingFeeTotal, collectionCompleted]
  );

  /** Spent total: loan given + expenses. */
  const totalSpent = useMemo(() => loanGiven + expenses, [loanGiven, expenses]);

  /**
   * Net closing (Close Account payload): received total − spent total.
   */
  const totalBalance = useMemo(() => totalReceived - totalSpent, [totalReceived, totalSpent]);

  /**
   * **In account** / **In hand** (footer): same formula as the table, but each line item is split
   * using dashboard `by_type` / `by_payment_type`:
   * `(front + collection + processing fee) − (expenses + loan given)` per channel.
   * Without today's dashboard, totals are split across channels approximately from collections mix.
   */
  const channelEodBalances = useMemo(() => {
    if (todayDashboard != null) {
      const b = todayDashboard.getCloseAccountChannelBreakdown();
      return {
        onlineNet: Math.round(b.online.net),
        cashNet: Math.round(b.cash.net),
      };
    }
    const c = Number(collectionPaymentSplit.cash) || 0;
    const o = Number(collectionPaymentSplit.online) || 0;
    const mix = c + o;
    const tbInt = Math.round(Number(totalBalance));
    if (mix > 0) {
      const { cashNet, onlineNet } = splitBalanceIntoChannelInts(tbInt, c, o);
      return { onlineNet, cashNet };
    }
    const half = Math.trunc(tbInt / 2);
    return {
      onlineNet: tbInt - half,
      cashNet: half,
    };
  }, [todayDashboard, collectionPaymentSplit, totalBalance]);

  /**
   * Close Account may run only on the **current calendar day**: both pickers must match today (YYYY-MM-DD).
   * Past/future single-day ranges or multi-day ranges must not show the button.
   */
  const isCurrentDaySelectedForClose = useMemo(() => {
    const todayKey = getCurrentDateString();
    const fromKey = formatDateForAPI(startDate);
    const toKey = formatDateForAPI(endDate);
    return Boolean(fromKey && toKey && fromKey === todayKey && toKey === todayKey);
  }, [startDate, endDate]);

  const accountClosingBlocked = useMemo(() => isClosingBalanceDone(stats), [stats]);

  const selectedDayKey = useMemo(() => formatDateForAPI(startDate), [startDate]);
  const selectedEndDayKey = useMemo(() => formatDateForAPI(endDate), [endDate]);

  const isTableClosedInserted = useMemo(
    () =>
      Boolean(selectedDayKey) &&
      selectedDayKey === selectedEndDayKey &&
      Boolean(closedInsertedDates[selectedDayKey]),
    [selectedDayKey, selectedEndDayKey, closedInsertedDates]
  );

  /** Today dashboard says day is closed (`closing_status === 1`). */
  const isTodayClosedByDashboardStatus = useMemo(() => {
    if (todayDashboard == null) return false;
    const s = todayDashboard.closingStatus;
    if (s == null) return false;
    return Number(s) === 1;
  }, [todayDashboard]);

  const showCloseAccountButton =
    isCurrentDaySelectedForClose &&
    !accountClosingBlocked &&
    !isTableClosedInserted &&
    !isTodayClosedByDashboardStatus;

  const dash = '—';

  const renderTableRow3 = (key, label, spentVal, receivedVal, rowStyle, options = {}) => (
    <View key={key} style={[styles.tableGridRow, options.detailRow && styles.tableGridDetailRow, rowStyle]}>
      <View style={[styles.tableGridCell, styles.tableGridColParticulars]}>
        {options.labelNode ?? (
          <Text
            style={[
              styles.tableCellParticularsText,
              options.detailRow && styles.tableCellParticularsDetailText,
              isTableClosedInserted && styles.tableTextClosedBlack,
            ]}
            numberOfLines={2}
          >
            {label}
          </Text>
        )}
      </View>
      <View style={[styles.tableGridCell, styles.tableGridColAmount, styles.tableGridCellAmount]}>
        <Text
          style={[
            styles.tableCellAmountText,
            receivedVal == null && styles.tableCellDash,
            isTableClosedInserted && styles.tableTextClosedBlack,
          ]}
          numberOfLines={1}
        >
          {receivedVal != null ? receivedVal : dash}
        </Text>
      </View>
      <View style={[styles.tableGridCell, styles.tableGridColAmount, styles.tableGridCellAmount, styles.tableGridCellLast]}>
        <Text
          style={[
            styles.tableCellAmountText,
            spentVal == null && styles.tableCellDash,
            isTableClosedInserted && styles.tableTextClosedBlack,
          ]}
          numberOfLines={1}
        >
          {spentVal != null ? spentVal : dash}
        </Text>
      </View>
    </View>
  );

  const handleCloseAccount = async () => {
    if (!guardAttendanceGatedEntry(t)) return;
    if (submitting) return;
    if (accountClosingBlocked || !isCurrentDaySelectedForClose || isTableClosedInserted || isTodayClosedByDashboardStatus)
      return;
    showWarning(
      t('cashAccount.closeAccount'),
      t('cashAccount.closeAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.yes'),
          onPress: async () => {
            try {
              setSubmitting(true);
              const fromDate = formatDateForAPI(startDate);
              const toDate = formatDateForAPI(endDate);
              const closingDate = fromDate;

              let channelBreakdown = null;
              let closing_balance_by_account;
              let closing_balance_by_cash;
              let channelSource;

              if (todayDashboard != null) {
                channelBreakdown = todayDashboard.getCloseAccountChannelBreakdown();
                channelSource = 'GET /frontcash/dashboard/today (parsed Dashboard)';
                closing_balance_by_cash = roundMoney2(channelBreakdown.cash.net);
                closing_balance_by_account = roundMoney2(channelBreakdown.online.net);
              } else {
                channelSource = 'fallback: totalBalance × collection cash/online mix (today dashboard missing)';
                const c = Number(collectionPaymentSplit.cash) || 0;
                const o = Number(collectionPaymentSplit.online) || 0;
                const mix = c + o;
                const tbInt = Math.round(Number(totalBalance));
                if (mix > 0) {
                  const sp = splitBalanceIntoChannelInts(tbInt, c, o);
                  closing_balance_by_cash = sp.cashNet;
                  closing_balance_by_account = sp.onlineNet;
                } else {
                  const half = Math.trunc(tbInt / 2);
                  closing_balance_by_cash = half;
                  closing_balance_by_account = tbInt - half;
                }
              }

              console.log('[CloseAccount] ========== CLOSE ACCOUNT — channel breakdown ==========');
              console.log('[CloseAccount] closingDate (date):', closingDate);
              console.log('[CloseAccount] from_date / to_date:', fromDate, '/', toDate);
              console.log('[CloseAccount] channel calculation source:', channelSource);

              if (channelBreakdown) {
                const ch = channelBreakdown.cash;
                const on = channelBreakdown.online;
                console.log('[CloseAccount] —— Cash (closing_balance_by_cash): (front+collection+processing) − (expenses+loan) ——');
                console.log('[CloseAccount]   front + collection + processing =', ch.frontCash, '+', ch.collectionCash, '+', ch.processingCash, '=', ch.inflows);
                console.log('[CloseAccount]   expenses + loan =', ch.expense, '+', ch.loan, '=', ch.outflows);
                console.log('[CloseAccount]   net → closing_balance_by_cash:', ch.net, '→', closing_balance_by_cash);
                console.log('[CloseAccount] —— Account (closing_balance_by_account): same formula ——');
                console.log('[CloseAccount]   front + collection + processing =', on.frontOnline, '+', on.collectionOnline, '+', on.processingOnline, '=', on.inflows);
                console.log('[CloseAccount]   expenses + loan =', on.expense, '+', on.loan, '=', on.outflows);
                console.log('[CloseAccount]   net → closing_balance_by_account:', on.net, '→', closing_balance_by_account);
                console.log('[CloseAccount] expense allocation rule:', channelBreakdown.expenseAllocation);
                const netsSum = roundMoney2(ch.net + on.net);
                console.log('[CloseAccount] sanity: cash_net + online_net =', netsSum, '| table totalBalance =', roundMoney2(totalBalance));
              } else {
                console.warn('[CloseAccount] —— FALLBACK (no Dashboard) ——');
                console.log('[CloseAccount] collectionPaymentSplit:', JSON.stringify(collectionPaymentSplit));
                console.log('[CloseAccount] totalBalance:', roundMoney2(totalBalance));
                console.log('[CloseAccount] closing_balance_by_cash (estimated):', closing_balance_by_cash);
                console.log('[CloseAccount] closing_balance_by_account (estimated):', closing_balance_by_account);
              }

              const closePayload = {
                date: closingDate,
                closing_balance_by_account,
                closing_balance_by_cash,
              };

              console.log('[CloseAccount] —— POST body (date + channel balances only) ——');
              console.log(JSON.stringify(closePayload, null, 2));
              console.log('[CloseAccount] ========== end close payload ==========');

              const closeRes = await apiServices.upfrontCash.closeOpeningAccount(closePayload);
              const closeRow = closeRes?.data ?? closeRes;
              const insertedOk =
                closeRow?.inserted === true ||
                closeRow?.inserted === 1 ||
                closeRow?.inserted === '1' ||
                String(closeRow?.inserted).toLowerCase() === 'true';
              if (insertedOk) {
                const markDate = String(closeRow?.date ?? closingDate);
                await persistClosedInsertedDate(markDate);
                setClosedInsertedDates((prev) => ({ ...prev, [markDate]: true }));
                console.log('[CloseAccount] data.inserted true — marked closed for', markDate);
              }
              showSuccess(t('common.success'), t('cashAccount.closeAccountSuccess'));
              await fetchSummary();
              if (isCurrentDaySelectedForClose) {
                try {
                  const todayRes = await apiServices.dashboard.getTodayStats();
                  applyTodayDashboardResponse(todayRes);
                  console.log('[CloseAccount] Refreshed GET /frontcash/dashboard/today after close');
                } catch (e) {
                  console.warn('[CloseAccount] getTodayStats after close failed:', e);
                }
              }
            } catch (err) {
              showError(t('common.error'), getApiErrorMessage(err, t('errors.somethingWentWrong')));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Header
        title={t('cashAccount.title')}
        showBackButton
        onBackPress={() => safeGoBack(navigation)}
      />

      <View style={styles.filterSection}>
        <View style={styles.dateRow}>
          <View style={styles.datePickerContainer}>
            <DatePicker
              label={t('collection.startDate')}
              value={startDate}
              onValueChange={handleStartDateChange}
              error={errors.startDate}
              maximumDate={new Date()}
            />
          </View>

          <View style={styles.datePickerContainer}>
            <DatePicker
              label={t('collection.endDate')}
              value={endDate}
              onValueChange={handleEndDateChange}
              error={errors.endDate}
              minimumDate={startDate ? new Date(startDate) : undefined}
              maximumDate={new Date()}
            />
          </View>
        </View>

        {errors.dateRange && (
          <Text style={styles.errorText}>{errors.dateRange}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.contentScroll,
            { paddingBottom: (showCloseAccountButton ? 96 : 24) + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryHeader}>
            <Ionicons name="calculator-outline" size={20} color={COLORS.primary} />
            <Text style={styles.summaryTitle}>{t('cashAccount.todaySummary')}</Text>
            <Text style={styles.summaryDate}>{`${formatDateForAPI(startDate)} - ${formatDateForAPI(endDate)}`}</Text>
          </View>

          <View style={styles.tableFrame}>
            <View style={styles.tableGridHeadRow}>
              <View style={[styles.tableGridCell, styles.tableGridColParticulars, styles.tableGridHeadCell]}>
                <Text style={[styles.tableHeadCellText, isTableClosedInserted && styles.tableTextClosedBlack]}>
                  {t('cashAccount.particulars')}
                </Text>
              </View>
              <View
                style={[
                  styles.tableGridCell,
                  styles.tableGridColAmount,
                  styles.tableGridHeadCell,
                  styles.tableGridCellAmount,
                ]}
              >
                <Text style={[styles.tableHeadCellTextAmount, isTableClosedInserted && styles.tableTextClosedBlack]}>
                  {t('cashAccount.received')}
                </Text>
              </View>
              <View
                style={[
                  styles.tableGridCell,
                  styles.tableGridColAmount,
                  styles.tableGridHeadCell,
                  styles.tableGridCellAmount,
                  styles.tableGridCellLast,
                ]}
              >
                <Text style={[styles.tableHeadCellTextAmount, isTableClosedInserted && styles.tableTextClosedBlack]}>
                  {t('cashAccount.spent')}
                </Text>
              </View>
            </View>

            {/* {renderTableRow3(
              'upfrontByCash',
              t('cashAccount.upfrontByCash'),
              null,
              formatCurrency(String(upfrontByCash))
            )}
            {renderTableRow3(
              'upfrontByOnline',
              t('cashAccount.upfrontByOnline'),
              null,
              formatCurrency(String(upfrontByOnline))
            )} */}
            {renderTableRow3(
              'previousBalance',
              t('cashAccount.previousBalance'),
              null,
              formatCurrency(String(previousBalance))
            )}
            {renderTableRow3('collection', t('cashAccount.collection'), null, formatCurrency(String(collectionCompleted)))}
            {renderTableRow3(
              'magimai',
              t('cashAccount.magimai'),
              null,
              formatCurrency(String(processingFeeTotal))
            )}
            {renderTableRow3(
              'loanGiven',
              t('cashAccount.loanGiven'),
              formatCurrency(String(loanGiven)),
              null
            )}
            {renderTableRow3(
              'expenses',
              t('cashAccount.expenses'),
              formatCurrency(String(expenses)),
              null,
              styles.tableGridRowLastBeforeFooter,
              {
                labelNode: (
                  <View style={styles.particularsWithInfo}>
                    <Text
                      style={[
                        styles.tableCellParticularsText,
                        isTableClosedInserted && styles.tableTextClosedBlack,
                      ]}
                      numberOfLines={2}
                    >
                      {t('cashAccount.expenses')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setExpenseDetailsVisible(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={t('cashAccount.expenseDetails')}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={SIZES.body3}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  </View>
                ),
              }
            )}

            <View style={styles.tableSummaryFooter}>
              <View style={[styles.tableGridCell, styles.tableGridColParticulars, styles.closingCalcLabelCell]}>
                <Text
                  style={[
                    styles.tableClosingBalanceText,
                    isTableClosedInserted && styles.tableTextClosedBlack,
                  ]}
                  numberOfLines={2}
                >
                  {t('cashAccount.closingBalance')}
                </Text>
              </View>
              <View style={styles.closingCalcStack}>
                <Text
                  style={[styles.closingCalcAmount, isTableClosedInserted && styles.tableTextClosedBlack]}
                  numberOfLines={1}
                >
                  {formatCurrency(String(totalReceived))}
                </Text>
                <Text
                  style={[styles.closingCalcAmount, isTableClosedInserted && styles.tableTextClosedBlack]}
                  numberOfLines={1}
                >
                  {formatCurrency(String(totalSpent))}
                </Text>
                <View style={styles.closingCalcDoubleLine} />
                <Text
                  style={[
                    styles.closingCalcAmount,
                    styles.closingCalcResult,
                    isTableClosedInserted && styles.tableTextClosedBlack,
                  ]}
                  numberOfLines={1}
                >
                  {formatCurrency(String(totalBalance))}
                </Text>
                <View style={styles.closingCalcUnderline} />
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {showCloseAccountButton ? (
        <View style={[styles.bottomBar, { paddingBottom: SIZES.padding + insets.bottom }]}>
          <TouchableOpacity
            style={[styles.closeButton, (submitting || accountClosingBlocked) && styles.closeButtonDisabled]}
            onPress={handleCloseAccount}
            activeOpacity={0.85}
            disabled={submitting || accountClosingBlocked}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.white} />
            )}
            <Text style={styles.closeButtonText}>{t('cashAccount.closeAccount')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={expenseDetailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExpenseDetailsVisible(false)}
      >
        <View style={styles.expenseModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExpenseDetailsVisible(false)} />
          <View style={styles.expenseModalCard}>
            <View style={styles.expenseModalHeader}>
              <Text style={styles.expenseModalTitle}>{t('cashAccount.expenseDetails')}</Text>
              <TouchableOpacity
                onPress={() => setExpenseDetailsVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={22} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.expenseModalHeadRow}>
              <Text style={[styles.expenseModalHeadText, styles.expenseModalNameCol]}>
                {t('cashAccount.expenseCategory')}
              </Text>
              <Text style={[styles.expenseModalHeadText, styles.expenseModalAmountCol]}>
                {t('cashAccount.expenseAmount')}
              </Text>
            </View>
            {expenseDetailRows.length === 0 ? (
              <Text style={styles.expenseModalEmpty}>{t('cashAccount.noExpenseDetails')}</Text>
            ) : (
              <ScrollView style={styles.expenseModalList} showsVerticalScrollIndicator={false}>
                {expenseDetailRows.map((row) => (
                  <View key={row.id} style={styles.expenseModalRow}>
                    <Text style={[styles.expenseModalName, styles.expenseModalNameCol]} numberOfLines={3}>
                      {row.label}
                    </Text>
                    <Text style={[styles.expenseModalAmount, styles.expenseModalAmountCol]} numberOfLines={1}>
                      {formatCurrency(String(row.amount ?? 0))}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SIZES.padding * 2 },
  loadingText: { marginTop: SIZES.margin, color: COLORS.text.tertiary, fontSize: SIZES.body3 },
  contentScroll: {
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  filterSection: {
    padding: SIZES.padding,
    paddingBottom: 0,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.margin,
  },
  datePickerContainer: {
    flex: 1,
    marginHorizontal: SIZES.base / 2,
  },
  errorText: {
    fontSize: SIZES.body3,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SIZES.margin,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.base,
    paddingBottom: SIZES.margin,
  },
  summaryTitle: {
    marginLeft: SIZES.base,
    flex: 1,
    color: COLORS.text.primary,
    fontSize: SIZES.body3,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  summaryDate: {
    color: COLORS.text.secondary,
    fontSize: SIZES.body5,
    fontWeight: '700',
  },
  tableFrame: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  tableGridRowLastBeforeFooter: {
    borderBottomWidth: 0,
  },
  tableGridHeadRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableGridHeadCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  /** Horizontally center Spent / Received column content */
  tableGridCellAmount: {
    alignItems: 'center',
  },
  tableHeadCellText: {
    fontSize: SIZES.body3,
    fontWeight: '700',
    color: COLORS.black,
  },
  tableHeadCellTextAmount: {
    fontSize: SIZES.body3,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
    width: '100%',
  },
  tableGridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  tableGridCell: {
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  tableGridCellLast: {
    borderRightWidth: 0,
  },
  tableGridColParticulars: {
    flex: 1.35,
  },
  tableGridColAmount: {
    flex: 1,
  },
  tableCellParticularsText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.black,
  },
  particularsWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableGridDetailRow: {
    backgroundColor: '#F8F9FA',
  },
  tableCellParticularsDetailText: {
    fontWeight: '500',
    paddingLeft: 12,
    color: COLORS.text.secondary,
  },
  tableCellAmountText: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.black,
    textAlign: 'center',
    width: '100%',
  },
  tableSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingVertical: 10,
  },
  closingCalcLabelCell: {
    borderRightWidth: 0,
    alignSelf: 'stretch',
  },
  closingCalcStack: {
    flex: 2,
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingLeft: 8,
  },
  closingCalcAmount: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.black,
    textAlign: 'right',
    minWidth: 120,
  },
  closingCalcResult: {
    fontWeight: '800',
    paddingTop: 4,
  },
  closingCalcDoubleLine: {
    width: 120,
    marginTop: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.black,
    height: 4,
  },
  closingCalcUnderline: {
    width: 120,
    marginTop: 2,
    borderBottomWidth: 1,
    borderColor: COLORS.black,
  },
  tableClosingBalanceText: {
    fontSize: SIZES.body3,
    fontWeight: '700',
    color: COLORS.black,
  },
  tableSummaryFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tableSummaryFooterPad: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tableSummaryFooterLabel: {
    fontSize: SIZES.body3,
    fontWeight: '600',
    color: COLORS.black,
  },
  tableSummaryFooterValue: {
    fontSize: SIZES.body3,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
    width: '100%',
  },
  tableSummaryLabelEmph: {
    fontWeight: '800',
    color: COLORS.black,
  },
  tableSummaryValueEmph: {
    fontWeight: '800',
  },
  tableCellDash: {
    color: COLORS.black,
    fontWeight: '500',
  },
  tableTextClosedBlack: {
    color: COLORS.black,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SIZES.padding,
    backgroundColor: 'rgba(248, 249, 250, 0.96)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius * 1.5,
    paddingVertical: SIZES.padding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonDisabled: {
    opacity: 0.7,
  },
  closeButtonText: {
    marginLeft: 10,
    color: COLORS.white,
    fontSize: SIZES.body3,
    fontWeight: '800',
  },
  expenseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding,
  },
  expenseModalCard: {
    width: '100%',
    maxHeight: '72%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  expenseModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.base,
  },
  expenseModalTitle: {
    flex: 1,
    fontSize: SIZES.h4 || 18,
    fontWeight: '700',
    color: COLORS.black,
    marginRight: SIZES.base,
  },
  expenseModalHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  expenseModalHeadText: {
    fontSize: SIZES.body4,
    fontWeight: '700',
    color: COLORS.black,
  },
  expenseModalList: {
    maxHeight: 360,
  },
  expenseModalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  expenseModalNameCol: {
    flex: 1.4,
    paddingRight: 4,
  },
  expenseModalAmountCol: {
    flex: 1,
    textAlign: 'right',
  },
  expenseModalName: {
    fontSize: SIZES.body3,
    color: COLORS.black,
    fontWeight: '500',
  },
  expenseModalAmount: {
    fontSize: SIZES.body3,
    color: COLORS.black,
    fontWeight: '700',
  },
  expenseModalEmpty: {
    paddingVertical: SIZES.padding,
    textAlign: 'center',
    color: COLORS.text.tertiary,
    fontSize: SIZES.body3,
  },
});

export default CashAccountScreen;

