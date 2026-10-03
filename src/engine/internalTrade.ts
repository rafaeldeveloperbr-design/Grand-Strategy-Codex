import type { GoodId, Province } from '../types';
import { ALL_GOODS, GOOD_IDS, calculateLocalPrice, calculatePurchasingPower, normalizeMarket } from './market';


const RESERVE_DAYS = 1.5;
const round = (value: number) => Math.round(value * 100) / 100;
export const TRADE_PRIORITY: GoodId[] = [
  GOOD_IDS.FOOD
];

export function findDomesticTradePath(fromId: string, toId: string, provinces: Province[]): string[] {
  const from = provinces.find(province => province.id === fromId);
  const to = provinces.find(province => province.id === toId);
  if (!from || !to || from.owner !== to.owner) return [];
  const eligible = new Map(provinces.filter(p => p.owner === from.owner).map(p => [p.id, p]));
  const queue = [from.id];
  const parents = new Map<string, string>();
  const visited = new Set(queue);
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to.id) {
      const path: string[] = [];
      for (let node = to.id; node !== from.id; node = parents.get(node)!) path.unshift(node);
      return [from.id, ...path];
    }
    const neighbors = [...(eligible.get(current)?.neighbors ?? [])].sort();
    for (const neighbor of neighbors) {
      if (!eligible.has(neighbor) || visited.has(neighbor)) continue;
      visited.add(neighbor);
      parents.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return [];
}

export function calculateTradeBalance(province: Province, goodId: GoodId) {
  const good = normalizeMarket(province.market).goods[goodId];
  const reserve =
  goodId === GOOD_IDS.FOOD
    ? good.demand * RESERVE_DAYS
    : good.demand * 5;
  return {
    reserve: round(reserve),
    surplus: round(Math.max(0, good.stock - reserve)),
    deficit: round(Math.max(good.shortage, Math.max(0, good.demand - good.stock))),
  };
}

/** Redistributes real stock inside connected components of a single country. */
export function processInternalTrade(provinces: Province[]): Province[] {
  const result = provinces.map(province => ({
    ...province,
    market: normalizeMarket(province.market),
  }));
  for (const province of result) {
    for (const id of ALL_GOODS) {
      province.market!.goods[id] = { ...province.market!.goods[id], imported: 0, exported: 0 };
    }
  }

  // FOOD is intentionally first; the order is stable for future route capacity.
  for (const goodId of TRADE_PRIORITY) {
    const consumers = result
      .map(province => ({ province, ...calculateTradeBalance(province, goodId) }))
      .filter(item => item.deficit > 0)
      .sort((a, b) => a.province.id.localeCompare(b.province.id));
    const suppliers = result
      .map(province => ({ province, ...calculateTradeBalance(province, goodId) }))
      .filter(item => item.surplus > 0)
      .sort((a, b) => a.province.id.localeCompare(b.province.id));

    for (const owner of [...new Set(consumers.map(item => item.province.owner))].sort()) {
      const ownerConsumers = consumers.filter(item => item.province.owner === owner);
      const ownerSuppliers = suppliers.filter(item => item.province.owner === owner);
      for (const consumer of ownerConsumers) {
        const reachableSuppliers = ownerSuppliers.filter(item =>
          findDomesticTradePath(item.province.id, consumer.province.id, result).length > 0);
        const componentConsumers = ownerConsumers.filter(item =>
          item.province.id.localeCompare(consumer.province.id) >= 0
          && findDomesticTradePath(item.province.id, consumer.province.id, result).length > 0);
        const componentAvailable = reachableSuppliers.reduce((sum, item) => sum + item.surplus, 0);
        const componentDeficit = componentConsumers.reduce((sum, item) => sum + item.deficit, 0);
        let wanted = Math.min(consumer.deficit, componentAvailable * consumer.deficit / Math.max(0.01, componentDeficit));
        for (const supplier of reachableSuppliers) {
          if (wanted <= 0 || supplier.surplus <= 0) continue;
          const amount = Math.min(wanted, supplier.surplus);
          const source = supplier.province.market!.goods[goodId];
          const target = consumer.province.market!.goods[goodId];
          source.stock = round(source.stock - amount);
          source.exported = round(source.exported + amount);
          target.stock = round(target.stock + amount);
          target.imported = round(target.imported + amount);
          supplier.surplus = round(supplier.surplus - amount);
          wanted = round(wanted - amount);
        }
      }
    }
  }

  return result.map(province => {
    const market = province.market!;
    for (const id of ALL_GOODS) {
      const good = market.goods[id];
      const effectiveSupply = good.consumption + good.stock;
      good.shortage = round(Math.max(0, good.demand - effectiveSupply));
      good.price = calculateLocalPrice(id, effectiveSupply, good.demand);
    }
    market.purchasingPower = calculatePurchasingPower(province, market.goods);
    return province;
  });
}

