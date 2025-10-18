import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Soundscape',
    description: 'Music discovery tools',
    version: '0.0.1',
    permissions: ['activeTab', 'storage'],
  },
});
