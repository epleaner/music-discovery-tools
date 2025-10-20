export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export * from './lastfm';
export * from './recent-grouping';
export * from './url-hash';
export * from './rym';
export * from './cache';
export * from './everynoise';
