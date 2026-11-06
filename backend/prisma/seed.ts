import 'dotenv/config';
import { createPrismaClient, LOCAL_USER_ID } from '../src/database/client.js';
if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL.');
const client = createPrismaClient(process.env.DATABASE_URL);
try {
  await client.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: {
      id: LOCAL_USER_ID,
      name: 'Desenvolvimento local',
      email: 'local@finantrack.invalid',
    },
  });
  console.log('Usuário local preparado. Nenhuma transação foi inserida.');
} finally {
  await client.$disconnect();
}
