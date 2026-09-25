import assert from 'node:assert/strict';
import test from 'node:test';
import { readAuthLinkParameters, readConfirmationParameters } from '../src/features/auth/callback-parameters.ts';
import { passwordValidationMessage } from '../src/features/auth/password-policy.ts';

test('reads the authorization code from a query string', () => {
  const values = readConfirmationParameters(['artiz://auth/callback?code=one'], {});
  assert.equal(values.get('code'), 'one');
});

test('reads tokens from a native URL fragment', () => {
  const values = readConfirmationParameters(
    ['artiz://auth/callback#access_token=first&refresh_token=second'], {},
  );
  assert.equal(values.get('access_token'), 'first');
  assert.equal(values.get('refresh_token'), 'second');
});

test('reads an Expo Router fragment when the native URL is unavailable', () => {
  const values = readConfirmationParameters([null], { '#': 'token_hash=hash&type=signup' });
  assert.equal(values.get('token_hash'), 'hash');
  assert.equal(values.get('type'), 'signup');
});

test('prioritizes the new native link over stale route parameters', () => {
  const values = readConfirmationParameters(
    ['artiz://auth/callback#token_hash=new&type=signup'], { code: 'old' },
  );
  assert.equal(values.get('token_hash'), 'new');
  assert.equal(values.has('code'), false);
});

test('ignores a development launcher URL and retains route parameters', () => {
  const values = readConfirmationParameters(
    ['exp+artiz://expo-development-client/?url=local'], { code: 'current' },
  );
  assert.equal(values.get('code'), 'current');
});

test('reads a Supabase error returned in the callback query', () => {
  const values = readConfirmationParameters(
    ['artiz://auth/callback?error=access_denied&error_code=otp_expired'], {},
  );
  assert.equal(values.get('error'), 'access_denied');
  assert.equal(values.get('error_code'), 'otp_expired');
});

test('allows a callback without parameters to show the sign-in fallback', () => {
  const values = readConfirmationParameters(['artiz://auth/callback'], {});
  assert.equal(values.toString(), '');
});

test('reads a recovery token from the native reset URL', () => {
  const values = readAuthLinkParameters(
    ['artiz://auth/reset-password#access_token=first&refresh_token=second&type=recovery'], {}, 'auth/reset-password',
  );
  assert.equal(values.get('type'), 'recovery');
  assert.equal(values.get('refresh_token'), 'second');
});

test('reads the recovery hash from Expo Router when Android omits the native URL', () => {
  const values = readAuthLinkParameters([null], { '#': 'token_hash=one&type=recovery' }, 'auth/reset-password');
  assert.equal(values.get('token_hash'), 'one');
  assert.equal(values.get('type'), 'recovery');
});

test('prefers a new recovery URL over stale route parameters', () => {
  const values = readAuthLinkParameters(
    ['artiz://auth/reset-password?code=new'], { token_hash: 'old', type: 'recovery' }, 'auth/reset-password',
  );
  assert.equal(values.get('code'), 'new');
  assert.equal(values.has('token_hash'), false);
});

test('does not use a confirmation URL for password recovery', () => {
  const values = readAuthLinkParameters(
    ['artiz://auth/callback?code=confirmation'], {}, 'auth/reset-password',
  );
  assert.equal(values.has('code'), false);
});

test('rejects weak or mismatched passwords', () => {
  assert.match(passwordValidationMessage('short1', 'short1'), /8 caractères/);
  assert.match(passwordValidationMessage('abcdefgh', 'abcdefgh'), /chiffre/);
  assert.match(passwordValidationMessage('abcd1234', 'abcd1235'), /correspondent pas/);
  assert.equal(passwordValidationMessage('abcd1234', 'abcd1234'), null);
});
