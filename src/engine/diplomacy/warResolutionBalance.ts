export const WAR_RESOLUTION_BALANCE = {
  scoreMin: -100, scoreMax: 100, surrenderThreshold: 100,
  scoreTerritory: 50, scoreCapital: 25, scoreMilitary: 25,
  surrenderTerritory: 60, surrenderCapital: 20, surrenderCasualties: 10, surrenderMilitary: 20,
  percent: 100, aiDefensiveScore: -50, aiDefensiveSurrender: 60,
  aiCautiousAttackRatio: 1.5,
} as const;
