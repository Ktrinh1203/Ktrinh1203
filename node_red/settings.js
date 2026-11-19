/**
 * NeuroLink IoT Visual Gateway — Node-RED v5 Configuration
 *
 * Launched automatically by `start_unified_server.py` (`-u node_red -s node_red/settings.js`)
 * or standalone via:
 *   node-red -u node_red -s node_red/settings.js --no-telemetry
 */

'use strict';

const parsedPort = Number.parseInt(process.env.NODERED_PORT || '1880', 10);

module.exports = {
  // HTTP/WebSocket server port (default 1880)
  uiPort: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 1880,

  // Flow file & user directory (self-contained inside node_red/)
  userDir: __dirname,
  flowFile: 'flows.json',
  flowFilePretty: true,

  // Deterministic local credential secret avoids runtime key warnings
  credentialSecret:
    process.env.NODERED_CREDENTIAL_SECRET || 'neurolink-nodered-dev-cred-secret',

  // Allow local Express / Vite / diagnostic tooling to invoke HTTP gateway endpoints
  httpNodeCors: {
    origin: '*',
    methods: 'GET,PUT,POST,DELETE,OPTIONS',
  },

  // Clean NeuroLink branding in Node-RED v5 editor
  editorTheme: {
    page: {
      title: 'NeuroLink IoT · Node-RED',
    },
    header: {
      title: 'NeuroLink IoT Gateway',
    },
    projects: {
      enabled: false,
    },
    tours: false,
  },

  // Disable anonymous telemetry prompt & update nags in Node-RED v5
  telemetry: {
    enabled: false,
    updateNotification: false,
  },

  // In-memory context storage for rolling epoch buffers and alert debounce maps
  contextStorage: {
    default: {
      module: 'memory',
    },
  },

  // Shared configuration accessible inside Function nodes via global.get(...)
  functionGlobalContext: {
    neurolinkApiUrl: (
      process.env.NEUROLINK_API_URL || 'http://127.0.0.1:4000'
    ).replace(/\/+$/, ''),
    ingestSecret:
      process.env.NODERED_INGEST_SECRET || 'neurolink-nodered-dev-secret',
    defaultDeviceCode:
      process.env.NODERED_DEFAULT_DEVICE_CODE || 'NL-HOLTER-01',
  },

  // Concise console logging suited for unified launcher `[node-red]` stream
  logging: {
    console: {
      level: process.env.NODERED_LOG_LEVEL || 'info',
      metrics: false,
      audit: false,
    },
  },
};
