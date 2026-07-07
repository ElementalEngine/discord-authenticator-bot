import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SNOWFLAKE_RE } from '../src/utils/patterns.js';

test('SNOWFLAKE_RE accepts 17-20 digit ids', () => {
  for (const id of ['1'.repeat(17), '9'.repeat(20), '76561198026787207']) {
    assert.equal(SNOWFLAKE_RE.test(id), true, `should accept ${id}`);
  }
});

test('SNOWFLAKE_RE rejects wrong lengths and non-digits', () => {
  for (const id of ['1'.repeat(16), '1'.repeat(21), '', 'abc', '1234567890123456a', ' 12345678901234567']) {
    assert.equal(SNOWFLAKE_RE.test(id), false, `should reject ${JSON.stringify(id)}`);
  }
});
