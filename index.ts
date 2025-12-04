// IMPORTANT: Polyfills must be defined BEFORE any imports that use them
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

// Load polyfills FIRST - this ensures all Node.js modules are polyfilled
import './src/polyfills';
import './src/utils/polyfills';

// Now import Expo and App AFTER polyfills are set up
import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
