import type { Context } from '@soundscape/api';
import { db } from '@soundscape/db';

export const createContext = async (): Promise<Context> => {
  return {
    db,
  };
};



