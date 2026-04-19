'use strict';

const LEGACY_DEFAULT_PREFIX_LENGTH = 24;

function parseIPv4(address) {
  if (typeof address !== 'string') return null;

  const parts = address.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;

    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;

    value = value * 256 + octet;
  }

  return value;
}

function formatIPv4(value) {
  return [
    Math.floor(value / (256 ** 3)) % 256,
    Math.floor(value / (256 ** 2)) % 256,
    Math.floor(value / 256) % 256,
    value % 256,
  ].join('.');
}

function isValidIPv4(address) {
  return parseIPv4(address) !== null;
}

function parsePrefixLength(prefixLength) {
  if (!/^\d+$/.test(prefixLength)) {
    throw new Error(`Invalid CIDR prefix: ${prefixLength}`);
  }

  const value = Number(prefixLength);
  if (!Number.isInteger(value) || value < 1 || value > 30) {
    throw new Error(`Invalid CIDR prefix: ${prefixLength}. Use a value from 1 to 30.`);
  }

  return value;
}

function networkAddressFor(addressInt, prefixLength) {
  const blockSize = 2 ** (32 - prefixLength);
  return Math.floor(addressInt / blockSize) * blockSize;
}

function buildPool({
  raw,
  prefixLength,
  serverAddressInt,
  networkAddressInt,
}) {
  const addressCount = 2 ** (32 - prefixLength);
  const broadcastAddressInt = networkAddressInt + addressCount - 1;
  const firstUsableAddressInt = networkAddressInt + 1;
  const lastUsableAddressInt = broadcastAddressInt - 1;

  if (firstUsableAddressInt > lastUsableAddressInt) {
    throw new Error(`CIDR range has no usable host addresses: ${raw}`);
  }

  return {
    raw,
    prefixLength,
    networkAddress: formatIPv4(networkAddressInt),
    broadcastAddress: formatIPv4(broadcastAddressInt),
    serverAddress: formatIPv4(serverAddressInt),
    cidr: `${formatIPv4(networkAddressInt)}/${prefixLength}`,
    firstUsableAddress: formatIPv4(firstUsableAddressInt),
    lastUsableAddress: formatIPv4(lastUsableAddressInt),
    serverAddressInt,
    networkAddressInt,
    broadcastAddressInt,
    firstUsableAddressInt,
    lastUsableAddressInt,
  };
}

function parseLegacyAddress(raw) {
  const parts = raw.split('.');
  const wildcardParts = parts.filter((part) => part === 'x');

  if (parts.length !== 4 || wildcardParts.length !== 1 || parts[3] !== 'x') {
    throw new Error('WG_DEFAULT_ADDRESS must be either a legacy A.B.C.x range or an IPv4 CIDR like 10.8.0.0/16.');
  }

  const networkAddress = parts.map((part) => (part === 'x' ? '0' : part)).join('.');
  const serverAddress = parts.map((part) => (part === 'x' ? '1' : part)).join('.');
  const networkAddressInt = parseIPv4(networkAddress);
  const serverAddressInt = parseIPv4(serverAddress);

  if (networkAddressInt === null || serverAddressInt === null) {
    throw new Error(`Invalid WG_DEFAULT_ADDRESS: ${raw}`);
  }

  return buildPool({
    raw,
    prefixLength: LEGACY_DEFAULT_PREFIX_LENGTH,
    serverAddressInt,
    networkAddressInt,
  });
}

function parseCIDR(raw) {
  const parts = raw.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid WG_DEFAULT_ADDRESS CIDR: ${raw}`);
  }

  const addressInt = parseIPv4(parts[0]);
  if (addressInt === null) {
    throw new Error(`Invalid WG_DEFAULT_ADDRESS IPv4 address: ${parts[0]}`);
  }

  const prefixLength = parsePrefixLength(parts[1]);
  const networkAddressInt = networkAddressFor(addressInt, prefixLength);
  const addressCount = 2 ** (32 - prefixLength);
  const broadcastAddressInt = networkAddressInt + addressCount - 1;
  const firstUsableAddressInt = networkAddressInt + 1;

  const serverAddressInt = addressInt > networkAddressInt && addressInt < broadcastAddressInt
    ? addressInt
    : firstUsableAddressInt;

  return buildPool({
    raw,
    prefixLength,
    serverAddressInt,
    networkAddressInt,
  });
}

function parseDefaultAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error('WG_DEFAULT_ADDRESS must not be empty.');
  }

  if (raw.includes('/')) {
    return parseCIDR(raw);
  }

  return parseLegacyAddress(raw);
}

function* getClientAddressIterator(pool) {
  for (let addressInt = pool.firstUsableAddressInt; addressInt <= pool.lastUsableAddressInt; addressInt++) {
    if (addressInt === pool.serverAddressInt) continue;

    yield formatIPv4(addressInt);
  }
}

function getAvailableClientAddress(pool, usedAddresses, reservedAddresses = []) {
  const usedAddressSet = new Set(usedAddresses);
  usedAddressSet.add(pool.serverAddress);

  for (const address of reservedAddresses) {
    usedAddressSet.add(address);
  }

  for (const address of getClientAddressIterator(pool)) {
    if (!usedAddressSet.has(address)) {
      return address;
    }
  }

  return null;
}

module.exports = {
  parseDefaultAddress,
  parseIPv4,
  formatIPv4,
  isValidIPv4,
  getAvailableClientAddress,
  getClientAddressIterator,
};
