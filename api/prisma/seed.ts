import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../src/services/auth/password';

// Load .env for standalone execution if not already loaded by Prisma CLI
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Ignore if already loaded or not supported
  }
} else if (existsSync('api/.env')) {
  try {
    process.loadEnvFile('api/.env');
  } catch {
    // Ignore
  }
}

const prisma = new PrismaClient();

const emailEnv = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
const passwordEnv = process.env.SEED_USER_PASSWORD;

if (!emailEnv || !passwordEnv) {
  throw new Error(
    'Missing SEED_USER_EMAIL or SEED_USER_PASSWORD in environment. Please configure them in .env.',
  );
}

const SEED_USER = {
  email: emailEnv,
  password: passwordEnv,
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function testOpenAIKey(apiKey: string): Promise<{ valid: boolean; message: string; modelsCount?: number }> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (res.status === 401 || res.status === 403) {
      return { valid: false, message: `OpenAI rejected the key (HTTP ${res.status}).` };
    }

    if (!res.ok) {
      return { valid: false, message: `OpenAI error: HTTP ${res.status} ${res.statusText}` };
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const count = data.data?.length ?? 0;
    return { valid: true, message: `Valid! Available models: ${count}`, modelsCount: count };
  } catch (error) {
    return {
      valid: false,
      message: `Failed to connect to OpenAI API: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function main() {
  console.log('--- [AI Keyboard Seed] Starting Seed Process ---');
  console.log(`Seeding user: ${SEED_USER.email}`);

  // 1. Hash the password using project Argon2id standard
  console.log('Generating Argon2id password hash...');
  const passwordHash = await hashPassword(SEED_USER.password);

  // 2. Immediate verification sanity check
  const isMatch = await verifyPassword(passwordHash, SEED_USER.password);
  if (!isMatch) {
    throw new Error('FATAL: Password hash self-verification failed!');
  }
  console.log('✓ Password hash self-check succeeded.');

  // 3. Upsert user in database
  console.log('Connecting to database and upserting user...');
  const user = await prisma.user.upsert({
    where: { email: SEED_USER.email },
    update: {
      passwordHash,
      status: 'active',
      deletedAt: null,
      updatedAt: new Date(),
    },
    create: {
      email: SEED_USER.email,
      passwordHash,
      status: 'active',
    },
  });

  console.log(`✓ User successfully seeded in DB!`);
  console.log(`  - User ID: ${user.id}`);
  console.log(`  - Email:   ${user.email}`);
  console.log(`  - Status:  ${user.status}`);

  // 4. Upsert default user preferences
  const preferences = await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      writingStyle: 'neutral',
      toneStrength: 'balanced',
      formality: 'neutral',
      defaultLength: 'normal',
      language: 'en-IN',
    },
  });
  console.log(`✓ User preferences confirmed (Language: ${preferences.language}).`);

  // 5. Test login verification directly against DB user record
  const dbUser = await prisma.user.findUnique({ where: { email: SEED_USER.email } });
  if (!dbUser) {
    throw new Error('FATAL: Seeded user could not be retrieved from DB!');
  }
  const loginCheck = await verifyPassword(dbUser.passwordHash, SEED_USER.password);
  if (!loginCheck) {
    throw new Error('FATAL: Verification against stored DB passwordHash failed!');
  }
  console.log('✓ End-to-end database credential check: PASSED.');

  // 6. Test OpenAI API Key if provided
  let openAiResult: { valid: boolean; message: string } | null = null;
  if (OPENAI_API_KEY) {
    console.log('\n--- [AI Provider] Verifying OpenAI API Key ---');
    openAiResult = await testOpenAIKey(OPENAI_API_KEY);
    if (openAiResult.valid) {
      console.log(`✓ OpenAI API Key validation: SUCCESS (${openAiResult.message})`);
    } else {
      console.warn(`⚠ OpenAI API Key validation warning: ${openAiResult.message}`);
    }
  } else {
    console.log('\n--- [AI Provider] No OPENAI_API_KEY provided in environment, skipping provider test. ---');
  }

  console.log('\n=============================================');
  console.log('SEED SUMMARY:');
  console.log(`Email:      ${SEED_USER.email}`);
  console.log(`Password:   ${SEED_USER.password}`);
  console.log(`User ID:    ${user.id}`);
  if (OPENAI_API_KEY && openAiResult) {
    console.log(`OpenAI Key: ${OPENAI_API_KEY.slice(0, 10)}...${OPENAI_API_KEY.slice(-4)} (${openAiResult.valid ? 'VALID' : 'INVALID'})`);
  } else {
    console.log('OpenAI Key: Not provided in environment');
  }
  console.log('=============================================\n');
}

main()
  .catch((err) => {
    console.error('Seed process failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

