let RNHaptic: any = null;
let HapticTypes: any = null;

try {
  const mod = require('react-native-haptic-feedback');
  RNHaptic = mod.default || mod;
  HapticTypes = mod.HapticFeedbackTypes;
} catch {
  // Native module not available — haptics disabled
}

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const safeTrigger = (type: string) => {
  try {
    if (RNHaptic) {
      RNHaptic.trigger(type, options);
    }
  } catch {
    // Silently ignore — haptic not available
  }
};

export const haptics = {
  success: () => safeTrigger(HapticTypes?.impactLight ?? 'impactLight'),
  error: () => safeTrigger(HapticTypes?.notificationError ?? 'notificationError'),
  warning: () => safeTrigger(HapticTypes?.notificationWarning ?? 'notificationWarning'),
  light: () => safeTrigger(HapticTypes?.impactLight ?? 'impactLight'),
  medium: () => safeTrigger(HapticTypes?.impactMedium ?? 'impactMedium'),
  heavy: () => safeTrigger(HapticTypes?.impactHeavy ?? 'impactHeavy'),
  selection: () => safeTrigger(HapticTypes?.selection ?? 'selection'),
};
