import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Event Cinema Enhancer',
    description: 'Display IMDb ratings on Event Cinemas website',
    version: '1.0.0',
    permissions: [
      'activeTab',
      'storage'
    ]
  }
});
