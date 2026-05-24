import {
  useCssElement,
  useNativeVariable as useFunctionalVariable,
} from "react-native-css";

import { Link as RouterLink } from "expo-router";
import Animated from "react-native-reanimated";
import React from "react";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TouchableHighlight as RNTouchableHighlight,
  TextInput as RNTextInput,
  StyleSheet,
} from "react-native";

/**
 * react-native-css sometimes emits transform values as percentage strings
 * (e.g. { scale: "95%" }). React Native requires numbers for transforms.
 * This HOC sanitizes the generated style before it reaches the native layer.
 */
function sanitizeStyle<T extends { style?: any }>(props: T): T {
  const { style, ...rest } = props;
  if (!style) return props;

  const flat = StyleSheet.flatten(style) || {};
  if (!Array.isArray(flat.transform) && !flat.transform) return props;

  const transforms: any[] = Array.isArray(flat.transform)
    ? flat.transform
    : [flat.transform];

  const sanitizedTransforms = transforms.map((t: any) => {
    if (!t || typeof t !== "object") return t;

    if (typeof t.scale === "string" && t.scale.endsWith("%")) {
      return { ...t, scale: parseFloat(t.scale) / 100 };
    }
    if (typeof t.scaleX === "string" && t.scaleX.endsWith("%")) {
      return { ...t, scaleX: parseFloat(t.scaleX) / 100 };
    }
    if (typeof t.scaleY === "string" && t.scaleY.endsWith("%")) {
      return { ...t, scaleY: parseFloat(t.scaleY) / 100 };
    }

    return t;
  });

  return {
    ...(rest as any),
    style: { ...flat, transform: sanitizedTransforms },
  } as T;
}

function withStyleSanitizer<P extends { style?: any }>(
  Component: React.ComponentType<P>
): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<any>> {
  return React.forwardRef<any, P>((props, ref) => {
    const sanitized = sanitizeStyle(props);
    const Comp = Component as any;
    return <Comp ref={ref} {...sanitized} />;
  }) as any;
}

// CSS-enabled Link
export const Link = (
  props: React.ComponentProps<typeof RouterLink> & { className?: string }
) => {
  return useCssElement(RouterLink as React.ComponentType<any>, props as any, { className: "style" }) as any;
};

Link.Trigger = RouterLink.Trigger;
Link.Menu = RouterLink.Menu;
Link.MenuAction = RouterLink.MenuAction;
Link.Preview = RouterLink.Preview;

// CSS Variable hook
export const useCSSVariable =
  process.env.EXPO_OS !== "web"
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;

// Wrapped native components with sanitized transforms
const SanitizedView = withStyleSanitizer(RNView);
const SanitizedText = withStyleSanitizer(RNText);
const SanitizedPressable = withStyleSanitizer(RNPressable);
const SanitizedScrollView = withStyleSanitizer(RNScrollView);
const SanitizedTextInput = withStyleSanitizer(RNTextInput);

// View
export type ViewProps = React.ComponentProps<typeof RNView> & {
  className?: string;
};

export const View = (props: ViewProps) => {
  return useCssElement(SanitizedView as React.ComponentType<any>, props as any, { className: "style" }) as any;
};
View.displayName = "CSS(View)";

// Text
export const Text = (
  props: React.ComponentProps<typeof RNText> & { className?: string }
) => {
  return useCssElement(SanitizedText as React.ComponentType<any>, props as any, { className: "style" }) as any;
};
Text.displayName = "CSS(Text)";

// ScrollView
export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) => {
  return useCssElement(SanitizedScrollView as React.ComponentType<any>, props as any, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  }) as any;
};
ScrollView.displayName = "CSS(ScrollView)";

// Pressable
export const Pressable = (
  props: React.ComponentProps<typeof RNPressable> & { className?: string }
) => {
  return useCssElement(SanitizedPressable as React.ComponentType<any>, props as any, { className: "style" }) as any;
};
Pressable.displayName = "CSS(Pressable)";

// TextInput
export const TextInput = (
  props: React.ComponentProps<typeof RNTextInput> & { className?: string }
) => {
  return useCssElement(SanitizedTextInput as React.ComponentType<any>, props as any, { className: "style" }) as any;
};
TextInput.displayName = "CSS(TextInput)";

// AnimatedScrollView
const SanitizedAnimatedScrollView = withStyleSanitizer(Animated.ScrollView);
export const AnimatedScrollView = (
  props: React.ComponentProps<typeof Animated.ScrollView> & {
    className?: string;
    contentClassName?: string;
    contentContainerClassName?: string;
  }
) => {
  return useCssElement(SanitizedAnimatedScrollView as React.ComponentType<any>, props as any, {
    className: "style",
    contentClassName: "contentContainerStyle",
    contentContainerClassName: "contentContainerStyle",
  }) as any;
};

// TouchableHighlight with underlayColor extraction
const XXTouchableHighlightBase = React.forwardRef<any, React.ComponentProps<typeof RNTouchableHighlight>>(
  (props, ref) => {
    const { underlayColor, ...style } = (StyleSheet.flatten(props.style) || {}) as any;
    return (
      <RNTouchableHighlight
        ref={ref}
        underlayColor={underlayColor}
        {...props}
        style={style}
      />
    );
  }
);

const SanitizedXXTouchableHighlight = withStyleSanitizer(XXTouchableHighlightBase);

export const TouchableHighlight = (
  props: React.ComponentProps<typeof RNTouchableHighlight>
) => {
  return useCssElement(SanitizedXXTouchableHighlight as React.ComponentType<any>, props as any, { className: "style" }) as any;
};
TouchableHighlight.displayName = "CSS(TouchableHighlight)";
