import Store from 'electron-store';

type Settings = {
  theme: 'system' | 'dark' | 'light';
  libraries: string[];
};

const schema = {
  theme: { type: 'string', enum: ['system', 'dark', 'light'], default: 'system' },
  libraries: { type: 'array', items: { type: 'string' }, default: [] },
} as const;

export const store = new Store<Settings>({ schema: schema as any });
