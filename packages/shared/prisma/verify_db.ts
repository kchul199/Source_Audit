import 'dotenv/config';
import { db } from '../src/db';

async function main() {
  console.log('Querying projects from DB...');
  const projects = await db.project.findMany();
  console.log('Projects in DB:', JSON.stringify(projects, null, 2));

  console.log('Querying audits from DB...');
  const audits = await db.audit.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Audits in DB:', JSON.stringify(audits, null, 2));
}

main()
  .catch((e) => {
    console.error('Error querying DB:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
