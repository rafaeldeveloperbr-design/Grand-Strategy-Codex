/**
 * useCheats.ts - CHEATS PARA TESTES
 */

import { useCallback, useEffect } from 'react';
import { UNIT_DEFINITIONS } from '../../data/units';
import { REBELLION_BALANCE } from '../../engine/rebellion/balance';

import type {
  Army,
  Province,
  Country,
  Recruitment,
  BuildingConstruction,
} from '../../types';

import type { ToastType } from '../../types/toast';

type CheatAPI = {
  addGold: (n: number) => void;
  addManpower: (n: number) => void;
  addAllResources: () => void;
  instantRecruit: () => void;
  instantBuild: () => void;
  spawnArmy: (provinceId?: string) => void;
  setPopulation: (
    amount: number,
    provinceId?: string
  ) => void;
  killAllEnemiesInProvince: () => void;
  winBattles: () => void;
  fastForward: (days?: number) => void;
  godMode: () => void;

  triggerPretenderCrisis: () => void;
  triggerRevolutionaryCrisis: () => void;

  togglePanel?: () => void;
};

declare global {
  interface Window {
    cheats?: CheatAPI;
    cheatPanelOpen?: boolean;
    cheatPanel?: {
      isOpen: boolean;
    };
  }
}

type Params = {
  playerCountryTag: string;

  setAllCountries: React.Dispatch<
    React.SetStateAction<Country[]>
  >;

  setRecruitments: React.Dispatch<
    React.SetStateAction<Recruitment[]>
  >;

  setBuildingConstructions: React.Dispatch<
    React.SetStateAction<BuildingConstruction[]>
  >;

  setArmies: React.Dispatch<
    React.SetStateAction<Army[]>
  >;

  setProvinces: React.Dispatch<
    React.SetStateAction<Province[]>
  >;

  provincesRef: React.MutableRefObject<Province[]>;
  armiesRef: React.MutableRefObject<Army[]>;

  addLog: (msg: string) => void;

  addToast: (
    message: string,
    type?: ToastType,
    title?: string,
    dateString?: string,
    duration?: number
  ) => void;

  setGameSpeed: (n: number) => void;

  setDate: React.Dispatch<
    React.SetStateAction<{
      day: number;
      month: number;
      year: number;
    }>
  >;

  selectedProvince: string | null;
};



