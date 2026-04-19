'use strict';

const assert = require('node:assert/strict');
const IPPool = require('../lib/IPPool');

{
  const pool = IPPool.parseDefaultAddress('10.8.0.x');
  assert.equal(pool.cidr, '10.8.0.0/24');
  assert.equal(pool.serverAddress, '10.8.0.1');
  assert.equal(pool.prefixLength, 24);
  assert.equal(pool.firstUsableAddress, '10.8.0.1');
  assert.equal(pool.lastUsableAddress, '10.8.0.254');
  assert.equal(IPPool.getAvailableClientAddress(pool, []), '10.8.0.2');
  assert.equal(IPPool.getAvailableClientAddress(pool, ['10.8.0.2']), '10.8.0.3');
}

{
  const pool = IPPool.parseDefaultAddress('10.8.0.0/16');
  assert.equal(pool.cidr, '10.8.0.0/16');
  assert.equal(pool.serverAddress, '10.8.0.1');
  assert.equal(pool.prefixLength, 16);
  assert.equal(IPPool.getAvailableClientAddress(pool, [
    '10.8.0.2',
    '10.8.0.3',
    '10.8.0.4',
  ]), '10.8.0.5');
  assert.equal(IPPool.getAvailableClientAddress(pool, ['10.8.0.2'], ['10.8.0.3']), '10.8.0.4');
}

{
  const pool = IPPool.parseDefaultAddress('10.8.0.5/24');
  assert.equal(pool.cidr, '10.8.0.0/24');
  assert.equal(pool.serverAddress, '10.8.0.5');
  assert.equal(IPPool.getAvailableClientAddress(pool, []), '10.8.0.1');
  assert.equal(IPPool.getAvailableClientAddress(pool, [
    '10.8.0.1',
    '10.8.0.2',
    '10.8.0.3',
    '10.8.0.4',
  ]), '10.8.0.6');
}

assert.throws(() => IPPool.parseDefaultAddress('10.8.0.0/31'), /Use a value from 1 to 30/);
assert.throws(() => IPPool.parseDefaultAddress('10.8.x.x'), /legacy A.B.C.x/);
assert.equal(IPPool.isValidIPv4('192.168.1.1'), true);
assert.equal(IPPool.isValidIPv4('192.168.1.999'), false);
