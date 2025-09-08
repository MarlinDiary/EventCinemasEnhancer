import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Event Cinema Enhancer',
    description: 'Display IMDb ratings on Event Cinemas website',
    version: '1.0.0',
    host_permissions: [
      'https://search.imdbot.workers.dev/*',
      'https://www.omdbapi.com/*',
    ],
    permissions: ['storage']
  }
});
