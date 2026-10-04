import Big from 'big.js'

// Precisão decimal alta e arredondamento "half up" — sem notação exponencial.
Big.DP = 18
Big.RM = Big.roundHalfUp
Big.NE = -24
Big.PE = 30

export type Eth = string

const ETH_PATTERN = /^\d+(\.\d+)?$/

/** Normaliza para string decimal canônica, sem zeros à direita ("1.50" → "1.5"). */
export function normalizeEth(value: Big | Eth): Eth {
  const big = value instanceof Big ? value : new Big(value)
  const fixed = big.toFixed()
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

export function toBig(value: Eth): Big {
  return new Big(value)
}

export function addEth(...values: Eth[]): Eth {
  return normalizeEth(values.reduce((acc, v) => acc.plus(v), new Big(0)))
}

export function subEth(a: Eth, b: Eth): Eth {
  const result = new Big(a).minus(b)
  return normalizeEth(result.lt(0) ? new Big(0) : result)
}

export function mulEth(value: Eth, factor: number | Eth): Eth {
  return normalizeEth(new Big(value).times(factor))
}

/** Percentual de um valor, arredondado a 6 casas (precisão de exibição). */
export function percentOfEth(value: Eth, percent: number): Eth {
  return normalizeEth(new Big(value).times(percent).div(100).round(6, Big.roundHalfUp))
}

export function compareEth(a: Eth, b: Eth): -1 | 0 | 1 {
  return new Big(a).cmp(b) as -1 | 0 | 1
}

export function isZeroEth(value: Eth) {
  return new Big(value).eq(0)
}

/** Aceita entrada do usuário com vírgula ou ponto. Retorna null se inválida. */
export function parseEthInput(raw: string): Eth | null {
  const value = raw.trim().replace(',', '.')
  if (!ETH_PATTERN.test(value)) return null
  return normalizeEth(value)
}

/**
 * Formata para exibição: no mínimo 2 e no máximo 6 casas decimais,
 * sem perder precisão de valores como 0.016 ou 26.846.
 */
export function formatEth(value: Eth, { suffix = true }: { suffix?: boolean } = {}): string {
  const big = new Big(value)
  let text = big.round(6, Big.roundHalfUp).toFixed(6).replace(/0+$/, '')
  const [, decimals = ''] = text.split('.')
  if (decimals.length < 2) text = big.toFixed(2)
  return suffix ? `${text} ETH` : text
}

export function roundEth(value: Eth, decimals: number): Eth {
  return normalizeEth(new Big(value).round(decimals, Big.roundHalfUp))
}
