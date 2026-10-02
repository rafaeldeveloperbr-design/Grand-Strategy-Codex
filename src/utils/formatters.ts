/**
 * Formata o tamanho do exército de forma padronizada.
 * Exemplos:
 * 8385  -> "8.4k"
 * 1170  -> "1.2k"
 * 15000 -> "15k" (ou "15.0k" se manter decimais)
 * 950   -> "950"
 */
export const formatArmySize = (value: number): string => {
  if (value >= 1000) {
    const formatted = (value / 1000).toFixed(1);
    // Remove o decimal zero se for exato (ex: 15.0k vira 15k)
    return formatted.endsWith('.0') ? `${Math.floor(value / 1000)}k` : `${formatted}k`;
  }
  return value.toString();
};