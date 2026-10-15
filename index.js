/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { handlePlanNotificationEvent } from './src/utils/planService';

// Plan notification buttons work with the app closed.
notifee.onBackgroundEvent(handlePlanNotificationEvent);

AppRegistry.registerComponent(appName, () => App);
