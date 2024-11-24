import { describe, it, assert } from 'vitest';
import { getBaseDomain } from '@extension/pac';

describe('getBaseDomain', () => {
  it('should return domains with zero level unchanged', () => {
    assert.equal(getBaseDomain('someinternaldomain'), 'someinternaldomain');
  });
});
