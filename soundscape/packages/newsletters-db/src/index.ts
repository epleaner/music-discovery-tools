import { pathToFileURL } from 'node:url';
import {
  initializeNewsletterSchema,
  openNewsletterDatabase,
  resolveNewsletterDbPath,
} from './client.js';
import { NEWSLETTER_TABLE_NAMES } from './schema.js';

export * from './client.js';
export * from './queries.js';
export * from './schema.js';

interface ExistingTableRow {
  name: string;
}

export function verifyInitializedSchema(dbPath?: string): {
  dbPath: string;
  missingTables: string[];
} {
  const resolvedDbPath = resolveNewsletterDbPath(dbPath);
  const db = openNewsletterDatabase({ dbPath: resolvedDbPath });

  try {
    initializeNewsletterSchema(db);

    const rows = db
      .prepare<[], ExistingTableRow>(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'`
      )
      .all();

    const existingTables = new Set(rows.map((row) => row.name));
    const missingTables = NEWSLETTER_TABLE_NAMES.filter(
      (tableName) => !existingTables.has(tableName)
    );

    return {
      dbPath: resolvedDbPath,
      missingTables: [...missingTables],
    };
  } finally {
    db.close();
  }
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);

  if (!args.includes('--verify-schema')) {
    return;
  }

  const result = verifyInitializedSchema(process.env.NEWSLETTER_DB_PATH);

  if (result.missingTables.length > 0) {
    throw new Error(
      `Missing newsletter tables in ${result.dbPath}: ${result.missingTables.join(', ')}`
    );
  }

  console.log(`Verified newsletter schema at ${result.dbPath}`);
}

const invokedPath = process.argv[1];

if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
