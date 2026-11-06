import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
export function createPrismaClient(
  connectionString: string,
  schema = 'public',
) {
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString, max: 5, connectionTimeoutMillis: 5000 },
      { schema },
    ),
  });
}
export const LOCAL_USER_ID = 'd911d02f-4094-4da7-87c3-85211e282c01';
