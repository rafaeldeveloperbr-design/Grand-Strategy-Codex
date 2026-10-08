import type { ProvinceTopology } from '../../types';
import { definitions } from './definitions';

/** Authored land borders only. No Bosporus bridge or inter-island crossing. */
const landConnections: readonly (readonly [string,string])[] = [
  ['rus_moscow','rus_western_russia'], ['rus_moscow','rus_karelia'], ['rus_moscow','rus_southern_russia'], ['rus_moscow','rus_urals'],
  ['rus_western_russia','rus_karelia'], ['rus_karelia','rus_urals'], ['rus_southern_russia','rus_urals'],
  ['rus_urals','rus_western_siberia'], ['rus_western_siberia','rus_central_siberia'],
  ['rus_central_siberia','rus_baikal'], ['rus_central_siberia','rus_yakutia'], ['rus_baikal','rus_yakutia'], ['rus_baikal','rus_far_east'], ['rus_yakutia','rus_far_east'],
  ['rus_southern_russia','geo_tbilisi'], ['rus_southern_russia','aze_baku'], ['rus_southern_russia','kaz_western_kazakhstan'],
  ['rus_urals','kaz_astana'], ['rus_urals','kaz_western_kazakhstan'], ['rus_western_siberia','kaz_astana'],
  ['rus_western_siberia','chn_xinjiang'], ['rus_western_siberia','mng_ulaanbaatar'], ['rus_central_siberia','mng_ulaanbaatar'],
  ['rus_baikal','mng_ulaanbaatar'], ['rus_baikal','chn_manchuria'], ['rus_far_east','chn_manchuria'], ['rus_far_east','prk_pyongyang'],
  ['tur_ankara','tur_eastern_anatolia'], ['tur_ankara','syr_damascus'], ['tur_eastern_anatolia','syr_damascus'],
  ['tur_eastern_anatolia','geo_tbilisi'], ['tur_eastern_anatolia','arm_yerevan'], ['tur_eastern_anatolia','irn_zagros'], ['tur_eastern_anatolia','irq_baghdad'],
  ['geo_tbilisi','arm_yerevan'], ['geo_tbilisi','aze_baku'], ['arm_yerevan','aze_baku'], ['arm_yerevan','irn_tehran'], ['arm_yerevan','irn_zagros'], ['aze_baku','irn_tehran'],
  ['irn_tehran','irn_zagros'], ['irn_tehran','irn_eastern_iran'], ['irn_zagros','irn_eastern_iran'],
  ['irn_tehran','tkm_ashgabat'], ['irn_zagros','irq_baghdad'], ['irn_eastern_iran','tkm_ashgabat'], ['irn_eastern_iran','afg_kabul'], ['irn_eastern_iran','pak_baluchistan'],
  ['irq_baghdad','syr_damascus'], ['irq_baghdad','jor_amman'], ['irq_baghdad','sau_riyadh'], ['syr_damascus','isr_jerusalem'], ['syr_damascus','jor_amman'],
  ['isr_jerusalem','jor_amman'], ['jor_amman','sau_hejaz'], ['sau_riyadh','sau_hejaz'], ['sau_riyadh','yem_sanaa'], ['sau_riyadh','omn_muscat'], ['sau_hejaz','yem_sanaa'], ['yem_sanaa','omn_muscat'],
  ['kaz_astana','kaz_western_kazakhstan'], ['kaz_astana','uzb_tashkent'], ['kaz_astana','kgz_bishkek'], ['kaz_astana','chn_xinjiang'],
  ['kaz_western_kazakhstan','uzb_tashkent'], ['kaz_western_kazakhstan','tkm_ashgabat'], ['uzb_tashkent','tkm_ashgabat'], ['uzb_tashkent','kgz_bishkek'], ['uzb_tashkent','tjk_dushanbe'], ['uzb_tashkent','afg_kabul'],
  ['tkm_ashgabat','afg_kabul'], ['kgz_bishkek','tjk_dushanbe'], ['kgz_bishkek','chn_xinjiang'], ['tjk_dushanbe','afg_kabul'], ['tjk_dushanbe','chn_xinjiang'],
  ['afg_kabul','pak_islamabad'], ['afg_kabul','pak_baluchistan'], ['afg_kabul','chn_xinjiang'], ['pak_islamabad','pak_baluchistan'],
  ['pak_islamabad','ind_punjab'], ['pak_islamabad','chn_xinjiang'], ['pak_baluchistan','ind_punjab'], ['pak_baluchistan','ind_western_india'],
  ['ind_delhi','ind_punjab'], ['ind_delhi','ind_gangetic_plain'], ['ind_delhi','ind_western_india'], ['ind_punjab','ind_western_india'],
  ['ind_gangetic_plain','ind_deccan'], ['ind_gangetic_plain','ind_eastern_india'], ['ind_western_india','ind_deccan'],
  ['ind_delhi','npl_kathmandu'], ['ind_gangetic_plain','npl_kathmandu'], ['ind_gangetic_plain','bgd_dhaka'], ['ind_eastern_india','bgd_dhaka'],
  ['ind_delhi','chn_tibet'], ['ind_punjab','chn_tibet'], ['ind_punjab','chn_xinjiang'], ['ind_gangetic_plain','chn_tibet'],
  ['ind_eastern_india','chn_tibet'], ['ind_eastern_india','chn_sichuan'], ['ind_eastern_india','mmr_naypyidaw'], ['ind_eastern_india','mmr_northern_myanmar'],
  ['npl_kathmandu','chn_tibet'], ['bgd_dhaka','mmr_naypyidaw'],
  ['chn_beijing','chn_manchuria'], ['chn_beijing','chn_central_china'], ['chn_beijing','chn_sichuan'],
  ['chn_xinjiang','chn_tibet'], ['chn_xinjiang','chn_sichuan'], ['chn_tibet','chn_sichuan'],
  ['chn_sichuan','chn_central_china'], ['chn_sichuan','chn_southern_china'], ['chn_central_china','chn_southern_china'], ['chn_central_china','chn_coastal_china'], ['chn_southern_china','chn_coastal_china'],
  ['chn_beijing','mng_ulaanbaatar'], ['chn_manchuria','mng_ulaanbaatar'], ['chn_xinjiang','mng_ulaanbaatar'], ['chn_sichuan','mng_ulaanbaatar'],
  ['chn_manchuria','prk_pyongyang'], ['prk_pyongyang','kor_seoul'],
  ['chn_sichuan','mmr_northern_myanmar'], ['chn_southern_china','mmr_naypyidaw'], ['chn_southern_china','mmr_northern_myanmar'], ['chn_southern_china','lao_vientiane'], ['chn_southern_china','vnm_hanoi'],
  ['jpn_kanto','jpn_kansai'], ['mmr_naypyidaw','mmr_northern_myanmar'], ['mmr_naypyidaw','tha_bangkok'], ['mmr_naypyidaw','tha_southern_thailand'], ['mmr_naypyidaw','lao_vientiane'],
  ['tha_bangkok','tha_southern_thailand'], ['tha_bangkok','lao_vientiane'], ['tha_bangkok','khm_phnom_penh'], ['tha_southern_thailand','mys_kuala_lumpur'],
  ['lao_vientiane','khm_phnom_penh'], ['lao_vientiane','vnm_hanoi'], ['lao_vientiane','vnm_southern_vietnam'], ['khm_phnom_penh','vnm_southern_vietnam'], ['vnm_hanoi','vnm_southern_vietnam'],
];

export const provinceTopology: ProvinceTopology[] = definitions.map(([id]) => ({
  id, neighbors: landConnections.flatMap(([a,b]) => `as_${a}` === id ? [`as_${b}`] : `as_${b}` === id ? [`as_${a}`] : []),
}));