/**
 * Retorna quanto de um bem está disponível para uma província,
 * considerando o estoque local + províncias do mesmo país
 * conectadas por uma rota doméstica válida.
 */
export function getAvailableDomesticStock(
  province: Province,
  goodId: GoodId,
  provinces: Province[],
): number {
  let total = 0;

  for (const candidate of provinces) {
    if (candidate.owner !== province.owner) continue;

    const isLocal = candidate.id === province.id;
    const isConnected =
      isLocal ||
      findDomesticTradePath(candidate.id, province.id, provinces).length > 0;

    if (!isConnected) continue;

    const market = normalizeMarket(candidate.market);
    total += market.goods[goodId].stock;
  }

  return round(total);
}

/**
 * Consome estoque real de um bem da rede doméstica.
 *
 * Ordem:
 * 1. estoque da própria província;
 * 2. demais províncias conectadas do mesmo país;
 * 3. ordem por ID para manter determinismo.
 *
 * Se a rede inteira não possuir estoque suficiente,
 * nenhuma alteração é realizada.
 */
export function consumeDomesticStock(
  provinceId: string,
  goodId: GoodId,
  amount: number,
  provinces: Province[],
): {
  success: boolean;
  provinces: Province[];
  consumed: number;
} {
  if (amount <= 0) {
    return {
      success: true,
      provinces,
      consumed: 0,
    };
  }

  const target = provinces.find(province => province.id === provinceId);

  if (!target) {
    return {
      success: false,
      provinces,
      consumed: 0,
    };
  }

  const available = getAvailableDomesticStock(
    target,
    goodId,
    provinces,
  );

  // Operação atômica:
  // se não houver recurso suficiente, não consome nada.
  if (available < amount) {
    return {
      success: false,
      provinces,
      consumed: 0,
    };
  }

  const reachable = provinces
    .filter(candidate => {
      if (candidate.owner !== target.owner) return false;

      return (
        candidate.id === target.id ||
        findDomesticTradePath(
          candidate.id,
          target.id,
          provinces,
        ).length > 0
      );
    })
    .sort((a, b) => {
      // Estoque local sempre primeiro.
      if (a.id === target.id) return -1;
      if (b.id === target.id) return 1;

      // Depois ordem estável/determinística.
      return a.id.localeCompare(b.id);
    });

  let remaining = amount;

  const updated = provinces.map(province => ({
    ...province,
    market: normalizeMarket(province.market),
  }));

  for (const source of reachable) {
    if (remaining <= 0) break;

    const updatedSource = updated.find(
      province => province.id === source.id,
    );

    if (!updatedSource?.market) continue;

    const good = updatedSource.market.goods[goodId];

    const consumed = Math.min(
      good.stock,
      remaining,
    );

    good.stock = round(good.stock - consumed);
    remaining = round(remaining - consumed);
  }

  return {
    success: remaining <= 0,
    provinces: updated,
    consumed: round(amount - remaining),
  };
}