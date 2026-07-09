// PromptPay QR payload (EMVCo / Thai QR Payment standard)
// target = เบอร์โทร (08x-xxx-xxxx), เลขบัตรประชาชน 13 หลัก, หรือ e-Wallet ID 15 หลัก

function field(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value
}

function crc16(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function promptPayPayload(target: string, amount?: number): string {
  const digits = target.replace(/\D/g, '')

  let account: string
  if (digits.length >= 15) {
    account = field('03', digits) // e-Wallet
  } else if (digits.length >= 13) {
    account = field('02', digits) // เลขบัตรประชาชน
  } else {
    account = field('01', '0066' + digits.replace(/^0/, '')) // เบอร์โทร
  }

  const merchantInfo = field('29', field('00', 'A000000677010111') + account)

  let payload =
    field('00', '01') +                                // payload format
    field('01', amount != null ? '12' : '11') +        // dynamic เมื่อระบุยอด
    merchantInfo +
    field('53', '764') +                               // สกุลเงิน THB
    (amount != null ? field('54', amount.toFixed(2)) : '') +
    field('58', 'TH')

  payload += '6304' // CRC field header
  return payload + crc16(payload)
}
