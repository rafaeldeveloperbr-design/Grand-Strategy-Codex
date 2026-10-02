import { useRef, useEffect } from 'react'
import type { Province, Country, Army, Recruitment, BuildingConstruction, ActiveBattle } from '../types'
import type { War, DiplomaticRelation } from '../types/diplomacy'
import type { CountryTechState } from '../types/technology'
import type { GameDate } from '../types/date'
import type { AIDifficulty } from '../types/difficulty'

type Props = {
  provinces: Province[]
  allCountries: Country[]
  armies: Army[]
  recruitments: Recruitment[]
  wars: War[]
  diplomaticRelations: DiplomaticRelation[]
  date: GameDate
  buildingConstructions: BuildingConstruction[]
  playerTechState: CountryTechState
  botTechStates: Map<string, CountryTechState>
  aiDifficulty: AIDifficulty
  activeBattles: ActiveBattle[]
}

export function useGameRefs(props: Props) {
  const gameLoopRef = useRef<number | null>(null)
  const provincesRef = useRef(props.provinces)
  const countriesRef = useRef(props.allCountries)
  const armiesRef = useRef(props.armies)
  const recruitmentsRef = useRef(props.recruitments)
  const warsRef = useRef(props.wars)
  const diplomaticRelationsRef = useRef(props.diplomaticRelations)
  const dateRef = useRef(props.date)
  const buildingConstructionsRef = useRef(props.buildingConstructions)
  const playerTechStateRef = useRef(props.playerTechState)
  const botTechStatesRef = useRef(props.botTechStates)
  const aiDifficultyRef = useRef(props.aiDifficulty)
  const activeBattlesRef = useRef(props.activeBattles)
  const ceilingLogRef = useRef<Set<string>>(new Set())

  useEffect(() => { provincesRef.current = props.provinces }, [props.provinces])
  useEffect(() => { countriesRef.current = props.allCountries }, [props.allCountries])
  useEffect(() => { armiesRef.current = props.armies }, [props.armies])
  useEffect(() => { recruitmentsRef.current = props.recruitments }, [props.recruitments])
  useEffect(() => { warsRef.current = props.wars }, [props.wars])
  useEffect(() => { diplomaticRelationsRef.current = props.diplomaticRelations }, [props.diplomaticRelations])
  useEffect(() => { dateRef.current = props.date }, [props.date])
  useEffect(() => { buildingConstructionsRef.current = props.buildingConstructions }, [props.buildingConstructions])
  useEffect(() => { playerTechStateRef.current = props.playerTechState }, [props.playerTechState])
  useEffect(() => { botTechStatesRef.current = props.botTechStates }, [props.botTechStates])
  useEffect(() => { aiDifficultyRef.current = props.aiDifficulty }, [props.aiDifficulty])
  useEffect(() => { activeBattlesRef.current = props.activeBattles }, [props.activeBattles])

  return {
    gameLoopRef,
    provincesRef,
    countriesRef,
    armiesRef,
    recruitmentsRef,
    warsRef,
    diplomaticRelationsRef,
    dateRef,
    buildingConstructionsRef,
    playerTechStateRef,
    botTechStatesRef,
    aiDifficultyRef,
    activeBattlesRef,
    ceilingLogRef
  }
}