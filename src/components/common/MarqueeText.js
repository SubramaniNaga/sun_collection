import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const GAP = 40;
const PX_PER_SECOND = 45;
/** Off-screen measure lane width — not screen/layout width; only so text is not clamped to header slot. */
const MEASURE_LANE_WIDTH = 10000;
let mountCounter = 0;

const MarqueeText = ({
  children,
  style,
  containerStyle,
}) => {
  const text = children == null ? '' : String(children);

  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const mountIdRef = useRef(++mountCounter);
  const prevTextRef = useRef(text);
  const measureKeyRef = useRef(0);

  const flatStyle = useMemo(
    () => StyleSheet.flatten(style) || {},
    [style],
  );

  const fontSize = flatStyle.fontSize ?? 16;
  const lineHeight =
    flatStyle.lineHeight ?? Math.ceil(fontSize * 1.3);

  const androidTextFix =
    Platform.OS === 'android'
      ? {
          includeFontPadding: false,
          textAlignVertical: 'center',
        }
      : null;

  const shouldScroll =
    containerWidth > 0 &&
    textWidth > 0 &&
    textWidth > containerWidth + 1;

  const applyTextWidth = (width) => {
    const rounded = Math.ceil(width);
    if (rounded > 0) {
      setTextWidth((prev) => (Math.abs(prev - rounded) > 0.5 ? rounded : prev));
    }
  };

  // Reset measure only when the title string actually changes — NOT on every mount.
  // Resetting on mount was wiping textWidth after onTextLayout had already fired,
  // and onTextLayout does not fire again for unchanged text (reopen bug).
  useEffect(() => {
    if (prevTextRef.current === text) return;
    prevTextRef.current = text;
    setTextWidth(0);
    measureKeyRef.current += 1;
  }, [text]);

  useEffect(() => {
    if (__DEV__) {
      console.log('[MarqueeText:state]', {
        mountId: mountIdRef.current,
        text: text.slice(0, 40),
        containerWidth,
        textWidth,
        shouldScroll,
        overflow: textWidth > containerWidth ? textWidth - containerWidth : 0,
      });
    }
  }, [text, containerWidth, textWidth, shouldScroll]);

  const startAnimation = () => {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }

    translateX.stopAnimation();
    translateX.setValue(0);

    if (!shouldScroll) return;

    const travelDistance = textWidth + GAP;
    const duration = (travelDistance / PX_PER_SECOND) * 1000;

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -travelDistance,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animationRef.current = animation;
    animation.start();

    if (__DEV__) {
      console.log('[MarqueeText:anim:start]', {
        mountId: mountIdRef.current,
        travelDistance,
        duration,
      });
    }
  };

  useEffect(() => {
    if (__DEV__) {
      console.log('[MarqueeText:anim:effect]', {
        mountId: mountIdRef.current,
        shouldScroll,
        containerWidth,
        textWidth,
      });
    }

    if (!shouldScroll) {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      translateX.stopAnimation();
      translateX.setValue(0);
      return undefined;
    }

    startAnimation();

    return () => {
      if (__DEV__) {
        console.log('[MarqueeText:anim:cleanup]', { mountId: mountIdRef.current });
      }
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [shouldScroll, textWidth, containerWidth]);

  // After background, native-driver loops may stop; restart when app is active again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && shouldScroll) {
        if (__DEV__) {
          console.log('[MarqueeText:anim:resume]', { mountId: mountIdRef.current });
        }
        startAnimation();
      }
    });
    return () => sub.remove();
  }, [shouldScroll, textWidth, containerWidth]);

  return (
    <View
      style={[
        styles.container,
        { height: lineHeight },
        containerStyle,
      ]}
      onLayout={(e) => {
        const width = Math.round(e.nativeEvent.layout.width);
        if (width > 0 && width !== containerWidth) {
          if (__DEV__) {
            console.log('[MarqueeText:onLayout:container]', {
              mountId: mountIdRef.current,
              width,
            });
          }
          setContainerWidth(width);
        }
      }}
    >
      {/* Hidden measurer */}
      <View
        pointerEvents="none"
        style={styles.measureContainer}
      >
        <Text
          key={`measure-${measureKeyRef.current}`}
          numberOfLines={1}
          style={[
            style,
            androidTextFix,
            styles.measureText,
          ]}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (__DEV__) {
              console.log('[MarqueeText:onLayout:measure]', {
                mountId: mountIdRef.current,
                width,
              });
            }
            applyTextWidth(width);
          }}
          onTextLayout={(e) => {
            const lineWidth = e.nativeEvent.lines?.[0]?.width ?? 0;
            if (__DEV__) {
              console.log('[MarqueeText:onTextLayout:measure]', {
                mountId: mountIdRef.current,
                lineWidth,
                lineCount: e.nativeEvent.lines?.length ?? 0,
              });
            }
            applyTextWidth(lineWidth);
          }}
        >
          {text}
        </Text>
      </View>

      {!shouldScroll ? (
        <Text
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[
            style,
            androidTextFix,
            styles.centerText,
            { lineHeight },
          ]}
        >
          {text}
        </Text>
      ) : (
        <View
          style={[
            styles.viewport,
            { height: lineHeight },
          ]}
        >
          <Animated.View
            style={[
              styles.marqueeRow,
              {
                transform: [
                  {
                    translateX,
                  },
                ],
              },
            ]}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="clip"
              style={[
                style,
                androidTextFix,
                styles.scrollText,
                { width: textWidth, lineHeight },
              ]}
            >
              {text}
            </Text>

            <View style={{ width: GAP }} />

            <Text
              numberOfLines={1}
              ellipsizeMode="clip"
              style={[
                style,
                androidTextFix,
                styles.scrollText,
                { width: textWidth, lineHeight },
              ]}
            >
              {text}
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },

  viewport: {
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'center',
  },

  marqueeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },

  centerText: {
    textAlign: 'center',
    width: '100%',
  },

  measureContainer: {
    position: 'absolute',
    opacity: 0,
    top: 0,
    left: 0,
    width: MEASURE_LANE_WIDTH,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    zIndex: -1,
  },

  measureText: {
    flexShrink: 0,
  },

  scrollText: {
    flexShrink: 0,
  },
});

export default MarqueeText;