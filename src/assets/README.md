# Assets

Place your app assets here:

## Structure

```
assets/
├── icons/
│   ├── app-icon.svg          # App icon (for iOS/Android)
│   └── app-icon-dark.svg     # Dark variant
├── images/
│   ├── splash-logo.svg       # Logo for splash screen
│   └── logo.svg              # General logo
└── README.md
```

## iOS App Icon

After adding the SVG, you'll need to:

1. Export to PNG at multiple sizes (1024x1024 for App Store)
2. Replace files in `ios/SilkRoad/Images.xcassets/AppIcon.appiconset/`

## Splash Screen

The splash screen uses:

- Background color: `#004732` (accent green)
- Logo: centered SVG/PNG

Configure in `ios/SilkRoad/LaunchScreen.storyboard`
