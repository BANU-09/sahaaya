import { seedDemo } from '../src/server/services/demo';
import { db } from '../src/server/db';
await seedDemo();
console.log('Fictional demo care circle is ready. No real patient data was created.');
await db.$disconnect();
