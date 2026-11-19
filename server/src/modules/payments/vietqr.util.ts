const NAPAS_GUID = 'A000000727';
const SERVICE_FAST_ACCOUNT_TRANSFER = 'QRIBFTTA';
const VND_CURRENCY_CODE = '704';
const COUNTRY_CODE_VN = 'VN';

function tlv(tag: string, value: string): string {
  const len = Buffer.byteLength(value, 'utf8');
  return `${tag}${String(len).padStart(2, '0')}${value}`;
}

export function normalizeAsciiLabel(input: string, maxLen = 25): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 \-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

/**
 * Computes standard EMVCo CRC-16/CCITT-FALSE (`init = 0xFFFF`, `poly = 0x1021`).
 */
export function computeCrc16CcittFalse(payload: string): string {
  const bytes = Buffer.from(payload, 'utf8');
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface VietQrPayloadInput {
  bankBin: string;
  accountNo: string;
  accountName?: string;
  amountVnd?: number;
  addInfo?: string;
}

/**
 * Builds a valid EMVCo / NAPAS 247 VietQR payload string with verified CRC-16/CCITT-FALSE checksum.
 */
export function buildVietQrPayload(input: VietQrPayloadInput): string {
  const bankBin = input.bankBin.trim();
  const accountNo = input.accountNo.trim();
  const hasDynamicAmount = typeof input.amountVnd === 'number' && input.amountVnd > 0;
  const cleanAddInfo = input.addInfo ? normalizeAsciiLabel(input.addInfo, 50) : '';
  const cleanName = input.accountName ? normalizeAsciiLabel(input.accountName, 25) : '';

  const beneficiaryOrg = tlv('00', bankBin) + tlv('01', accountNo);
  const merchantAccountInfo =
    tlv('00', NAPAS_GUID) +
    tlv('01', beneficiaryOrg) +
    tlv('02', SERVICE_FAST_ACCOUNT_TRANSFER);

  const initiationMethod = hasDynamicAmount || cleanAddInfo.length > 0 ? '12' : '11';

  const fields: string[] = [
    tlv('00', '01'),
    tlv('01', initiationMethod),
    tlv('38', merchantAccountInfo),
    tlv('53', VND_CURRENCY_CODE),
  ];

  if (hasDynamicAmount) {
    fields.push(tlv('54', String(Math.trunc(input.amountVnd!))));
  }

  fields.push(tlv('58', COUNTRY_CODE_VN));

  if (cleanName) {
    fields.push(tlv('59', cleanName));
  }

  if (cleanAddInfo) {
    fields.push(tlv('62', tlv('08', cleanAddInfo)));
  }

  const withoutCrc = `${fields.join('')}6304`;
  const crc = computeCrc16CcittFalse(withoutCrc);
  return `${withoutCrc}${crc}`;
}

export function buildVietQrImageUrl(input: {
  bankBin: string;
  accountNo: string;
  accountName: string;
  amountVnd?: number;
  addInfo?: string;
}): string {
  const params = new URLSearchParams();
  if (typeof input.amountVnd === 'number' && input.amountVnd > 0) {
    params.set('amount', String(Math.trunc(input.amountVnd)));
  }
  if (input.addInfo) {
    params.set('addInfo', input.addInfo);
  }
  params.set('accountName', input.accountName);

  const bankBin = encodeURIComponent(input.bankBin.trim());
  const accountNo = encodeURIComponent(input.accountNo.trim());
  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?${params.toString()}`;
}
