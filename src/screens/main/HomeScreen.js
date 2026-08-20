import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import apiServices from "../../api/services/apiServices";
import AppUpdateBottomSheet from "../../components/common/AppUpdateBottomSheet";
import Header from "../../components/common/Header";
import {
  ATTENDANCE,
  applyAppBlockFromResponse,
  applyAttendanceFromResponse,
  isAttendanceCheckedIn,
  isAttendanceClosed,
  setLocalAttendanceClosed,
  setLocalCheckInState,
} from "../../config/appToggles";
import { COLORS, SIZES } from "../../constants/theme";
import { useAppVersionCheck } from "../../hooks/useAppVersionCheck";
import Dashboard from "../../models/Dashboard";
import NIPLoan from "../../models/NIPLoan";
import { useAuthContext } from "../../store/AuthContext";
import { useLanguage } from "../../store/LanguageContext";
import {
  getApiErrorMessage,
  showAlert,
  showError,
} from "../../utils/alertService";
import { formatCurrency } from "../../utils/amountFormatters";
import { getServerDateTimeISO } from "../../utils/dateFormatter";
import ErrorHandler from "../../utils/errorHandler";
import { compressImageAssetIfNeeded } from "../../utils/imageCompression";
import { syncLocationTracking } from "../../utils/locationTracker";
import { syncUserLanguageWithApi } from "../../utils/syncUserLanguageWithApi";

const LANG_SWITCH_W = 58;
const LANG_SWITCH_H = 30;
const LANG_THUMB = 26;
const LANG_PAD = 2;
const LANG_THUMB_TRAVEL = LANG_SWITCH_W - LANG_THUMB - LANG_PAD * 2;

/** Normalize GET /frontcash/dashboard/today response for Dashboard.fromApiResponse */
function dashboardDataFromTodayApi(res) {
  if (!res || typeof res !== "object") return {};
  if (res.success && res.data && typeof res.data === "object") return res.data;
  if (res.data && typeof res.data === "object") {
    const d = res.data;
    if (
      d.expenses != null ||
      d.collections != null ||
      d.frontcash != null ||
      d.loans_given != null
    ) {
      return d;
    }
  }
  if (
    res.expenses != null ||
    res.collections != null ||
    res.frontcash != null ||
    res.loans_given != null
  ) {
    return res;
  }
  return {};
}

const formatRupee = (value) => formatCurrency(value);

