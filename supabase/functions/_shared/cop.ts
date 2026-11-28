export const COP_MINIMO_UNITARIA = 50000;

export function copAPesosStripe(pesos: number): number {
  if (!Number.isInteger(pesos) || pesos < 0) {
    throw new Error("Monto COP inválido.");
  }
  return pesos * 100;
}

export function validarMontoCOP(pesos: number): void {
  if (copAPesosStripe(pesos) < COP_MINIMO_UNITARIA) {
    throw new Error("El monto mínimo permitido para cobrar es 500 COP.");
  }
}
