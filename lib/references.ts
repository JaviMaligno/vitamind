/**
 * The site's bibliography, in one place and in one language.
 *
 * These lived in `messages/*.json` under `learn.block4.q*.sources`, duplicated
 * across all six locales and byte-identical in every one — because a citation is
 * not prose. Author, year, journal and volume do not translate, so they had no
 * business in a translation file, and keeping six copies meant six chances to
 * drift.
 */

export interface Reference {
  label: string;
  url: string;
}

export const REFERENCES = {
  liu2014: {
    label:
      "Liu D, Fernandez BO, Hamilton A, Lang NN, Gallagher JMC, Newby DE, Feelisch M, Weller RB (2014) — UVA Irradiation of Human Skin Vasodilates Arterial Vasculature and Lowers Blood Pressure Independently of Nitric Oxide Synthase. J Invest Dermatol 134(7):1839-1846",
    url: "https://pubmed.ncbi.nlm.nih.gov/24445737/",
  },
  lindqvist2016: {
    label:
      "Lindqvist PG et al. (2016) — Avoidance of sun exposure as a risk factor for major causes of death: a competing risk analysis of the Melanoma in Southern Sweden cohort. J Intern Med 280(4):375-387",
    url: "https://pubmed.ncbi.nlm.nih.gov/26992108/",
  },
  weller2016: {
    label:
      "Weller RB (2016) — Sunlight Has Cardiovascular Benefits Independently of Vitamin D. Blood Purif 41(1-3):130-134",
    url: "https://karger.com/bpu/article/41/1-3/130/328295/",
  },
  berson2002: {
    label:
      "Berson DM, Dunn FA, Takao M (2002) — Phototransduction by retinal ganglion cells that set the circadian clock. Science 295(5557):1070-1073",
    url: "https://pubmed.ncbi.nlm.nih.gov/11834835/",
  },
  hattar2002: {
    label:
      "Hattar S, Liao HW, Takao M, Berson DM, Yau KW (2002) — Melanopsin-containing retinal ganglion cells: architecture, projections, and intrinsic photosensitivity. Science 295(5557):1065-1070",
    url: "https://pubmed.ncbi.nlm.nih.gov/11834834/",
  },
  wright2013: {
    label:
      "Wright KP Jr et al. (2013) — Entrainment of the human circadian clock to the natural light-dark cycle. Curr Biol 23(16):1554-1558",
    url: "https://pubmed.ncbi.nlm.nih.gov/23910656/",
  },
  karu2010: {
    label:
      "Karu TI (2010) — Multiple roles of cytochrome c oxidase in mammalian cells under action of red and IR-A radiation. IUBMB Life 62(8):607-610",
    url: "https://pubmed.ncbi.nlm.nih.gov/20681024/",
  },
  hamblin2017: {
    label:
      "Hamblin MR (2017) — Mechanisms and Mitochondrial Redox Signaling in Photobiomodulation. Photochem Photobiol 94(2):199-212",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5844808/",
  },
  deFreitas2016: {
    label:
      "de Freitas LF, Hamblin MR (2016) — Proposed Mechanisms of Photobiomodulation or Low-Level Light Therapy. IEEE J Sel Top Quantum Electron 22(3):7000417",
    url: "https://pubmed.ncbi.nlm.nih.gov/28070154/",
  },
  hart2011: {
    label:
      "Hart PH, Gorman S, Finlay-Jones JJ (2011) — Modulation of the immune system by UV radiation: more than just the effects of vitamin D? Nat Rev Immunol 11(9):584-596",
    url: "https://www.nature.com/articles/nri3045",
  },
  munger2006: {
    label:
      "Munger KL et al. (2006) — Serum 25-hydroxyvitamin D levels and risk of multiple sclerosis. JAMA 296(23):2832-2838",
    url: "https://pubmed.ncbi.nlm.nih.gov/17179460/",
  },
  holick2013: {
    label:
      "Holick MF (2013) — Sunlight and Vitamin D: A global perspective for health. Dermato-Endocrinology 5(1):51-108",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3897598/",
  },
  lambert2002: {
    label:
      "Lambert GW, Reid C, Kaye DM, Jennings GL, Esler MD (2002) — Effect of sunlight and season on serotonin turnover in the brain. Lancet 360(9348):1840-1842",
    url: "https://pubmed.ncbi.nlm.nih.gov/12480364/",
  },
  golden2005: {
    label:
      "Golden RN et al. (2005) — The efficacy of light therapy in the treatment of mood disorders: a review and meta-analysis. Am J Psychiatry 162(4):656-662",
    url: "https://pubmed.ncbi.nlm.nih.gov/15800134/",
  },
  wu2013: {
    label:
      "Wu PC, Tsai CL, Wu HL, Yang YH, Kuo HK (2013) — Outdoor activity during class recess reduces myopia onset and progression in school children. Ophthalmology 120(5):1080-1085",
    url: "https://pubmed.ncbi.nlm.nih.gov/23462271/",
  },
  noaaSolarCalculator: {
    label: "NOAA Global Monitoring Laboratory — Solar Calculator",
    url: "https://gml.noaa.gov/grad/solcalc/",
  },
  webb1988: {
    label:
      "Webb AR, Kline L, Holick MF (1988) — Influence of season and latitude on the cutaneous synthesis of vitamin D3. J Clin Endocrinol Metab 67(2):373-378",
    url: "https://pubmed.ncbi.nlm.nih.gov/2839537/",
  },
  engelsen2010: {
    label:
      "Engelsen O (2010) — The Relationship between Ultraviolet Radiation Exposure and Vitamin D Status. Nutrients 2(5):482-495",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3257661/",
  },
} as const satisfies Record<string, Reference>;

export type ReferenceId = keyof typeof REFERENCES;

/** Which citations back each learn question. Questions absent here need none. */
const BY_QUESTION: Record<string, readonly ReferenceId[]> = {
  q1: ["liu2014", "lindqvist2016", "weller2016"],
  q2: ["berson2002", "hattar2002", "wright2013"],
  q3: ["karu2010", "hamblin2017", "deFreitas2016"],
  q4: ["hart2011", "munger2006", "holick2013"],
  q5: ["lambert2002", "golden2005", "wu2013"],
  q6: ["noaaSolarCalculator"],
  q8: ["webb1988", "engelsen2010"],
};

export function referencesFor(question: string): Reference[] {
  return (BY_QUESTION[question] ?? []).map((id) => REFERENCES[id]);
}