const HomeScreen = ({ navigation }) => {
  const { t, language, changeLanguage } = useLanguage();
  const { user, updateUser } = useAuthContext();
  const { runCheck, updatePayload, clearUpdate } = useAppVersionCheck();
  const [langSaving, setLangSaving] = useState(false);
  const [showAttendance, setShowAttendance] = useState(
    ATTENDANCE.allow_attendance === 1,
  );
  const [attendanceStatus, setAttendanceStatus] = useState(
    isAttendanceCheckedIn() ? "present" : "absent",
  );
  const [attendanceClosed, setAttendanceClosed] =
    useState(isAttendanceClosed());
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const isAttendanceBusy = fetchingLocation || attendanceSaving;
  const slideAnim = useRef(
    new Animated.Value(language === "ta" ? LANG_THUMB_TRAVEL : 0),
  ).current;
  const attendanceSlideAnim = useRef(
    new Animated.Value(isAttendanceCheckedIn() ? LANG_THUMB_TRAVEL : 0),
  ).current; // A left, P right
  const delayPulseAnim = useRef(new Animated.Value(1)).current;
  const delayShimmerAnim = useRef(new Animated.Value(0)).current;
  const delayRing1Anim = useRef(new Animated.Value(0)).current;
  const delayRing2Anim = useRef(new Animated.Value(0)).current;
  const delayGlowAnim = useRef(new Animated.Value(0)).current;
  const attendanceRetryRef = useRef(null); // last attempt payload for retry (no re-capture)

  const syncAttendanceUiFromConfig = useCallback(() => {
    const nextShow = ATTENDANCE.allow_attendance === 1;
    const nextClosed = isAttendanceClosed();
    const uiStatus = isAttendanceCheckedIn() ? "present" : "absent";
    setShowAttendance((prev) => (prev === nextShow ? prev : nextShow));
    setAttendanceClosed((prev) => (prev === nextClosed ? prev : nextClosed));
    setAttendanceStatus((prev) => {
      if (prev === uiStatus) return prev;
      attendanceSlideAnim.setValue(
        uiStatus === "present" ? LANG_THUMB_TRAVEL : 0,
      );
      return uiStatus;
    });
  }, [attendanceSlideAnim]);

  const ensureLocationTracking = useCallback(() => {
    syncLocationTracking().catch((e) => {
      console.warn("[Home] location sync failed:", e?.message || e);
    });
  }, []);

  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dashboardAlertShownRef = useRef(false);

  const [collectionSummary, setCollectionSummary] = useState({
    totalBalance: 0,
    count: 0,
  });
  const [nipSummary, setNipSummary] = useState({ totalBalance: 0, count: 0 });
  const loadHomeDataRef = useRef(null);
  const syncAttendanceUiRef = useRef(syncAttendanceUiFromConfig);
  syncAttendanceUiRef.current = syncAttendanceUiFromConfig;
  const ensureLocationTrackingRef = useRef(ensureLocationTracking);
  ensureLocationTrackingRef.current = ensureLocationTracking;

  const showDashboardLoadError = useCallback(
    (error) => {
      if (error && ErrorHandler.isAuthError(error)) {
        return;
      }
      if (dashboardAlertShownRef.current) {
        return;
      }
      dashboardAlertShownRef.current = true;
      showError(
        t("common.error"),
        getApiErrorMessage(error, t("home.failedToLoadDashboard")),
        [
          {
            text: t("common.retry"),
            onPress: () => {
              dashboardAlertShownRef.current = false;
              loadHomeDataRef.current?.();
            },
          },
          { text: t("common.ok") },
        ],
      );
    },
    [t],
  );

  const showDashboardLoadErrorRef = useRef(showDashboardLoadError);
  showDashboardLoadErrorRef.current = showDashboardLoadError;

  const loadHomeData = useCallback(async (options = {}) => {
    const skipPageLoader = Boolean(options.skipPageLoader);
    if (!skipPageLoader) setLoadingDashboard(true);

    let dashboardFetchError = null;
    const dashPromise = apiServices.dashboard
      .getTodayStats({ skipGlobalLoader: true })
      .catch((err) => {
        dashboardFetchError = err;
        return null;
      });

    const summaryPromise = Promise.all([
      Promise.resolve(null),
      apiServices.loan.getNIPList({ page: 1, limit: 500 }).catch(() => null),
    ]);

    try {
      const [res, [colRes, nipRes]] = await Promise.all([
        dashPromise,
        summaryPromise,
      ]);

      if (res != null) {
        applyAppBlockFromResponse(res);
        applyAttendanceFromResponse(res);
        syncAttendanceUiRef.current?.();
        ensureLocationTrackingRef.current?.();

        const raw = dashboardDataFromTodayApi(res);
        if (Object.keys(raw).length > 0) {
          setDashboardData(Dashboard.fromApiResponse(raw));
          dashboardAlertShownRef.current = false;

          // Store loan_period from dashboard so CustomerWithLoanScreen can use it
          const dashLoanPeriod =
            raw.loan_period ?? res?.data?.loan_period ?? res?.loan_period;
          if (dashLoanPeriod != null && dashLoanPeriod !== "") {
            AsyncStorage.setItem("loanPeriod", String(dashLoanPeriod)).catch(
              () => {},
            );
          }
        } else {
          setDashboardData(null);
          showDashboardLoadErrorRef.current?.(dashboardFetchError);
        }
      } else {
        setDashboardData(null);
        showDashboardLoadErrorRef.current?.(dashboardFetchError);
      }

      if (nipRes) {
        const nipRaw = Array.isArray(nipRes?.data) ? nipRes.data : [];
        const nips = NIPLoan.fromApiResponseArray(nipRaw);
        const totalNipBalance = nips.reduce(
          (sum, n) => sum + (parseFloat(n.balanceAmount) || 0),
          0,
        );
        setNipSummary({ totalBalance: totalNipBalance, count: nips.length });
      } else {
        setNipSummary({ totalBalance: 0, count: 0 });
      }
    } finally {
      if (!skipPageLoader) setLoadingDashboard(false);
    }
  }, []);

  loadHomeDataRef.current = loadHomeData;

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadHomeData({ skipPageLoader: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadHomeData, refreshing]);

  const LOCATION_API_KEY = "adc5cbe3db4e4586be5b77d0e7b7f025";

  const getAddress = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${LOCATION_API_KEY}`,
      );

      const data = await response.json();

      console.log("OpenCage Response:", JSON.stringify(data, null, 2));

      if (data.results && data.results.length > 0) {
        return data.results[0].formatted;
      }

      return "";
    } catch (error) {
      console.log("Reverse Geocode Error:", error);
      return "";
    }
  };

  const submitAttendancePayload = async (
    payload,
    { manageSaving = true } = {},
  ) => {
    if (manageSaving) {
      setAttendanceSaving(true);
    }
    try {
      const formData = new FormData();
      formData.append("user_id", String(payload.userId ?? ""));
      formData.append("status", payload.status);
      formData.append("time", getServerDateTimeISO());
      formData.append("latitude", String(payload.latitude));
      formData.append("longitude", String(payload.longitude));
      formData.append("address", payload.address || "");
      if (payload.imageUri) {
        formData.append("image", {
          uri: payload.imageUri,
          name: "attendance_image.jpg",
          type: "image/jpeg",
        });
      }

      const res = await apiServices.attendance.markPresent(formData);
      console.log("[Attendance] API response:", JSON.stringify(res, null, 2));
      applyAttendanceFromResponse(res);
      attendanceRetryRef.current = null;

      const isCheckIn = payload.status === "present";
      if (isCheckIn) {
        setLocalCheckInState(true);
        setAttendanceClosed(false);
        setAttendanceStatus("present");
      } else {
        setLocalAttendanceClosed();
        setAttendanceClosed(true);
        setAttendanceStatus("absent");
      }
      Animated.spring(attendanceSlideAnim, {
        toValue: isCheckIn ? LANG_THUMB_TRAVEL : 0,
        useNativeDriver: true,
        friction: 9,
        tension: 80,
      }).start();

      // FS runs while checked in; stops on checkout.
      ensureLocationTracking();

      showAlert({
        type: "success",
        title: t("common.success"),
        message: isCheckIn
          ? t("home.attendanceMarked")
          : t("home.attendanceCheckedOut"),
      });
    } catch (error) {
      console.warn("[Attendance Error]", error);
      attendanceRetryRef.current = payload;
      showAlert({
        type: "error",
        title: t("common.error"),
        message: getApiErrorMessage(error, t("home.attendanceFailed")),
        buttons: [
          {
            text: t("common.retry"),
            onPress: () => {
              if (attendanceRetryRef.current) {
                submitAttendancePayload(attendanceRetryRef.current);
              }
            },
          },
          { text: t("common.cancel"), style: "cancel" },
        ],
      });
    } finally {
      if (manageSaving) {
        setAttendanceSaving(false);
      }
    }
  };

  const handleMarkAttendance = async () => {
    if (isAttendanceBusy) return;

    // Already punched in & out for the day
    if (attendanceClosed) {
      showAlert({
        type: "warning",
        title: t("home.attendance"),
        message: t("home.attendanceAlreadyClosed"),
      });
      return;
    }

    // Check-out: ask confirmation first
    if (attendanceStatus === "present") {
      showAlert({
        type: "warning",
        title: t("home.confirmCheckoutTitle"),
        message: t("home.confirmCheckoutMessage"),
        buttons: [
          { text: t("common.no"), style: "cancel" },
          { text: t("common.yes"), onPress: () => performAttendanceMark() },
        ],
      });
      return;
    }

    await performAttendanceMark();
  };

  const performAttendanceMark = async () => {
    if (isAttendanceBusy || attendanceClosed) return;

    // Check-in: present + photo | Check-out: checkout, no photo
    const apiStatus = attendanceStatus === "present" ? "checkout" : "present";
    // Keep busy continuously until camera opens on top (do not clear mid-flow — that flickers)
    setFetchingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert({
          type: "error",
          title: t("common.error"),
          message: t("home.locationPermissionDenied"),
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const storedUserId = await AsyncStorage.getItem("userId");
      const userId = user?.id ?? storedUserId;

      let rawImageAsset = null;
      if (apiStatus === "present") {
        const cameraPermission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          showAlert({
            type: "error",
            title: t("common.error"),
            message: t("home.cameraPermissionDenied"),
          });
          return;
        }

        // Keep overlay on until camera covers the screen — then switch to upload busy
        // without a clear/reload gap when returning from camera.
        setAttendanceSaving(true);
        setFetchingLocation(false);

        const cameraResult = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.5,
        });

        if (!cameraResult.canceled && cameraResult.assets?.length > 0) {
          rawImageAsset = cameraResult.assets[0];
        } else if (Platform.OS === "android" && cameraResult.canceled) {
          try {
            const pending = await ImagePicker.getPendingResultAsync();
            if (pending && !pending.canceled && pending.assets?.length > 0) {
              rawImageAsset = pending.assets[0];
            }
          } catch (e) {
            console.warn("getPendingResultAsync fallback failed:", e?.message);
          }
        }

        if (!rawImageAsset) {
          setAttendanceSaving(false);
          return;
        }
      } else {
        setAttendanceSaving(true);
        setFetchingLocation(false);
      }

      try {
        let imageUri = null;
        if (rawImageAsset) {
          const imageAsset = await compressImageAssetIfNeeded(rawImageAsset);
          if (!imageAsset?.uri) {
            return;
          }
          imageUri = imageAsset.uri;
        }

        const address = await getAddress(latitude, longitude);
        await submitAttendancePayload(
          {
            userId,
            status: apiStatus,
            latitude,
            longitude,
            address: address || "",
            imageUri,
          },
          { manageSaving: false },
        );
      } finally {
        setAttendanceSaving(false);
      }
    } catch (error) {
      console.warn("[Attendance Error]", error);
      setAttendanceSaving(false);
      showAlert({
        type: "error",
        title: t("common.error"),
        message: getApiErrorMessage(error, t("home.attendanceFailed")),
      });
    } finally {
      setFetchingLocation(false);
    }
  };

  useEffect(() => {
    const native = { useNativeDriver: true };
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(delayPulseAnim, {
          toValue: 1.045,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          ...native,
        }),
        Animated.timing(delayPulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          ...native,
        }),
      ]),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(delayGlowAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          ...native,
        }),
        Animated.timing(delayGlowAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          ...native,
        }),
      ]),
    );
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(delayShimmerAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          ...native,
        }),
        Animated.delay(900),
        Animated.timing(delayShimmerAnim, {
          toValue: 0,
          duration: 0,
          ...native,
        }),
      ]),
    );
    const makeRingLoop = (anim, startDelay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(startDelay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1700,
            easing: Easing.out(Easing.cubic),
            ...native,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, ...native }),
        ]),
      );
    const ring1Loop = makeRingLoop(delayRing1Anim, 0);
    const ring2Loop = makeRingLoop(delayRing2Anim, 850);

    pulseLoop.start();
    glowLoop.start();
    shimmerLoop.start();
    ring1Loop.start();
    ring2Loop.start();
    return () => {
      pulseLoop.stop();
      glowLoop.stop();
      shimmerLoop.stop();
      ring1Loop.stop();
      ring2Loop.stop();
    };
  }, [
    delayPulseAnim,
    delayShimmerAnim,
    delayRing1Anim,
    delayRing2Anim,
    delayGlowAnim,
  ]);

  // Refresh block + attendance when app returns to foreground (silent — no global loader).
  // Re-sync FS when allow_location / capture_time / check-in gate change.
  useEffect(() => {
    let lastLocKey = `${ATTENDANCE.allow_location}:${ATTENDANCE.user_allow_location}:${ATTENDANCE.capture_time}:${ATTENDANCE.attendance_status}`;

    const checkDashboardFlags = async () => {
      try {
        const res = await apiServices.dashboard.getTodayStats({
          skipGlobalLoader: true,
        });
        applyAppBlockFromResponse(res);
        applyAttendanceFromResponse(res);
        syncAttendanceUiRef.current?.();

        const nextLocKey = `${ATTENDANCE.allow_location}:${ATTENDANCE.user_allow_location}:${ATTENDANCE.capture_time}:${ATTENDANCE.attendance_status}`;
        if (nextLocKey !== lastLocKey) {
          lastLocKey = nextLocKey;
          ensureLocationTrackingRef.current?.();
        }
      } catch (e) {
        // ignore
      }
    };

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkDashboardFlags();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncAttendanceUiRef.current?.();
      runCheck();
      loadHomeDataRef.current?.();
    }, [runCheck]),
  );

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: language === "ta" ? LANG_THUMB_TRAVEL : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }, [language, slideAnim]);

  const handleHomeLanguageChange = async (newLanguage) => {
    if (newLanguage === language || langSaving) return;
    setLangSaving(true);
    try {
      const storedUserId = await AsyncStorage.getItem("userId");
      const userId = user?.id ?? storedUserId;
      if (!userId) {
        showAlert({
          type: "error",
          title: t("common.error"),
          message:
            t("profile.updateFailed") ||
            "Unable to update language. Please login again.",
        });
        return;
      }
      await syncUserLanguageWithApi(newLanguage, userId);
      await changeLanguage(newLanguage);
      updateUser({ language: newLanguage, lang: newLanguage });
    } catch (error) {
      const message =
        error?.code === "NO_AUTH"
          ? t("profile.updateFailed") ||
            "Unable to update language. Please login again."
          : error?.response?.data?.message ||
            "Failed to change language. Please try again.";
      showAlert({
        type: "error",
        title: t("common.error"),
        message,
      });
    } finally {
      setLangSaving(false);
    }
  };

  const renderAmountCard = ({
    cardKey,
    backgroundColor,
    iconName,
    title,
    amountText,
    subText,
    onPress,
    outlined,
    hideDetails,
    filledDanger,
  }) => {
    const isOutlined = Boolean(outlined);
    const isDanger = Boolean(filledDanger);
    const iconColor = isDanger ? COLORS.white : COLORS.primary;
    return (
      <TouchableOpacity
        key={cardKey}
        style={[
          styles.amountCard,
          isOutlined ? styles.amountCardOutlined : styles.amountCardFilled,
          !isOutlined && backgroundColor ? { backgroundColor } : null,
          isDanger && styles.amountCardFilledDanger,
          hideDetails && styles.amountCardCentered,
        ]}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <View
          style={[
            styles.amountCardHeader,
            hideDetails && styles.amountCardHeaderCentered,
          ]}
        >
          <View
            style={[
              styles.amountCardIconWrap,
              isOutlined && styles.amountCardIconWrapOutlined,
              isDanger && styles.amountCardIconWrapDanger,
            ]}
          >
            <Ionicons
              name={iconName}
              size={hideDetails ? 28 : 20}
              color={iconColor}
            />
          </View>
          <Text
            style={[
              styles.amountCardHeaderText,
              isOutlined && styles.amountCardHeaderTextOutlined,
              hideDetails && styles.amountCardHeaderTextLarge,
              isDanger && styles.amountCardHeaderTextDanger,
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        {!hideDetails && (
          <>
            <Text
              style={[
                styles.amountCardValue,
                isOutlined && styles.amountCardValueOutlined,
              ]}
            >
              {amountText}
            </Text>
            <Text
              style={[
                styles.amountCardSub,
                isOutlined && styles.amountCardSubOutlined,
              ]}
              numberOfLines={2}
            >
              {subText}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <SafeAreaView
        style={styles.container}
        edges={["left", "right", "bottom"]}
      >
        <StatusBar style="light" backgroundColor={COLORS.statusBar} />

        <Header
          title={t("home.title")}
          showMenuButton={true}
          onMenuPress={() => navigation.openDrawer()}
          rightComponent={
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[
                  styles.langSwitchTrack,
                  langSaving && styles.langSwitchTrackDisabled,
                ]}
                onPress={() =>
                  handleHomeLanguageChange(language === "en" ? "ta" : "en")
                }
                disabled={langSaving}
                activeOpacity={0.8}
              >
                {language === "ta" && (
                  <View
                    style={styles.langSwitchInactiveLeft}
                    pointerEvents="none"
                  >
                    <Text style={styles.langSwitchInactiveText}>EN</Text>
                  </View>
                )}
                {language === "en" && (
                  <View
                    style={styles.langSwitchInactiveRight}
                    pointerEvents="none"
                  >
                    <Text style={styles.langSwitchInactiveText}>த</Text>
                  </View>
                )}
                <Animated.View
                  style={[
                    styles.langSwitchThumb,
                    { transform: [{ translateX: slideAnim }] },
                  ]}
                >
                  <Text style={styles.langSwitchThumbText}>
                    {language === "en" ? "EN" : "த"}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            </View>
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.dashboardSection}>
            <View style={styles.dashboardTitleRow}>
              <Text style={styles.dashboardTitle}>
                {t("home.todaysStatistics")}
              </Text>
              {showAttendance && (
                <TouchableOpacity
                  style={[
                    styles.attendanceSwitchTrack,
                    attendanceStatus === "present"
                      ? styles.attendanceSwitchTrackPresent
                      : styles.attendanceSwitchTrackAbsent,
                    attendanceClosed && styles.attendanceSwitchTrackDisabled,
                  ]}
                  onPress={handleMarkAttendance}
                  disabled={isAttendanceBusy}
                  activeOpacity={1}
                  accessibilityLabel={t("home.attendance")}
                >
                  {attendanceStatus === "present" && (
                    <View
                      style={styles.langSwitchInactiveLeft}
                      pointerEvents="none"
                    >
                      <Text style={styles.attendanceSwitchInactiveText}>A</Text>
                    </View>
                  )}
                  {attendanceStatus === "absent" && (
                    <View
                      style={styles.langSwitchInactiveRight}
                      pointerEvents="none"
                    >
                      <Text style={styles.attendanceSwitchInactiveText}>P</Text>
                    </View>
                  )}
                  <Animated.View
                    style={[
                      styles.langSwitchThumb,
                      { transform: [{ translateX: attendanceSlideAnim }] },
                    ]}
                  >
                    <Text
                      style={[
                        styles.langSwitchThumbText,
                        attendanceStatus === "present"
                          ? styles.attendanceThumbPresent
                          : styles.attendanceThumbAbsent,
                      ]}
                    >
                      {attendanceStatus === "present" ? "P" : "A"}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.delayedCollectionWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.delayedCollectionGlow,
                  {
                    opacity: delayGlowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.25, 0.75],
                    }),
                    transform: [
                      {
                        scale: delayGlowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.02, 1.12],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.delayedCollectionRing,
                  {
                    opacity: delayRing1Anim.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0.85, 0.45, 0],
                    }),
                    transform: [
                      {
                        scale: delayRing1Anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.22],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.delayedCollectionRing,
                  {
                    opacity: delayRing2Anim.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0.7, 0.35, 0],
                    }),
                    transform: [
                      {
                        scale: delayRing2Anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.22],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View style={{ transform: [{ scale: delayPulseAnim }] }}>
                <TouchableOpacity
                  style={styles.delayedCollectionButton}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate("DelayCollection", {
                      delayUnit: "weeks",
                    })
                  }
                >
                  <Text style={styles.delayedCollectionButtonText}>
                    {t("home.delayedCollectionWithCount", {
                      count: dashboardData?.delayedCollectionCount ?? 0,
                    })}
                  </Text>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.delayedCollectionShimmer,
                      {
                        transform: [
                          {
                            translateX: delayShimmerAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-80, 360],
                            }),
                          },
                          { rotate: "20deg" },
                        ],
                      },
                    ]}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
            {/* {renderAmountCard({
                    cardKey: 'delayed-collection',
                    backgroundColor: COLORS.error,
                    iconName: 'time-outline',
                    title: t('home.delayedCollection'),
                    onPress: () =>
                      navigation.navigate('DelayCollection', { delayUnit: 'weeks' }),
                    hideDetails: true,
                    filledDanger: true,
                  })} */}
            {loadingDashboard ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>
                  {t("home.loadingDashboard")}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.homeGrid}>
                  {renderAmountCard({
                    cardKey: "collection",
                    backgroundColor: "#1d7ee2",
                    iconName: "cash-outline",
                    title: t("home.collection"),
                    amountText: formatRupee(collectionSummary.totalBalance),
                    subText: `${collectionSummary.count} ${t("home.dueToday")}`,
                    onPress: () => navigation.navigate("Collection"),
                    hideDetails: true,
                    outlined: true,
                  })}
                  {renderAmountCard({
                    cardKey: "intermediate-income",
                    backgroundColor: "#1d7ee2",
                    iconName: "sync-outline",
                    title: t("home.intermediateIncome"),
                    // amountText: formatRupee(collectionSummary.totalBalance),
                    // subText: `${collectionSummary.count} ${t('home.dueToday')}`,
                    onPress: () => navigation.navigate("IntermediateIncome"),
                    outlined: true,
                    hideDetails: true,
                  })}
                  {renderAmountCard({
                    cardKey: "loan-mgmt",
                    iconName: "document-text-outline",
                    title: t("home.loanManagement"),
                    amountText: dashboardData
                      ? dashboardData.getFormattedLoansGivenAmount()
                      : formatRupee(0),
                    subText: `${dashboardData?.loansGiven?.count ?? 0} ${t("home.loans")}`,
                    onPress: () => navigation.navigate("Loan"),
                    outlined: true,
                  })}

                  {/* {renderAmountCard({
                    cardKey: 'upfront-cash',
                    backgroundColor: '#34C759',
                    iconName: 'wallet-outline',
                    title: t('home.upfrontCash'),
                    amountText: dashboardData
                      ? dashboardData.getFormattedFrontcashAmount()
                      : formatRupee(0),
                    subText: `${dashboardData?.frontcash?.count ?? 0} ${t('home.transactions')}`,
                    onPress: () => navigation.navigate('UpfrontCash'), outlined: true,
                  })} */}

                  {renderAmountCard({
                    cardKey: "expenses",
                    backgroundColor: "#FF3B30",
                    iconName: "card-outline",
                    title: t("home.expenses"),
                    amountText: dashboardData
                      ? dashboardData.getFormattedExpensesAmount()
                      : formatRupee(0),
                    subText: `${dashboardData?.expenses?.count ?? 0} ${t("home.expensesCount")}`,
                    onPress: () => navigation.navigate("Expenses"),
                    outlined: true,
                  })}

                  {renderAmountCard({
                    cardKey: "coll-hist",
                    backgroundColor: "#FF9500",
                    iconName: "bar-chart-outline",
                    title: t("home.collectionHistory"),
                    amountText: dashboardData
                      ? dashboardData.getFormattedCollectionsAmount()
                      : formatRupee(0),
                    subText: `${dashboardData?.collections?.count ?? 0} ${t("home.collectionsCount")}`,
                    onPress: () => navigation.navigate("CollectionHistory"),
                    outlined: true,
                  })}

                  {renderAmountCard({
                    cardKey: "nip",
                    backgroundColor: "#5856D6",
                    iconName: "link-outline",
                    title: t("home.nip"),
                    amountText: formatRupee(nipSummary.totalBalance),
                    subText: `${nipSummary.count} ${t("home.loans")}`,
                    onPress: () => navigation.navigate("NIP"),
                    outlined: true,
                  })}
                </View>

                <TouchableOpacity
                  style={styles.cashAccountCard}
                  onPress={() => navigation.navigate("CashAccount")}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="calculator-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                  <Text style={styles.cashAccountCardText}>
                    {t("cashAccount.closeAccount")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.attendanceLoadingOverlay,
            !isAttendanceBusy && styles.attendanceLoadingOverlayHidden,
          ]}
          pointerEvents={isAttendanceBusy ? "auto" : "none"}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
      {updatePayload && (
        <AppUpdateBottomSheet
          visible
          currentVersion={updatePayload.currentVersion}
          latestVersion={updatePayload.latestVersion}
          forceUpdate={updatePayload.forceUpdate}
          storeUrl={updatePayload.storeUrl}
          onContinue={updatePayload.forceUpdate ? undefined : clearUpdate}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  attendanceLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  attendanceLoadingOverlayHidden: {
    opacity: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
  },
  homeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: SIZES.base / 2,
  },
  cashAccountCard: {
    marginTop: SIZES.base,
    backgroundColor: COLORS.white,
    borderColor: "rgba(29, 126, 226, 0.2)",
    borderWidth: 1,
    borderRadius: SIZES.radius * 1.5,
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  cashAccountCardText: {
    marginLeft: SIZES.base,
    fontSize: SIZES.body1,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: -0.2,
  },
  amountCard: {
    width: "48%",
    minHeight: 132,
    borderRadius: SIZES.radius * 1.75,
    padding: SIZES.padding,
    marginBottom: SIZES.margin,
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  amountCardFilled: {
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  amountCardOutlined: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(29, 126, 226, 0.16)",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  amountCardFilledDanger: {
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.error,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  amountCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(29, 126, 226, 0.1)",
  },
  amountCardIconWrapOutlined: {
    backgroundColor: "rgba(29, 126, 226, 0.08)",
  },
  amountCardIconWrapDanger: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  amountCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SIZES.base,
    gap: SIZES.base,
  },
  amountCardCentered: {
    justifyContent: "center",
    alignItems: "center",
  },
  amountCardHeaderCentered: {
    justifyContent: "center",
    marginBottom: 0,
    flex: 1,
  },
  amountCardHeaderTextLarge: {
    fontSize: SIZES.body1,
    fontWeight: "700",
    textAlign: "center",
    color: COLORS.primary,
  },
  amountCardHeaderTextDanger: {
    color: COLORS.white,
  },
  amountCardHeaderText: {
    flex: 1,
    fontSize: SIZES.body1,
    fontWeight: "600",
    color: COLORS.primary,
  },
  amountCardHeaderTextOutlined: {
    color: COLORS.primary,
  },
  amountCardValue: {
    fontSize: SIZES.h2,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: SIZES.base / 2,
  },
  amountCardValueOutlined: {
    color: COLORS.primary,
  },
  amountCardSub: {
    fontSize: SIZES.body4,
    color: COLORS.text.secondary,
    fontWeight: "400",
  },
  amountCardSubOutlined: {
    color: COLORS.text.secondary,
    opacity: 1,
  },
  dashboardSection: {
    marginBottom: SIZES.margin,
  },
  dashboardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SIZES.margin,
  },
  dashboardTitle: {
    flex: 1,
    fontSize: SIZES.h3,
    fontWeight: "700",
    color: COLORS.text.secondary,
    marginRight: SIZES.base,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: SIZES.padding * 2,
  },
  loadingText: {
    marginTop: SIZES.margin,
    fontSize: SIZES.body3,
    color: COLORS.text.tertiary,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendanceSwitchTrack: {
    width: LANG_SWITCH_W,
    height: LANG_SWITCH_H,
    borderRadius: LANG_SWITCH_H / 2,
    justifyContent: "center",
  },
  attendanceSwitchTrackPresent: {
    backgroundColor: "rgba(52, 199, 89, 0.45)",
  },
  attendanceSwitchTrackAbsent: {
    backgroundColor: "rgba(255, 59, 48, 0.45)",
  },
  attendanceSwitchTrackDisabled: {
    opacity: 0.55,
  },
  attendanceSwitchInactiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(0, 0, 0, 0.42)",
    letterSpacing: 0.2,
  },
  attendanceThumbPresent: {
    color: "#34C759",
  },
  attendanceThumbAbsent: {
    color: "#FF3B30",
  },
  langSwitchTrack: {
    width: LANG_SWITCH_W,
    height: LANG_SWITCH_H,
    borderRadius: LANG_SWITCH_H / 2,
    backgroundColor: "rgba(255, 255, 255, 0.38)",
    marginRight: 6,
    justifyContent: "center",
  },
  langSwitchTrackDisabled: {
    opacity: 0.55,
  },
  langSwitchInactiveLeft: {
    position: "absolute",
    left: 6,
    top: LANG_PAD,
    bottom: LANG_PAD,
    justifyContent: "center",
    minWidth: 18,
  },
  langSwitchInactiveRight: {
    position: "absolute",
    right: 6,
    top: LANG_PAD,
    bottom: LANG_PAD,
    justifyContent: "center",
    alignItems: "flex-end",
    minWidth: 18,
  },
  langSwitchInactiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(0, 0, 0, 0.42)",
    letterSpacing: 0.2,
  },
  langSwitchThumb: {
    position: "absolute",
    left: LANG_PAD,
    top: LANG_PAD,
    width: LANG_THUMB,
    height: LANG_THUMB,
    borderRadius: LANG_THUMB / 2,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  langSwitchThumbText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  delayedCollectionWrap: {
    marginBottom: SIZES.margin,
  },
  delayedCollectionGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: SIZES.radius * 1.5,
    backgroundColor: "#FF6B66",
  },
  delayedCollectionRing: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: SIZES.radius * 1.5,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.95)",
  },
  delayedCollectionButton: {
    backgroundColor: COLORS.error,
    padding: SIZES.padding,
    borderRadius: SIZES.radius * 1.5,
    overflow: "hidden",
  },
  delayedCollectionShimmer: {
    position: "absolute",
    top: -40,
    bottom: -40,
    width: 70,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },
  delayedCollectionButtonText: {
    color: COLORS.white,
    fontSize: SIZES.body1,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.2,
  },
});

export default HomeScreen;
