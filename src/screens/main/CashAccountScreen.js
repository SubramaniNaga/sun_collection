import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { apiServices } from "../../api/services/apiServices";
import DatePicker from "../../components/common/DatePicker";
import Header from "../../components/common/Header";
import { COLORS, SIZES } from "../../constants/theme";
// import Collection from "../../models/Collection";
import Dashboard from "../../models/Dashboard";
import { useLanguage } from "../../store/LanguageContext";
import {
  getApiErrorMessage,
  showError,
  showSuccess,
  showWarning,
} from "../../utils/alertService";
import { formatCurrency } from "../../utils/amountFormatters";
import { guardAttendanceGatedEntry } from "../../utils/attendanceEntryGate";
import {
  formatDateForAPI,
  getCalendarDateISO,
  getCurrentDateString,
} from "../../utils/dateFormatter";
import { safeGoBack } from "../../utils/navigationHelpers";

/** Normalize GET /frontcash/dashboard/today response for {@link Dashboard.fromApiResponse} */
function dashboardDataFromTodayApi(res) {
  if (!res || typeof res !== "object") return {};
  if (res.success && res.data && typeof res.data === "object") return res.data;
  if (res.data && typeof res.data === "object") {
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

/** YYYY-MM-DD keys after POST closeaccount returns `data.inserted === true` (one close per day). */
const CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY =
  "cash_account_closed_inserted_dates_v1";

async function loadClosedInsertedDatesMap() {
  try {
    const raw = await AsyncStorage.getItem(
      CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY,
    );
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
    const raw = await AsyncStorage.getItem(
      CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY,
    );
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    if (!list.includes(d)) {
      list.push(d);
      await AsyncStorage.setItem(
        CASH_ACCOUNT_CLOSED_INSERTED_DATES_KEY,
        JSON.stringify(list),
      );
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

/** Pick weekly_plan row by key; fall back to amounts.{key}. */
function planRowAmount(view, key, side = "credit") {
  const rows = view?.weekly_plan?.rows;
  if (Array.isArray(rows)) {
    const row = rows.find((r) => r?.key === key);
    if (row) {
      return {
        credit: Number(row.credit ?? 0) || 0,
        debit: Number(row.debit ?? 0) || 0,
        label: row.label != null ? String(row.label) : null,
      };
    }
  }
  const amt = Number(view?.amounts?.[key] ?? 0) || 0;
  if (side === "debit") {
    return { credit: 0, debit: amt, label: null };
  }
  return { credit: amt, debit: 0, label: null };
}

/**
 * Credit-side line (opening, collection, nip, magimai, aathayam):
 * always use credit; fall back to amounts / debit if API only filled those.
 */
function creditSideValue(view, key) {
  const row = planRowAmount(view, key, "credit");
  const fromAmounts = Number(view?.amounts?.[key] ?? 0) || 0;
  return (Number(row.credit) || 0) || fromAmounts || (Number(row.debit) || 0);
}

/**
 * Debit-side line (loan, expenses):
 * always use debit; fall back to amounts / credit if API only filled those.
 */
function debitSideValue(view, key) {
  const row = planRowAmount(view, key, "debit");
  const fromAmounts = Number(view?.amounts?.[key] ?? 0) || 0;
  return (Number(row.debit) || 0) || fromAmounts || (Number(row.credit) || 0);
}

/** Format amount for a table cell. */
function formatCellAmount(n) {
  return formatCurrency(String(Number(n) || 0));
}

const CashAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [startDate, setStartDate] = useState(getCalendarDateISO());
  const [endDate, setEndDate] = useState(getCalendarDateISO());
  /** GET /close-account-view `data` */
  const [closeAccountView, setCloseAccountView] = useState(null);
  /** Today's GET /frontcash/dashboard/today — channel split + closing_status for Close Account */
  const [todayDashboard, setTodayDashboard] = useState(null);
  const [collectionPaymentSplit, setCollectionPaymentSplit] = useState({
    cash: 0,
    online: 0,
  });
  /** YYYY-MM-DD → true when close account succeeded with `data.inserted` (persisted). */
  const [closedInsertedDates, setClosedInsertedDates] = useState({});
  const [expenseDetailsVisible, setExpenseDetailsVisible] = useState(false);

  const expenseDetailRows = useMemo(() => {
    const list = Array.isArray(closeAccountView?.expenses?.list)
      ? closeAccountView.expenses.list
      : [];
    return list.map((item, index) => ({
      id: item?.id != null ? String(item.id) : `expense-${index}`,
      label:
        String(item?.category_name || item?.title || "").trim() ||
        t("cashAccount.expenses"),
      amount: Number(item?.amount ?? 0) || 0,
    }));
  }, [closeAccountView, t]);

  const showExpensesRow = useMemo(() => {
    const exp = closeAccountView?.expenses;
    if (!exp) return false;
    const total = Number(exp.total ?? 0) || 0;
    const count = Number(exp.count ?? 0) || 0;
    const listLen = Array.isArray(exp.list) ? exp.list.length : 0;
    return total > 0 || count > 0 || listLen > 0;
  }, [closeAccountView]);

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
    }, []),
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
      newErrors.dateRange = t("validation.startDateGreater");
    }
    if (end > today) {
      newErrors.dateRange = t("validation.endDateBeyond");
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
      setCollectionPaymentSplit(dash.getCashPositionSplit());
    } catch (err) {
      console.warn("CashAccountScreen: applyTodayDashboardResponse", err);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!validateDates()) return;
    setLoading(true);
    try {
      const fromDate = formatDateForAPI(startDate);
      const toDate = formatDateForAPI(endDate);
      const todayStr = getCurrentDateString();
      const isTodayRange = fromDate === toDate && fromDate === todayStr;

      const [viewRes, todayDashRes] = await Promise.all([
        apiServices.upfrontCash.getCloseAccountView({
          from_date: fromDate,
          to_date: toDate,
        }),
        isTodayRange
          ? apiServices.dashboard.getTodayStats().catch((err) => {
              console.warn("CashAccountScreen: dashboard today:", err);
              return null;
            })
          : Promise.resolve(null),
      ]);

      const viewData =
        viewRes?.data && typeof viewRes.data === "object"
          ? viewRes.data
          : viewRes && typeof viewRes === "object" && viewRes.amounts
            ? viewRes
            : null;
      setCloseAccountView(viewData);

      if (isTodayRange && todayDashRes != null) {
        applyTodayDashboardResponse(todayDashRes);
      } else {
        setTodayDashboard(null);
        setCollectionPaymentSplit({ cash: 0, online: 0 });
      }
    } catch (err) {
      showError(
        t("common.error"),
        getApiErrorMessage(err, t("errors.somethingWentWrong")),
      );
      setCloseAccountView(null);
      setTodayDashboard(null);
      setCollectionPaymentSplit({ cash: 0, online: 0 });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, validateDates, applyTodayDashboardResponse, t]);

  useFocusEffect(
    useCallback(() => {
      fetchSummary();
    }, [fetchSummary]),
  );

  const openingBalance = creditSideValue(closeAccountView, "opening_balance");
  const collectionCompleted = creditSideValue(closeAccountView, "collection");
  const nipCollection = creditSideValue(closeAccountView, "nip_collection");
  const magimai = creditSideValue(closeAccountView, "magimai");
  const aathayam = creditSideValue(closeAccountView, "aathayam");
  const loanGiven = debitSideValue(closeAccountView, "loan");
  const expenses = debitSideValue(closeAccountView, "expenses");

  /** Credit (Varavu): opening + collection + nip + magimai + aathayam. */
  const totalReceived = useMemo(
    () =>
      openingBalance +
      collectionCompleted +
      nipCollection +
      magimai +
      aathayam,
    [
      openingBalance,
      collectionCompleted,
      nipCollection,
      magimai,
      aathayam,
    ],
  );

  /** Debit (Pattru): loan + expenses (when shown). */
  const totalSpent = useMemo(
    () => loanGiven + (showExpensesRow ? expenses : 0),
    [loanGiven, expenses, showExpensesRow],
  );

  /** Closing = Credit − Debit (may be negative; shown under Debit column). */
  const totalBalance = useMemo(
    () => totalReceived - totalSpent,
    [totalReceived, totalSpent],
  );

  /**
   * Close Account may run only on the **current calendar day**: both pickers must match today (YYYY-MM-DD).
   */
  const isCurrentDaySelectedForClose = useMemo(() => {
    const todayKey = getCurrentDateString();
    const fromKey = formatDateForAPI(startDate);
    const toKey = formatDateForAPI(endDate);
    return Boolean(
      fromKey && toKey && fromKey === todayKey && toKey === todayKey,
    );
  }, [startDate, endDate]);

  const accountClosingBlocked = false;

  const selectedDayKey = useMemo(
    () => formatDateForAPI(startDate),
    [startDate],
  );
  const selectedEndDayKey = useMemo(() => formatDateForAPI(endDate), [endDate]);

  const isTableClosedInserted = useMemo(
    () =>
      Boolean(selectedDayKey) &&
      selectedDayKey === selectedEndDayKey &&
      Boolean(closedInsertedDates[selectedDayKey]),
    [selectedDayKey, selectedEndDayKey, closedInsertedDates],
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

  const dash = "—";

  const renderTableRow3 = (
    key,
    label,
    spentVal,
    receivedVal,
    rowStyle,
    options = {},
  ) => (
    <View
      key={key}
      style={[
        styles.tableGridRow,
        options.detailRow && styles.tableGridDetailRow,
        rowStyle,
      ]}
    >
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
      <View
        style={[
          styles.tableGridCell,
          styles.tableGridColAmount,
          styles.tableGridCellAmount,
        ]}
      >
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
      <View
        style={[
          styles.tableGridCell,
          styles.tableGridColAmount,
          styles.tableGridCellAmount,
          styles.tableGridCellLast,
        ]}
      >
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
    if (
      accountClosingBlocked ||
      !isCurrentDaySelectedForClose ||
      isTableClosedInserted ||
      isTodayClosedByDashboardStatus
    )
      return;
    showWarning(
      t("cashAccount.closeAccount"),
      t("cashAccount.closeAccountConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.yes"),
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
                channelBreakdown =
                  todayDashboard.getCloseAccountChannelBreakdown();
                channelSource =
                  "GET /frontcash/dashboard/today (parsed Dashboard)";
                closing_balance_by_cash = roundMoney2(
                  channelBreakdown.cash.net,
                );
                closing_balance_by_account = roundMoney2(
                  channelBreakdown.online.net,
                );
              } else {
                channelSource =
                  "fallback: totalBalance × collection cash/online mix (today dashboard missing)";
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

              console.log(
                "[CloseAccount] ========== CLOSE ACCOUNT — channel breakdown ==========",
              );
              console.log("[CloseAccount] closingDate (date):", closingDate);
              console.log(
                "[CloseAccount] from_date / to_date:",
                fromDate,
                "/",
                toDate,
              );
              console.log(
                "[CloseAccount] channel calculation source:",
                channelSource,
              );

              if (channelBreakdown) {
                const ch = channelBreakdown.cash;
                const on = channelBreakdown.online;
                console.log(
                  "[CloseAccount] —— Cash (closing_balance_by_cash): (front+collection+processing) − (expenses+loan) ——",
                );
                console.log(
                  "[CloseAccount]   front + collection + processing =",
                  ch.frontCash,
                  "+",
                  ch.collectionCash,
                  "+",
                  ch.processingCash,
                  "=",
                  ch.inflows,
                );
                console.log(
                  "[CloseAccount]   expenses + loan =",
                  ch.expense,
                  "+",
                  ch.loan,
                  "=",
                  ch.outflows,
                );
                console.log(
                  "[CloseAccount]   net → closing_balance_by_cash:",
                  ch.net,
                  "→",
                  closing_balance_by_cash,
                );
                console.log(
                  "[CloseAccount] —— Account (closing_balance_by_account): same formula ——",
                );
                console.log(
                  "[CloseAccount]   front + collection + processing =",
                  on.frontOnline,
                  "+",
                  on.collectionOnline,
                  "+",
                  on.processingOnline,
                  "=",
                  on.inflows,
                );
                console.log(
                  "[CloseAccount]   expenses + loan =",
                  on.expense,
                  "+",
                  on.loan,
                  "=",
                  on.outflows,
                );
                console.log(
                  "[CloseAccount]   net → closing_balance_by_account:",
                  on.net,
                  "→",
                  closing_balance_by_account,
                );
                console.log(
                  "[CloseAccount] expense allocation rule:",
                  channelBreakdown.expenseAllocation,
                );
                const netsSum = roundMoney2(ch.net + on.net);
                console.log(
                  "[CloseAccount] sanity: cash_net + online_net =",
                  netsSum,
                  "| table totalBalance =",
                  roundMoney2(totalBalance),
                );
              } else {
                console.warn("[CloseAccount] —— FALLBACK (no Dashboard) ——");
                console.log(
                  "[CloseAccount] collectionPaymentSplit:",
                  JSON.stringify(collectionPaymentSplit),
                );
                console.log(
                  "[CloseAccount] totalBalance:",
                  roundMoney2(totalBalance),
                );
                console.log(
                  "[CloseAccount] closing_balance_by_cash (estimated):",
                  closing_balance_by_cash,
                );
                console.log(
                  "[CloseAccount] closing_balance_by_account (estimated):",
                  closing_balance_by_account,
                );
              }

              const closePayload = {
                date: closingDate,
                closing_balance_by_account,
                closing_balance_by_cash,
              };

              console.log(
                "[CloseAccount] —— POST body (date + channel balances only) ——",
              );
              console.log(JSON.stringify(closePayload, null, 2));
              console.log(
                "[CloseAccount] ========== end close payload ==========",
              );

              const closeRes =
                await apiServices.upfrontCash.closeOpeningAccount(closePayload);
              const closeRow = closeRes?.data ?? closeRes;
              const insertedOk =
                closeRow?.inserted === true ||
                closeRow?.inserted === 1 ||
                closeRow?.inserted === "1" ||
                String(closeRow?.inserted).toLowerCase() === "true";
              if (insertedOk) {
                const markDate = String(closeRow?.date ?? closingDate);
                await persistClosedInsertedDate(markDate);
                setClosedInsertedDates((prev) => ({
                  ...prev,
                  [markDate]: true,
                }));
                console.log(
                  "[CloseAccount] data.inserted true — marked closed for",
                  markDate,
                );
              }
              showSuccess(
                t("common.success"),
                t("cashAccount.closeAccountSuccess"),
              );
              await fetchSummary();
              if (isCurrentDaySelectedForClose) {
                try {
                  const todayRes = await apiServices.dashboard.getTodayStats();
                  applyTodayDashboardResponse(todayRes);
                  console.log(
                    "[CloseAccount] Refreshed GET /frontcash/dashboard/today after close",
                  );
                } catch (e) {
                  console.warn(
                    "[CloseAccount] getTodayStats after close failed:",
                    e,
                  );
                }
              }
            } catch (err) {
              showError(
                t("common.error"),
                getApiErrorMessage(err, t("errors.somethingWentWrong")),
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <Header
        title={t("cashAccount.title")}
        showBackButton
        onBackPress={() => safeGoBack(navigation)}
      />

      <View style={styles.filterSection}>
        <View style={styles.dateRow}>
          <View style={styles.datePickerContainer}>
            <DatePicker
              label={t("collection.startDate")}
              value={startDate}
              onValueChange={handleStartDateChange}
              error={errors.startDate}
              maximumDate={new Date()}
            />
          </View>

          <View style={styles.datePickerContainer}>
            <DatePicker
              label={t("collection.endDate")}
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
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentBody}
          contentContainerStyle={{
            paddingBottom: showCloseAccountButton
              ? 96 + insets.bottom
              : SIZES.padding + insets.bottom,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statementCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIconWrap}>
              <Ionicons
                name="calculator-outline"
                size={16}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.summaryTitle}>
              {t("cashAccount.todaySummary")}
            </Text>
            <Text style={styles.summaryDate} numberOfLines={1}>
              {`${formatDateForAPI(startDate)} - ${formatDateForAPI(endDate)}`}
            </Text>
          </View>

          <View style={styles.tableFrame}>
            <View style={styles.tableGridHeadRow}>
              <View
                style={[
                  styles.tableGridCell,
                  styles.tableGridColParticulars,
                  styles.tableGridHeadCell,
                ]}
              >
                <Text
                  style={[
                    styles.tableHeadCellText,
                    isTableClosedInserted && styles.tableTextClosedBlack,
                  ]}
                >
                  {t("cashAccount.particulars")}
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
                <Text
                  style={[
                    styles.tableHeadCellTextAmount,
                    isTableClosedInserted && styles.tableTextClosedBlack,
                  ]}
                >
                  {t("cashAccount.received")}
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
                <Text
                  style={[
                    styles.tableHeadCellTextAmount,
                    isTableClosedInserted && styles.tableTextClosedBlack,
                  ]}
                >
                  {t("cashAccount.spent")}
                </Text>
              </View>
            </View>

            {renderTableRow3(
              "previousBalance",
              t("cashAccount.previousBalance"),
              null,
              formatCellAmount(openingBalance),
            )}
            {renderTableRow3(
              "collection",
              t("cashAccount.collection"),
              null,
              formatCellAmount(collectionCompleted),
            )}
            {renderTableRow3(
              "nipCollection",
              t("cashAccount.nipCollection"),
              null,
              formatCellAmount(nipCollection),
            )}
            {renderTableRow3(
              "magimai",
              t("cashAccount.magimai"),
              null,
              formatCellAmount(magimai),
            )}
            {renderTableRow3(
              "aathayam",
              t("cashAccount.aathayam"),
              null,
              formatCellAmount(aathayam),
            )}
            {renderTableRow3(
              "loanGiven",
              t("cashAccount.loanGiven"),
              formatCellAmount(loanGiven),
              null,
              showExpensesRow ? undefined : styles.tableGridRowLastBeforeFooter,
            )}
            {showExpensesRow
              ? renderTableRow3(
                  "expenses",
                  t("cashAccount.expenses"),
                  formatCellAmount(expenses),
                  null,
                  styles.tableGridRowLastBeforeFooter,
                  {
                    labelNode: (
                      <View style={styles.particularsWithInfo}>
                        <Text
                          style={[
                            styles.tableCellParticularsText,
                            isTableClosedInserted &&
                              styles.tableTextClosedBlack,
                          ]}
                          numberOfLines={2}
                        >
                          {t("cashAccount.expenses")}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setExpenseDetailsVisible(true)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={t("cashAccount.expenseDetails")}
                        >
                          <Ionicons
                            name="information-circle-outline"
                            size={SIZES.body3}
                            color={COLORS.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    ),
                  },
                )
              : null}

            <View style={styles.totalsRow}>
              <View
                style={[styles.tableGridCell, styles.tableGridColParticulars]}
              />
              <View
                style={[
                  styles.tableGridCell,
                  styles.tableGridColAmount,
                  styles.tableGridCellAmount,
                ]}
              >
                <Text
                  style={[
                    styles.tableTotalsText,
                    isTableClosedInserted && styles.tableTextClosedBlack,
                  ]}
                  numberOfLines={1}
                >
                  {formatCurrency(String(totalReceived))}
                </Text>
              </View>
              <View
                style={[
                  styles.tableGridCell,
                  styles.tableGridColAmount,
                  styles.tableGridCellAmount,
                  styles.tableGridCellLast,
                ]}
              >
                <Text
                  style={[
                    styles.tableTotalsText,
                    isTableClosedInserted && styles.tableTextClosedBlack,
                  ]}
                  numberOfLines={1}
                >
                  {formatCurrency(String(totalSpent))}
                </Text>
              </View>
            </View>

            <View style={styles.closingRow}>
              <Text
                style={[
                  styles.tableClosingBalanceText,
                  isTableClosedInserted && styles.tableTextClosedBlack,
                ]}
                numberOfLines={2}
              >
                {t("cashAccount.closingBalance")}
              </Text>
              <Text
                style={[
                  styles.closingValue,
                  totalBalance < 0 && styles.closingValueNegative,
                  totalBalance > 0 && styles.closingValuePositive,
                  isTableClosedInserted && styles.tableTextClosedBlack,
                ]}
                numberOfLines={1}
              >
                {formatCurrency(String(totalBalance))}
              </Text>
            </View>
          </View>
          </View>
        </ScrollView>
      )}

      {showCloseAccountButton ? (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: SIZES.padding + insets.bottom },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.closeButton,
              (submitting || accountClosingBlocked) &&
                styles.closeButtonDisabled,
            ]}
            onPress={handleCloseAccount}
            activeOpacity={0.85}
            disabled={submitting || accountClosingBlocked}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={COLORS.white}
              />
            )}
            <Text style={styles.closeButtonText}>
              {t("cashAccount.closeAccount")}
            </Text>
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
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setExpenseDetailsVisible(false)}
          />
          <View style={styles.expenseModalCard}>
            <View style={styles.expenseModalHeader}>
              <Text style={styles.expenseModalTitle}>
                {t("cashAccount.expenseDetails")}
              </Text>
              <TouchableOpacity
                onPress={() => setExpenseDetailsVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={COLORS.text.secondary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.expenseModalHeadRow}>
              <Text
                style={[
                  styles.expenseModalHeadText,
                  styles.expenseModalNameCol,
                ]}
              >
                {t("cashAccount.expenseCategory")}
              </Text>
              <Text
                style={[
                  styles.expenseModalHeadText,
                  styles.expenseModalAmountCol,
                ]}
              >
                {t("cashAccount.expenseAmount")}
              </Text>
            </View>
            {expenseDetailRows.length === 0 ? (
              <Text style={styles.expenseModalEmpty}>
                {t("cashAccount.noExpenseDetails")}
              </Text>
            ) : (
              <ScrollView
                style={styles.expenseModalList}
                showsVerticalScrollIndicator={false}
              >
                {expenseDetailRows.map((row) => (
                  <View key={row.id} style={styles.expenseModalRow}>
                    <Text
                      style={[
                        styles.expenseModalName,
                        styles.expenseModalNameCol,
                      ]}
                      numberOfLines={3}
                    >
                      {row.label}
                    </Text>
                    <Text
                      style={[
                        styles.expenseModalAmount,
                        styles.expenseModalAmountCol,
                      ]}
                      numberOfLines={1}
                    >
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
  container: { flex: 1, backgroundColor: "#F4F6F9" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SIZES.padding * 2,
  },
  loadingText: {
    marginTop: SIZES.margin,
    color: COLORS.text.tertiary,
    fontSize: SIZES.body3,
  },
  contentBody: {
    flex: 1,
  },
  filterSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6EBF2",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SIZES.margin,
  },
  datePickerContainer: {
    flex: 1,
    marginHorizontal: SIZES.base / 2,
  },
  errorText: {
    fontSize: SIZES.body3,
    color: COLORS.error,
    textAlign: "center",
    marginBottom: SIZES.margin,
  },
  statementCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6EBF2",
    overflow: "hidden",
    shadowColor: "#1d3a5f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6EBF2",
    backgroundColor: COLORS.white,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F3FC",
  },
  summaryTitle: {
    marginLeft: 8,
    flex: 1,
    color: COLORS.text.primary,
    fontSize: SIZES.body3,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  summaryDate: {
    color: COLORS.text.secondary,
    fontSize: SIZES.body4,
    fontWeight: "600",
    marginLeft: 8,
  },
  tableFrame: {
    backgroundColor: COLORS.white,
  },
  tableGridRowLastBeforeFooter: {
    borderBottomWidth: 0,
  },
  tableGridHeadRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#EAF3FC",
    borderBottomWidth: 1,
    borderBottomColor: "#D5E6F6",
  },
  tableGridHeadCell: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#D5E6F6",
  },
  /** Horizontally center Spent / Received column content */
  tableGridCellAmount: {
    alignItems: "center",
  },
  tableHeadCellText: {
    fontSize: SIZES.body4,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  tableHeadCellTextAmount: {
    fontSize: SIZES.body4,
    fontWeight: "700",
    color: COLORS.primary,
    textAlign: "center",
    width: "100%",
    letterSpacing: 0.2,
  },
  tableGridRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEF1F4",
  },
  tableGridCell: {
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#EEF1F4",
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
    fontWeight: "600",
    color: COLORS.black,
  },
  particularsWithInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tableGridDetailRow: {
    backgroundColor: "#F8F9FA",
  },
  tableCellParticularsDetailText: {
    fontWeight: "500",
    paddingLeft: 12,
    color: COLORS.text.secondary,
  },
  tableCellAmountText: {
    fontSize: SIZES.body3,
    fontWeight: "600",
    color: COLORS.black,
    textAlign: "center",
    width: "100%",
  },
  tableSummaryFooter: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingTop: 14,
    paddingBottom: 12,
  },
  closingSubtotals: {
    alignItems: "flex-end",
    paddingRight: 12,
    paddingLeft: 8,
  },
  closingCalcLabelCell: {
    justifyContent: "center",
    paddingLeft: 10,
    paddingRight: 8,
  },
  closingResultRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  closingResultAmount: {
    flex: 2,
    alignItems: "flex-end",
    paddingRight: 12,
  },
  closingCalcAmount: {
    fontSize: SIZES.body3,
    fontWeight: "600",
    color: COLORS.black,
    textAlign: "right",
    minWidth: 120,
    lineHeight: 20,
  },
  closingCalcSpent: {
    marginTop: 8,
  },
  closingCalcResult: {
    fontWeight: "800",
  },
  closingCalcUnderline: {
    width: 120,
    marginTop: 8,
    borderBottomWidth: 1,
    borderColor: COLORS.black,
  },
  closingCalcUnderlineStrong: {
    width: 120,
    marginTop: 6,
    borderBottomWidth: 1,
    borderColor: COLORS.black,
  },
  tableClosingBalanceText: {
    flex: 1,
    marginRight: 8,
    fontSize: SIZES.body3,
    fontWeight: "700",
    color: COLORS.black,
  },
  tableSummaryFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  tableSummaryFooterPad: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  tableSummaryFooterLabel: {
    fontSize: SIZES.body3,
    fontWeight: "600",
    color: COLORS.black,
  },
  tableSummaryFooterValue: {
    fontSize: SIZES.body3,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
    width: "100%",
  },
  tableSummaryLabelEmph: {
    fontWeight: "800",
    color: COLORS.black,
  },
  tableSummaryValueEmph: {
    fontWeight: "800",
  },
  tableCellDash: {
    color: "#B0B7C3",
    fontWeight: "500",
  },
  totalsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#F7F9FC",
    borderTopWidth: 1,
    borderTopColor: "#E6EBF2",
  },
  tableTotalsText: {
    fontSize: SIZES.body3,
    fontWeight: "800",
    color: COLORS.black,
    textAlign: "center",
    width: "100%",
  },
  closingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#EAF3FC",
    borderTopWidth: 1,
    borderTopColor: "#D5E6F6",
    gap: 12,
  },
  closingValue: {
    fontSize: SIZES.body2,
    fontWeight: "800",
    color: COLORS.black,
    textAlign: "right",
  },
  closingValueNegative: {
    color: "#E53935",
  },
  closingValuePositive: {
    color: COLORS.success,
  },
  tableTextClosedBlack: {
    color: COLORS.black,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: SIZES.padding,
    backgroundColor: "rgba(248, 249, 250, 0.96)",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius * 1.5,
    paddingVertical: SIZES.padding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonDisabled: {
    opacity: 0.7,
  },
  closeButtonText: {
    marginLeft: 10,
    color: COLORS.white,
    fontSize: SIZES.body3,
    fontWeight: "800",
  },
  expenseModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: SIZES.padding,
  },
  expenseModalCard: {
    width: "100%",
    maxHeight: "72%",
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 1.5,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  expenseModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SIZES.base,
  },
  expenseModalTitle: {
    flex: 1,
    fontSize: SIZES.h4 || 18,
    fontWeight: "700",
    color: COLORS.black,
    marginRight: SIZES.base,
  },
  expenseModalHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  expenseModalHeadText: {
    fontSize: SIZES.body4,
    fontWeight: "700",
    color: COLORS.black,
  },
  expenseModalList: {
    maxHeight: 360,
  },
  expenseModalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    textAlign: "right",
  },
  expenseModalName: {
    fontSize: SIZES.body3,
    color: COLORS.black,
    fontWeight: "500",
  },
  expenseModalAmount: {
    fontSize: SIZES.body3,
    color: COLORS.black,
    fontWeight: "700",
  },
  expenseModalEmpty: {
    paddingVertical: SIZES.padding,
    textAlign: "center",
    color: COLORS.text.tertiary,
    fontSize: SIZES.body3,
  },
});

export default CashAccountScreen;
