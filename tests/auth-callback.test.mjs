import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfirmationParameters } from '../src/features/auth/callback-parameters.ts';

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
