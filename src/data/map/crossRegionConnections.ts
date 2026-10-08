/** Define each cross-region land edge ONCE. assembleMap expands it bidirectionally. */
export const crossRegionConnections: readonly (readonly [string,string])[] = [
  ['sa_col_caribe','na_pan_panama'],
  ['eu_fin_helsinki','as_rus_karelia'],
  ['eu_fin_lapland','as_rus_karelia'],
  ['eu_est_tallinn','as_rus_western_russia'],
  ['eu_lva_riga','as_rus_western_russia'],
  ['eu_blr_minsk','as_rus_western_russia'],
  ['eu_ukr_kyiv','as_rus_western_russia'],
  ['eu_ukr_eastern_ukraine','as_rus_southern_russia'],
  ['eu_bgr_sofia','as_tur_thrace'],
  ['eu_grc_macedonia','as_tur_thrace'],
  ['af_egy_cairo','as_isr_jerusalem'],
];