export function useCheats(params: Params) {
  const {
    playerCountryTag,
    setAllCountries,
    setRecruitments,
    setBuildingConstructions,
    setArmies,
    setProvinces,
    provincesRef,
    addLog,
    addToast,
    setGameSpeed,
    setDate,
    selectedProvince,
  } = params;

  const addGold = useCallback(
    (amount: number) => {
      setAllCountries(prev =>
        prev.map(country =>
          country.tag === playerCountryTag
            ? {
              ...country,
              resources: {
                ...country.resources,
                gold:
                  country.resources.gold +
                  amount,
              },
            }
            : country
        )
      );

      addToast(
        `💰 +${amount} Ouro (CHEAT)`,
        'success',
        'Cheat'
      );

      addLog(
        `💰 CHEAT: +${amount} ouro`
      );
    },
    [
      playerCountryTag,
      setAllCountries,
      addToast,
      addLog,
    ]
  );

  const addManpower = useCallback(
    (amount: number) => {
      setAllCountries(prev =>
        prev.map(country =>
          country.tag === playerCountryTag
            ? {
              ...country,
              resources: {
                ...country.resources,
                manpower:
                  country.resources.manpower +
                  amount,
              },
            }
            : country
        )
      );

      addToast(
        `👥 +${amount} Manpower (CHEAT)`,
        'success',
        'Cheat'
      );
    },
    [
      playerCountryTag,
      setAllCountries,
      addToast,
    ]
  );

  const addAllResources = useCallback(() => {
    setAllCountries(prev =>
      prev.map(country =>
        country.tag === playerCountryTag
          ? {
            ...country,
            resources: {
              ...country.resources,
              gold:
                country.resources.gold +
                10000,
              manpower:
                country.resources.manpower +
                10000,
              prestige:
                (country.resources.prestige ||
                  0) + 100,
              stability: 100,
            },
          }
          : country
      )
    );

    addToast(
      '💎 Recursos infinitos! (CHEAT)',
      'success',
      'Cheat'
    );
  }, [
    playerCountryTag,
    setAllCountries,
    addToast,
  ]);

  const instantRecruit = useCallback(() => {
    setRecruitments(prev =>
      prev.map(recruitment => ({
        ...recruitment,
        daysRemaining: 0,
      }))
    );

    addToast(
      '⚡ Recrutamentos instantâneos! (CHEAT)',
      'success',
      'Cheat'
    );
  }, [
    setRecruitments,
    addToast,
  ]);

  const instantBuild = useCallback(() => {
    setBuildingConstructions(prev =>
      prev.map(construction => ({
        ...construction,
        daysRemaining: 0,
      }))
    );

    addToast(
      '🏗️ Construções instantâneas! (CHEAT)',
      'success',
      'Cheat'
    );
  }, [
    setBuildingConstructions,
    addToast,
  ]);

  /**
   * Cria um exército compatível com o Military V2.
   *
   * Total:
   * 5.000 infantaria
   * 5.000 cavalaria
   * 5.000 artilharia
   * = 15.000 homens
   */
  const spawnArmy = useCallback(
    (provinceId?: string) => {
      const targetProvince =
        provinceId ||
        selectedProvince ||
        provincesRef.current[0]?.id;

      if (!targetProvince) {
        return;
      }

      const createCheatRegiment = (
        type: Army['regiments'][number]['type']
      ): Army['regiments'][number] => {
        const definition = UNIT_DEFINITIONS[type];

        return {
          type,
          strength: definition.maxStrength,
          maxStrength: definition.maxStrength,
          organization: definition.maxOrganization,
          morale: definition.maxMorale,
          experience: 0,
        };
      };

      const newArmy: Army = {
        id: `cheat_army_${Date.now()}`,
        owner: playerCountryTag,
        name: 'Exército CHEAT',
        regiments: [
          ...Array.from(
            { length: 9 },
            () => createCheatRegiment('infantry')
          ),

          ...Array.from(
            { length: 4 },
            () => createCheatRegiment('cavalry')
          ),

          ...Array.from(
            { length: 2 },
            () => createCheatRegiment('artillery')
          ),

          createCheatRegiment('archers'),
        ],

        location: targetProvince,

        destination: null,
        targetDestination: null,

        movementProgress: 0,
        movementSpeed: 1,

        position: null,
        path: [],

        targetArmyId: null,
        targetProvinceId: null,

        inCombat: false,
      };

      setArmies(prev => [
        ...prev,
        newArmy,
      ]);

      const provinceName =
        provincesRef.current.find(
          province =>
            province.id === targetProvince
        )?.name ?? targetProvince;

      addToast(
        `🪖 Exército CHEAT de 15.000 homens spawnado em ${provinceName}`,
        'success',
        'Cheat'
      );

      console.log(
        `🪖 [CHEAT] Exército Military V2 criado em ${provinceName}`,
        newArmy
      );
    },
    [
      playerCountryTag,
      selectedProvince,
      provincesRef,
      setArmies,
      addToast,
    ]
  );

  const setPopulation = useCallback(
    (
      amount: number,
      provinceId?: string
    ) => {
      const targetProvince =
        provinceId ||
        selectedProvince;

      if (!targetProvince) {
        addToast(
          'Selecione uma província primeiro.',
          'warning',
          'Cheat'
        );

        return;
      }

      const newPopulation =
        Math.max(
          0,
          Math.floor(amount)
        );

      setProvinces(prev =>
        prev.map(province =>
          province.id === targetProvince
            ? {
              ...province,
              population: {
                ...province.population,
                total: newPopulation,
              },
            }
            : province
        )
      );

      const provinceName =
        provincesRef.current.find(
          province =>
            province.id === targetProvince
        )?.name ?? targetProvince;

      addToast(
        `👥 População de ${provinceName}: ${newPopulation.toLocaleString()} (CHEAT)`,
        'success',
        'Cheat'
      );
    },
    [
      selectedProvince,
      setProvinces,
      provincesRef,
      addToast,
    ]
  );

  const killAllEnemiesInProvince =
    useCallback(() => {
      if (!selectedProvince) {
        return;
      }

      setArmies(prev =>
        prev.filter(
          army =>
            !(
              army.location ===
              selectedProvince &&
              army.owner !==
              playerCountryTag
            )
        )
      );

      addToast(
        `💀 Inimigos em ${selectedProvince} eliminados! (CHEAT)`,
        'success',
        'Cheat'
      );
    }, [
      selectedProvince,
      setArmies,
      addToast,
      playerCountryTag,
    ]);

  const winBattles = useCallback(() => {
    addToast(
      '🏆 Todas batalhas vencidas! (CHEAT)',
      'success',
      'Cheat'
    );
  }, [addToast]);

  const fastForward = useCallback(
    (days: number = 30) => {
      setDate(prev => {
        let {
          day,
          month,
          year,
        } = prev;

        day += days;

        while (day > 30) {
          day -= 30;
          month++;
        }

        while (month > 12) {
          month -= 12;
          year++;
        }

        return {
          day,
          month,
          year,
        };
      });

      setGameSpeed(5);

      addToast(
        `⏩ Avançou ${days} dias (CHEAT)`,
        'success',
        'Cheat'
      );
    },
    [
      setDate,
      setGameSpeed,
      addToast,
    ]
  );

  /**
   * Military V2:
   *
   * além dos recursos, restaura:
   * - strength
   * - organization
   * - morale
   *
   * Não altera experiência.
   */
  const godMode = useCallback(() => {
    setAllCountries(prev =>
      prev.map(country =>
        country.tag === playerCountryTag
          ? {
            ...country,

            resources: {
              ...country.resources,

              gold: 999999,
              manpower: 999999,
              prestige: 999,
              stability: 100,
            },

            economy: {
              ...country.economy,
              gdp: 99999,
            },
          }
          : country
      )
    );

    setArmies(prev =>
      prev.map(army =>
        army.owner ===
          playerCountryTag
          ? {
            ...army,

            regiments:
              army.regiments.map(
                regiment => ({
                  ...regiment,

                  strength:
                    regiment.maxStrength ??
                    regiment.strength,

                  organization: 100,
                  morale: 100,
                })
              ),
          }
          : army
      )
    );

    addToast(
      '👑 GOD MODE ATIVADO! Tropas restauradas para o Military V2.',
      'success',
      'Cheat'
    );
  }, [
    playerCountryTag,
    setAllCountries,
    setArmies,
    addToast,
  ]);

  const triggerPretenderCrisis = useCallback(() => {
    setAllCountries(prev =>
      prev.map(country =>
        country.tag === playerCountryTag
          ? {
            ...country,
            resources: {
              ...country.resources,

              stability: 0,
              prestige: -100,
            },

            // Importante:
            // não deixar centralizado para não cair
            // primeiro em revolutionaries.
            activeLaws: {
              ...country.activeLaws,
              governance: 'governance_balanced',
            },
          }
          : country
      )
    );

    addToast(
      `👑 CHEAT: crise de Pretendentes — estabilidade 0, prestígio -100, governança equilibrada`
    );

    addLog(
      '👑 CHEAT: condições para rebelião de Pretendentes ativadas'
    );
  }, [
    playerCountryTag,
    setAllCountries,
    addToast,
    addLog,
  ]);

  const triggerRevolutionaryCrisis = useCallback(() => {
    setAllCountries(prev =>
      prev.map(country =>
        country.tag === playerCountryTag
          ? {
            ...country,

            resources: {
              ...country.resources,

              stability: Math.max(
                0,
                REBELLION_BALANCE.revolutionaryStability - 5
              ),
            },

            activeLaws: {
              ...country.activeLaws,
              governance: 'governance_centralized',
            },
          }
          : country
      )
    );

    addToast(
      '🔥 Crise Revolucionária preparada! Governança centralizada e estabilidade crítica.',
      'warning',
      'Cheat'
    );

    addLog(
      '🔥 CHEAT: condições para rebelião Revolucionária ativadas'
    );
  }, [
    playerCountryTag,
    setAllCountries,
    addToast,
    addLog,
  ]);



  useEffect(() => {
    const handler = (
      event: KeyboardEvent
    ) => {
      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === 'c'
      ) {
        window.cheats?.togglePanel?.();
      }

      if (!window.cheatPanelOpen) {
        return;
      }

      if (event.key === '1') {
        addAllResources();
      }

      if (event.key === '2') {
        instantRecruit();
      }

      if (event.key === '3') {
        instantBuild();
      }

      if (event.key === '4') {
        spawnArmy();
      }

      if (event.key === '5') {
        fastForward(30);
      }

      if (event.key === '6') {
        godMode();
      }

      if (event.key === '7') {
        killAllEnemiesInProvince();
      }
    };

    window.addEventListener(
      'keydown',
      handler
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handler
      );
  }, [
    addAllResources,
    instantRecruit,
    instantBuild,
    spawnArmy,
    fastForward,
    godMode,
    killAllEnemiesInProvince,
  ]);

  useEffect(() => {
    window.cheats = {
      addGold,
      addManpower,
      addAllResources,
      instantRecruit,
      instantBuild,
      spawnArmy,
      setPopulation,
      killAllEnemiesInProvince,
      fastForward,
      godMode,
      winBattles,
      triggerPretenderCrisis,
      triggerRevolutionaryCrisis,
    };

    console.log(
      '🎮 CHEATS ATIVADOS! Digite: cheats.addGold(10000), cheats.godMode() | Ctrl+Shift+C'
    );
  }, [
    addGold,
    addManpower,
    addAllResources,
    instantRecruit,
    instantBuild,
    spawnArmy,
    setPopulation,
    killAllEnemiesInProvince,
    fastForward,
    godMode,
    winBattles,
    triggerPretenderCrisis,
    triggerRevolutionaryCrisis,
  ]);

  return {
    addGold,
    addManpower,
    addAllResources,
    instantRecruit,
    instantBuild,
    spawnArmy,
    setPopulation,
    killAllEnemiesInProvince,
    winBattles,
    fastForward,
    godMode,
    triggerPretenderCrisis,
    triggerRevolutionaryCrisis,
  };
}