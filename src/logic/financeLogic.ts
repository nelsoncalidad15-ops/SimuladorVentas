/**
 * Lógica financiera para la calculadora VWFS
 */

export interface FinanceResult {
  bruto: number;
  neto: number;
  quebranto: number;
  prenda: number;
  gastos: number;
  cuotaIni: number;
  cuotaProm: number;
  totalPagado: number;
}

/**
 * Calcula los detalles de la operación desde el monto bruto solicitado al banco.
 */
export function calculateFromBruto(
  bruto: number,
  qF: number,
  gPct: number,
  pPct: number,
  ci: number,
  cp: number,
  plazo: number,
  ivaQ: number = 21
): FinanceResult {
  const qFiva = qF * (1 + ivaQ / 100);
  const q = bruto * (qFiva / 100);
  const pr = bruto * (pPct / 100);
  const resto = bruto - q - pr;
  const g = (resto / (100 + gPct)) * gPct;
  const neto = resto - g;

  return {
    bruto,
    neto,
    quebranto: q,
    prenda: pr,
    gastos: g,
    cuotaIni: (bruto / 1000) * ci,
    cuotaProm: (bruto / 1000) * cp,
    totalPagado: (bruto / 1000) * cp * plazo,
  };
}

/**
 * Calcula los detalles de la operación desde el neto deseado (saldo a financiar).
 */
export function calculateFromNeto(
  neto: number,
  qF: number,
  gPct: number,
  pPct: number,
  ci: number,
  cp: number,
  plazo: number,
  ivaQ: number = 21
): FinanceResult | null {
  const qFiva = qF * (1 + ivaQ / 100);
  const div = 1 - qFiva / 100 - pPct / 100;
  if (div <= 0) return null;
 
  const bruto = Math.round((neto * (1 + gPct / 100)) / div);
  return calculateFromBruto(bruto, qF, gPct, pPct, ci, cp, plazo, ivaQ);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
