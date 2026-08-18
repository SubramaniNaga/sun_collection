import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiServices } from "../../api/services/apiServices";
import { COLORS, SIZES } from "../../constants/theme";
import { useLanguage } from "../../store/LanguageContext";
import { getApiErrorMessage, showError } from "../../utils/alertService";
import { formatCurrency } from "../../utils/amountFormatters";
import { formatDisplayDate } from "../../utils/dateFormatter";

/** Shown columns: week, due date, payment date, amount paid, balance, type */
const COLLECTION_KEYS = [
  "collection_week",
  "collection_date",
  "payment_date",
  "amount_paid",
  "balance_amount",
  "payment_type",
];

/** Same width for header + body so columns line up; text centered under each header */
const COLUMN_WIDTH = 102;

const formatCollectionCell = (key, val, t) => {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "amount_paid" || key === "balance_amount") {
    const n = Number(val);
    return Number.isNaN(n) ? String(val) : formatCurrency(val);
  }
  if (
    typeof val === "string" &&
    (/_date|_at$|_time$/i.test(key) || key === "payment_time") &&
    !Number.isNaN(Date.parse(val))
  ) {
    return formatDisplayDate(val);
  }
  if (typeof val === "boolean") return val ? t("common.yes") : t("common.no");
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  return String(val);
};

const LoanCollectionsModal = ({ visible, loanId, onClose }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const sheetHeight = windowH * 0.75;
  const tableMaxHeight = Math.max(160, sheetHeight - 130);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    if (loanId == null || loanId === "") {
      setError(t("loan.loanDetailsMissingId"));
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiServices.loan.getLoanDetails(loanId);
      const list = response?.data?.collections ?? response?.collections ?? [];
      const sorted = Array.isArray(list)
        ? [...list].sort((a, b) => {
            const wa = Number(a?.collection_week) || 0;
            const wb = Number(b?.collection_week) || 0;
            if (wa !== wb) return wa - wb;
            const ta = a?.collection_date ? Date.parse(a.collection_date) : 0;
            const tb = b?.collection_date ? Date.parse(b.collection_date) : 0;
            return ta - tb;
          })
        : [];
      setRows(sorted);
    } catch (err) {
      if (__DEV__) console.warn("Loan collections modal load error:", err);
      showError(
        t("common.error"),
        getApiErrorMessage(err, t("loan.loanDetailsLoadError")),
      );
      setError(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loanId, t]);

  useEffect(() => {
    if (visible && loanId != null && loanId !== "") {
      load();
    } else if (!visible) {
      setRows([]);
      setError(null);
    }
  }, [visible, loanId, load]);

  const headerLabels = useMemo(
    () =>
      COLLECTION_KEYS.map((key) => {
        const label = t(`loan.collectionCols.${key}`);
        return typeof label === "string" ? label : key;
      }),
    [t],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
        />
        <View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: Math.max(insets.bottom, SIZES.base),
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {t("loan.collectionsModalTitle")}
            </Text>
            {/* <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity> */}
          </View>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.hint}>{t("loan.loadingCollections")}</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.centerBlock}>
              <Text style={styles.hint}>{t("collection.noCollections")}</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              style={styles.hScroll}
              contentContainerStyle={styles.hScrollContent}
              bounces={false}
            >
              <View style={styles.tableWrap}>
                <View style={styles.tableHeaderRow}>
                  {headerLabels.map((label, i) => (
                    <View
                      key={COLLECTION_KEYS[i]}
                      style={[
                        styles.headerCellWrap,
                        { width: COLUMN_WIDTH },
                        i === headerLabels.length - 1 && styles.tableCellLast,
                      ]}
                    >
                      <Text style={styles.headerCell} numberOfLines={2}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={[styles.vScroll, { maxHeight: tableMaxHeight }]}
                >
                  {rows.map((row, ri) => (
                    <View
                      key={row?.id != null ? `c-${row.id}` : `r-${ri}`}
                      style={[
                        styles.dataRow,
                        ri % 2 === 1 && styles.dataRowAlt,
                      ]}
                    >
                      {COLLECTION_KEYS.map((key, ki) => (
                        <View
                          key={key}
                          style={[
                            styles.dataCellWrap,
                            { width: COLUMN_WIDTH },
                            ki === COLLECTION_KEYS.length - 1 &&
                              styles.tableCellLast,
                          ]}
                        >
                          <Text
                            style={styles.dataCell}
                            numberOfLines={4}
                            selectable
                          >
                            {formatCollectionCell(key, row?.[key], t)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radius * 1.5,
    borderTopRightRadius: SIZES.radius * 1.5,
    overflow: "hidden",
    width: "100%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: SIZES.base * 0.75,
    marginBottom: SIZES.base * 0.5,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    flex: 1,
    fontSize: SIZES.h4 || 18,
    fontWeight: "700",
    color: COLORS.primary,
    marginRight: SIZES.base,
  },
  closeBtn: {
    padding: SIZES.base * 0.25,
  },
  closeBtnText: {
    fontSize: 22,
    color: COLORS.text?.secondary || "#333",
    fontWeight: "600",
  },
  centerBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SIZES.padding,
  },
  hint: {
    marginTop: SIZES.base,
    fontSize: SIZES.body3,
    color: COLORS.text?.tertiary || "#666",
    textAlign: "center",
  },
  errorText: {
    fontSize: SIZES.body2,
    color: COLORS.error,
    textAlign: "center",
  },
  hScroll: {
    flexGrow: 1,
  },
  hScrollContent: {
    paddingBottom: SIZES.base,
    flexGrow: 1,
  },
  tableWrap: {
    flexDirection: "column",
  },
  vScroll: {},
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "rgba(29, 126, 226, 0.12)",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCellWrap: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SIZES.base * 0.75,
    paddingHorizontal: SIZES.base * 0.5,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
  },
  headerCell: {
    width: "100%",
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    textAlign: "center",
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dataRowAlt: {
    backgroundColor: COLORS.lightGray || "#f5f5f5",
  },
  dataCellWrap: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SIZES.base * 0.65,
    paddingHorizontal: SIZES.base * 0.5,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
  },
  dataCell: {
    width: "100%",
    fontSize: 11,
    color: COLORS.text?.secondary || "#333",
    textAlign: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
});

export default LoanCollectionsModal;
