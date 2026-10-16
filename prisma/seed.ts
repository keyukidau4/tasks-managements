import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development seed cannot run in production.');
  }

  const email = process.env.SEED_USER_EMAIL;
  const name = process.env.SEED_USER_NAME;
  const passwordHash = process.env.SEED_USER_PASSWORD_HASH;

  if (!email || !name || !passwordHash) {
    throw new Error(
      'Set SEED_USER_EMAIL, SEED_USER_NAME, and SEED_USER_PASSWORD_HASH to seed a user.',
    );
  }

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash },
  });

  console.info(
    'Development user seed completed; existing users are unchanged.',
  );
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
