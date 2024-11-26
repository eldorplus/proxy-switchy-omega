import { describe, it, assert } from 'vitest';
import { getDomain, getBaseDomain } from '@extension/pac';

describe('getBaseDomain', () => {
  it('should return domains with zero level unchanged', () => {
    assert.equal(getDomain('someinternaldomain', { allowPrivateDomains: true }), 'someinternaldomain');
  });

  it('should return domains with one level unchanged', () => {
    assert.equal(getBaseDomain('example.com'), 'example.com');
    assert.equal(getBaseDomain('e.test'), 'e.test');
    assert.equal(getBaseDomain('a.b'), 'a.b');
  });

  it('should treat two-segment TLD as one component', () => {
    assert.equal(getBaseDomain('images.google.co.uk'), 'google.co.uk');
    assert.equal(getBaseDomain('images.google.co.jp'), 'google.co.jp');
    assert.equal(getBaseDomain('example.com.cn'), 'example.com.cn');
  });

  it('should not mistake short domains with two-segment TLDs', () => {
    assert.equal(getBaseDomain('a.bc.com'), 'bc.com');
    assert.equal(getBaseDomain('i.t.co'), 't.co');
  });

  it('should not try to modify IP address literals', () => {
    assert.equal(getBaseDomain('127.0.0.1'), '127.0.0.1');
    assert.equal(getBaseDomain('[::1]'), '[::1]');
    assert.equal(getBaseDomain('::f'), '::f');
  });
});
