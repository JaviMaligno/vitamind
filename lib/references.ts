/**
 * The site's bibliography, in one place and in one language.
 *
 * These lived in `messages/*.json` under `learn.*.q*.sources`, duplicated
 * across all six locales and byte-identical in every one — because a citation is
 * not prose. Author, year, journal and volume do not translate, so they had no
 * business in a translation file, and keeping six copies meant six chances to
 * drift. Two papers had already drifted into two labels apiece; here each paper
 * is stated once.
 */

export interface Reference {
  label: string;
  url: string;
}

export const REFERENCES = {
  macLaughlin1982: {
    label:
      "MacLaughlin JA, Anderson RR, Holick MF (1982) — Spectral character of sunlight modulates photosynthesis of previtamin D3 and its photoisomers in human skin. Science 216(4549):1001-1003",
    url: "https://pubmed.ncbi.nlm.nih.gov/6281884/",
  },
  young2021: {
    label:
      "Young AR et al. (2021) — A revised action spectrum for vitamin D synthesis by suberythemal UV. PNAS 118(40):e2015867118",
    url: "https://www.pnas.org/doi/10.1073/pnas.2015867118",
  },
  holick2013: {
    label:
      "Holick MF (2013) — Sunlight and Vitamin D: A global perspective for health. Dermato-Endocrinology 5(1):51-108",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3897598/",
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
  tuchinda2006: {
    label:
      "Tuchinda C, Srivannaboon S, Lim HW (2006) — Photoprotection by window glass, automobile glass, and sunglasses. J Am Acad Dermatol 54(5):845-854",
    url: "https://pubmed.ncbi.nlm.nih.gov/16635665/",
  },
  almutawa2013: {
    label:
      "Almutawa F et al. (2013) — Current status of photoprotection by window glass, automobile glass, window films, and sunglasses. Photodermatol Photoimmunol Photomed 29(2):65-72",
    url: "https://onlinelibrary.wiley.com/doi/10.1111/phpp.12022",
  },
  who2002: {
    label:
      "WHO/WMO/UNEP/ICNIRP (2002) — Global Solar UV Index: A Practical Guide. World Health Organization",
    url: "https://www.who.int/publications/i/item/9241590076",
  },
  calbo2005: {
    label:
      "Calbó J, Pagès D, González J-A (2005) — Empirical studies of cloud effects on UV radiation: A review. Reviews of Geophysics 43:RG2002",
    url: "https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2004RG000155",
  },
  mims1994: {
    label: "Mims FM III, Frederick JE (1994) — Cumulus clouds and UV-B. Nature 371:291",
    url: "https://www.nature.com/articles/371291a0",
  },
  matsuoka1987: {
    label:
      "Matsuoka LY, Ide L, Wortsman J, MacLaughlin JA, Holick MF (1987) — Sunscreens suppress cutaneous vitamin D3 synthesis. JCEM 64(6):1165-1168",
    url: "https://pubmed.ncbi.nlm.nih.gov/3033008/",
  },
  matsuoka1988: {
    label:
      "Matsuoka LY, Wortsman J, Hanifan N, Holick MF (1988) — Chronic sunscreen use decreases circulating concentrations of 25-OH-D. Arch Dermatol 124(12):1802-1804",
    url: "https://pubmed.ncbi.nlm.nih.gov/3190255/",
  },
  galvez2015: {
    label:
      "Gálvez ÓD et al. (2015) — Human Hair as a Natural Sun Protection Agent: A Quantitative Study. Photochem Photobiol 91(4):966-970",
    url: "https://pubmed.ncbi.nlm.nih.gov/25682789/",
  },
  huang2020: {
    label:
      "Huang X, Protheroe MD, Al-Jumaily AM, Paul SP, Chalmers AN (2020) — Effect of hair removal on solar UV transmission into skin and implications for melanoma skin cancer development. J Opt Soc Am A 37(5):807-812",
    url: "https://pubmed.ncbi.nlm.nih.gov/32400714/",
  },
  neville2021: {
    label:
      "Neville JJ et al. (2021) — Physical Determinants of Vitamin D Photosynthesis: A Review. JBMR Plus 5(1):e10460",
    url: "https://academic.oup.com/jbmrplus/article/5/1/e10460/7486276",
  },
  schindl2022: {
    label:
      "Schindl A et al. (2022) — Bunsen-Roscoe reciprocity: Is it still valid? Indian J Ophthalmol",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9672781/",
  },
  liu2014: {
    label:
      "Liu D, Fernandez BO, Hamilton A, Lang NN, Gallagher JMC, Newby DE, Feelisch M, Weller RB (2014) — UVA Irradiation of Human Skin Vasodilates Arterial Vasculature and Lowers Blood Pressure Independently of Nitric Oxide Synthase. J Invest Dermatol 134(7):1839-1846",
    url: "https://pubmed.ncbi.nlm.nih.gov/24445737/",
  },
  holick1995: {
    label:
      "Holick MF (1995) — Environmental factors that influence the cutaneous production of vitamin D. Am J Clin Nutr 61(3 Suppl):638S-645S",
    url: "https://pubmed.ncbi.nlm.nih.gov/7879731/",
  },
  holick2007: {
    label: "Holick MF (2007) — Vitamin D Deficiency. NEJM 357:266-281",
    url: "https://www.nejm.org/doi/full/10.1056/NEJMra070553",
  },
  holick1981: {
    label:
      "Holick MF, MacLaughlin JA, Doppelt SH (1981) — Regulation of Cutaneous Previtamin D3 Photosynthesis in Man. Science 211(4482):590-593",
    url: "https://pubmed.ncbi.nlm.nih.gov/6256855/",
  },
  instituteOfMedicine2011: {
    label:
      "Institute of Medicine (2011) — Dietary Reference Intakes for Calcium and Vitamin D. National Academies Press",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK56070/",
  },
  haddad1993: {
    label:
      "Haddad JG, Matsuoka LY, Hollis BW, Hu YZ, Wortsman J (1993) — Human plasma transport of vitamin D after its endogenous synthesis. J Clin Invest 91(6):2552-2555",
    url: "https://pubmed.ncbi.nlm.nih.gov/8390483/",
  },
  tripkovic2012: {
    label:
      "Tripkovic L et al. (2012) — Comparison of vitamin D2 and vitamin D3 supplementation in raising serum 25-hydroxyvitamin D status: a systematic review and meta-analysis. Am J Clin Nutr 95(6):1357-1364",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3349454/",
  },
  heaney2011: {
    label:
      "Heaney RP, Recker RR, Grote J, Horst RL, Armas LAG (2011) — Vitamin D3 Is More Potent Than Vitamin D2 in Humans. JCEM 96(3):E447-E452",
    url: "https://pubmed.ncbi.nlm.nih.gov/21177785/",
  },
  holick2011: {
    label:
      "Holick MF et al. (2011) — Evaluation, Treatment, and Prevention of Vitamin D Deficiency: an Endocrine Society Clinical Practice Guideline. JCEM 96(7):1911-1930",
    url: "https://pubmed.ncbi.nlm.nih.gov/21646368/",
  },
  geleijnse2004: {
    label:
      "Geleijnse JM et al. (2004) — Dietary intake of menaquinone is associated with a reduced risk of coronary heart disease: the Rotterdam Study. J Nutr 134(11):3100-3105",
    url: "https://pubmed.ncbi.nlm.nih.gov/15514282/",
  },
  knapen2013: {
    label:
      "Knapen MH et al. (2013) — Three-year low-dose menaquinone-7 supplementation helps decrease bone loss in healthy postmenopausal women. Osteoporos Int 24(9):2499-2507",
    url: "https://pubmed.ncbi.nlm.nih.gov/23525894/",
  },
  vanBallegooijen2017: {
    label:
      "van Ballegooijen AJ et al. (2017) — The Synergistic Interplay between Vitamins D and K for Bone and Cardiovascular Health: A Narrative Review. Int J Endocrinol 2017:7454376",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5613455/",
  },
  uwitonze2018: {
    label:
      "Uwitonze AM, Razzaque MS (2018) — Role of Magnesium in Vitamin D Activation and Function. J Am Osteopath Assoc 118(3):181-189",
    url: "https://pubmed.ncbi.nlm.nih.gov/29480918/",
  },
  rosanoff2012: {
    label:
      "Rosanoff A, Weaver CM, Rude RK (2012) — Suboptimal magnesium status in the United States: are the health consequences underestimated? Nutr Rev 70(3):153-164",
    url: "https://pubmed.ncbi.nlm.nih.gov/22364157/",
  },
  nihMagnesium: {
    label: "NIH Office of Dietary Supplements — Magnesium: Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/",
  },
  mulligan2010: {
    label:
      "Mulligan GB, Licata A (2010) — Taking vitamin D with the largest meal improves absorption and results in higher serum levels of 25-hydroxyvitamin D. J Bone Miner Res 25(4):928-930",
    url: "https://onlinelibrary.wiley.com/doi/10.1002/jbmr.67",
  },
  dawsonHughes2015: {
    label:
      "Dawson-Hughes B et al. (2015) — Dietary Fat Increases Vitamin D-3 Absorption. J Acad Nutr Diet 115(2):225-230",
    url: "https://pubmed.ncbi.nlm.nih.gov/25441954/",
  },
  lu2007: {
    label:
      "Lu Z et al. (2007) — An evaluation of the vitamin D3 content in fish: Is the vitamin D content adequate to satisfy the dietary requirement for vitamin D? J Steroid Biochem Mol Biol 103(3-5):642-644",
    url: "https://pubmed.ncbi.nlm.nih.gov/17267210/",
  },
  cardwell2018: {
    label:
      "Cardwell G et al. (2018) — A Review of Mushrooms as a Potential Source of Dietary Vitamin D. Nutrients 10(10):1498",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6213178/",
  },
  nihVitaminD: {
    label: "NIH Office of Dietary Supplements — Vitamin D: Health Professional Fact Sheet",
    url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
  },
  abboud2022: {
    label:
      "Abboud M (2022) — Vitamin D Supplementation and Sleep: A Systematic Review and Meta-Analysis of Intervention Studies. Nutrients 14(5):1076",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8912284/",
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
} as const satisfies Record<string, Reference>;

export type ReferenceId = keyof typeof REFERENCES;

/**
 * Which citations back each learn question, keyed `block.question` — the same
 * question number means different questions in different blocks. Questions
 * absent here need no citation.
 */
const BY_QUESTION: Record<string, readonly ReferenceId[]> = {
  "block1.q1": ["macLaughlin1982", "young2021", "holick2013"],
  "block1.q2": ["webb1988", "engelsen2010", "holick2013"],
  "block1.q3": ["tuchinda2006", "almutawa2013", "holick2013"],
  "block1.q4": ["who2002", "engelsen2010", "holick2013"],
  "block1.q5": ["calbo2005", "mims1994", "who2002"],
  "block1.q6": ["matsuoka1987", "matsuoka1988", "holick2013"],
  "block1.q7": ["galvez2015", "huang2020", "neville2021"],
  "block1.q8": ["holick2013", "neville2021", "young2021", "schindl2022"],
  "block1.q9": ["holick2013", "neville2021", "liu2014", "young2021"],
  "block2.q1": ["holick1995", "holick2007", "holick2013"],
  "block2.q2": ["holick1981", "instituteOfMedicine2011", "holick2013"],
  "block2.q3": ["haddad1993", "liu2014", "holick2013"],
  "block2.q4": ["tripkovic2012", "heaney2011", "holick2007"],
  "block2.q5": ["holick2011", "instituteOfMedicine2011", "holick2007"],
  "block3.q1": ["holick2011", "instituteOfMedicine2011", "holick2007"],
  "block3.q2": ["geleijnse2004", "knapen2013", "vanBallegooijen2017"],
  "block3.q3": ["uwitonze2018", "rosanoff2012", "nihMagnesium"],
  "block3.q4": ["mulligan2010", "dawsonHughes2015", "holick2007"],
  "block3.q5": ["lu2007", "cardwell2018", "nihVitaminD"],
  "block3.q6": ["mulligan2010", "abboud2022", "holick2007"],
  "block4.q1": ["liu2014", "lindqvist2016", "weller2016"],
  "block4.q2": ["berson2002", "hattar2002", "wright2013"],
  "block4.q3": ["karu2010", "hamblin2017", "deFreitas2016"],
  "block4.q4": ["hart2011", "munger2006", "holick2013"],
  "block4.q5": ["lambert2002", "golden2005", "wu2013"],
  "block4.q6": ["noaaSolarCalculator"],
  "block4.q8": ["webb1988", "engelsen2010"],
};

export function referencesFor(question: string): Reference[] {
  return (BY_QUESTION[question] ?? []).map((id) => REFERENCES[id]);
}
