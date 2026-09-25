const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const entries = fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
  });
const environment = Object.fromEntries(entries);
const client = createClient(
  environment.EXPO_PUBLIC_SUPABASE_URL,
  environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
);
const secretPath = path.join(os.tmpdir(), 'artiz-callback-test-secret-20260925.txt');
const password = fs.existsSync(secretPath)
  ? fs.readFileSync(secretPath, 'utf8')
  : `Artiz${crypto.randomBytes(15).toString('hex')}A1`;
if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, password, { flag: 'wx' });

client.auth.signUp({
  email: 'xahoc66785@ncleap.com',
  password,
  options: {
    data: { display_name: 'Test confirmation Artiz' },
    emailRedirectTo: 'artiz://auth/callback',
  },
}).then(({ data, error }) => {
  if (error) {
    console.error('signup error', error.code || error.name, error.status);
    process.exitCode = 1;
    return;
  }
  console.log('signup result', { userCreated: Boolean(data.user), sessionCreated: Boolean(data.session) });
}).catch((error) => {
  console.error('signup failed', error.name);
  process.exitCode = 1;
});
