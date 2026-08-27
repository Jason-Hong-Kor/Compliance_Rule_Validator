import React from 'react';
import ForgeReconciler from '@forge/react';

import { SettingsForm } from './components/SettingsForm';

const App = () => <SettingsForm product="confluence" />;

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
