import { bindings, defineConfig, exports } from 'cf/config';

const worker = {
  name: 'epleaner-soundscape',
  entrypoint: './src/index.ts',
  compatibilityDate: '2026-10-26',
  compatibilityFlags: ['nodejs_compat'],
  workersDev: true,
  domains: ['tunes.elipleaner.com'],
  env: {
    ASSETS: bindings.assets(),
    DB: bindings.d1({ id: 'bcd305de-9c92-4e32-b974-2fccfc6018f1', name: 'epleaner-soundscape' }),
    AGENT_BROKER: bindings.durableObject({ worker: 'epleaner-soundscape', exportName: 'AgentBroker' }),
  },
  exports: { AgentBroker: exports.durableObject({ storage: 'sqlite' }) },
  observability: { enabled: false },
};

export default defineConfig({ accountId: '8ee70c4b6325ecf3bdc84838281a61f4', worker });
