/**
 * @format
 */

// CRITICAL: Polyfills must be imported BEFORE any AWS SDK imports
// Order matters!
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'web-streams-polyfill/dist/polyfill';

// Buffer polyfill
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Fix for "Cannot read property 'slice' of undefined" on older Android versions
if (!Uint8Array.prototype.slice) {
  Uint8Array.prototype.slice = function slice(start, end) {
    return new Uint8Array(Array.prototype.slice.call(this, start, end));
  };
}

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
