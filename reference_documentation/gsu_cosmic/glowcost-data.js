/* gLOWCOST site data — edit THIS file to add detectors, publications, news and media.
   Nothing here is layout; the page reads it as window.GLOWCOST.

   ── To add a detector site ──────────────────────────────────────────────
   Add one entry to SITES, in the region it belongs to. Fields:
     name    directory name
     mapName short label shown on the map marker tooltip (defaults to name)
     place   directory sub-line: city, country, plus any note after an em dash
     since   date or status shown in the directory
     lat/lon decimal degrees, north and east positive
     code    filename stem on the plot server: <code>_pct_Ch_YYYY-MM-DD.png
     kind    "active" (red) | "hub" (green, GSU) | "school"
     extra   optional [[lat, lon], …] for further detectors at the same site
   Then update STATS below if the site or country count changed.

   ── To add a publication / news item / media piece ──────────────────────
   Add an entry at the TOP of PUBLICATIONS, NEWS or MEDIA (newest first).
*/
(function () {
  const REGIONS = [
    ["Americas", "United States · Colombia · Bolivia"],
    ["Europe", "Serbia · Sweden · Türkiye"],
    ["Africa", "Nigeria"],
    ["Asia", "Sri Lanka · Singapore · Japan · India"]
  ];

  const SITES = [
    { region: "Americas", name: "Georgia State University", mapName: "Georgia State University", place: "Atlanta, Georgia, USA", since: "Ongoing · hub", lat: 33.749, lon: -84.388, code: "rm415", kind: "hub" },
    { region: "Americas", name: "Frederick Douglass High School", place: "Atlanta, Georgia, USA", since: "Oct 2024 · school", lat: 33.7701, lon: -84.53, code: "FDschool", kind: "school" },
    { region: "Americas", name: "Mt. Wilson (CHARA)", place: "California, USA", since: "Jun 2023", lat: 34.2257, lon: -118.057, code: "M002", kind: "active" },
    { region: "Americas", name: "Apache Point Observatory", place: "New Mexico, USA", since: "Feb 2024", lat: 32.7803, lon: -105.8203, code: "APO", kind: "active" },
    { region: "Americas", name: "Sky View Middle School", place: "Massachusetts, USA", since: "Dec 2024 · school", lat: 42.52, lon: -71.76, code: "SkyviewMS", kind: "school" },
    { region: "Americas", name: "Mississippi State University", place: "Starkville, Mississippi, USA", since: "Sep 2026", lat: 33.455, lon: -88.789, code: "MSU", kind: "active" },
    { region: "Americas", name: "University of Magdalena", place: "Santa Marta, Colombia", since: "Aug 2023", lat: 11.226, lon: -74.19, code: "SantaMarta", kind: "active" },
    { region: "Americas", name: "Universidad Pública de El Alto (UPEA)", mapName: "UPEA", place: "El Alto, Bolivia", since: "Apr 2026", lat: -16.5, lon: -68.185, code: "UPEA", kind: "active" },
    { region: "Americas", name: "Chacaltaya", mapName: "Chacaltaya (UMSA)", place: "Chacaltaya, Bolivia — managed by UMSA · 5,240 m", since: "Apr 2026", lat: -16.35, lon: -68.13, code: "UMSA", kind: "active" },

    { region: "Europe", name: "Institute of Physics", mapName: "Institute of Physics", place: "Belgrade, Serbia — two detectors", since: "Jun 2024", lat: 44.82, lon: 20.46, code: "Serbia_Det1", kind: "active", extra: [[44.834, 20.476]] },
    { region: "Europe", name: "Bilingual Montessori School of Lund", mapName: "Bilingual Montessori School", place: "Lund, Sweden — northernmost site", since: "Sep 2025", lat: 55.7, lon: 13.19, code: "Lund", kind: "school" },
    { region: "Europe", name: "Istanbul University", place: "Istanbul, Türkiye", since: "Jun 2025", lat: 41.01, lon: 28.96, code: "Istanbul", kind: "active" },
    { region: "Europe", name: "Eastern Anatolia Observatory (DAG)", mapName: "Eastern Anatolia Observatory", place: "Erzurum, Türkiye", since: "Sep 2025", lat: 39.9, lon: 41.27, code: "Erzurum", kind: "active" },

    { region: "Africa", name: "Abuja", place: "Abuja, Nigeria", since: "Apr 2024", lat: 9.06, lon: 7.49, code: "abuja", kind: "active" },

    { region: "Asia", name: "Uva Wellassa University", place: "Badulla, Sri Lanka", since: "Mar 2023 · first intl. site", lat: 6.99, lon: 81.06, code: "uva1", kind: "active" },
    { region: "Asia", name: "University of Colombo", place: "Colombo, Sri Lanka", since: "Mar 2023", lat: 6.92, lon: 79.86, code: "Colombo1", kind: "active" },
    { region: "Asia", name: "Singapore", place: "Singapore", since: "Aug 2023", lat: 1.35, lon: 103.82, code: "singapore", kind: "active" },
    { region: "Asia", name: "Nara Women's University", place: "Nara, Japan", since: "Apr 2025", lat: 34.69, lon: 135.83, code: "Nara", kind: "active" },
    { region: "Asia", name: "Shinshu University", place: "Nagano, Japan", since: "Jun 2025", lat: 36.24, lon: 137.97, code: "Shinshu", kind: "active" },
    { region: "Asia", name: "KL University", place: "Vijayawada, India", since: "Active", lat: 16.44, lon: 80.62, code: "Vijayawada", kind: "active" },
    { region: "Asia", name: "Tripura University", place: "Suryamaninagar, Tripura, India — relocated from Hyderabad", since: "Active", lat: 23.76, lon: 91.26, code: "Hyderabad", kind: "active" },
    { region: "Asia", name: "Indian Institute of Technology Indore", mapName: "IIT Indore", place: "Simrol, Indore, India", since: "2026 · MoU established", lat: 22.52, lon: 75.92, code: "IITIndore", kind: "active" }
  ];

  /* NOTE: the site count and country count are also written out in words in a few
     sentences in gLOWCOST-Site.dc.html (home intro, Team intro, News intro, Support
     banner). Search the page for "twenty-one" and "eleven" when these numbers change. */
  const STATS = [
    { n: "22", l: "Detector sites reporting" },
    { n: "11 / 195", l: "Countries reached — of every country" },
    { n: "5", l: "Continents" },
    { n: "24/7", l: "Continuous monitoring" }
  ];

  const PUBLICATIONS = [
    {
      meta: "Advances in Space Research · online 16 April 2025",
      title: "Time lag analysis of the space weather effects on muon and neutron flux at different geomagnetic cutoff rigidities",
      authors: "A. Mubashir, A. Ashok, M. Connors, X. He, H. A. T. G. Hettiarachchi, P. Martens, E. H. Mudiyanselage, U. A. G. Perera, E. Potdevin, V. M. Sadykov, M. Sarsour, M. Savić, N. Veselinović",
      doi: "10.1016/j.asr.2025.04.032",
      url: "https://doi.org/10.1016/j.asr.2025.04.032"
    },
    {
      meta: "JGR: Space Physics · 20 December 2023",
      title: "Muon flux variations measured by low-cost portable cosmic ray detectors and their correlation with space weather activity",
      authors: "A. Mubashir, A. Ashok, A. G. Bourgeois, Y. T. Chien, M. Connors, E. Potdevin, X. He, P. Martens, A. Mikler, A. G. U. Perera, V. Sadykov, M. Sarsour, D. Sharma, C. Tiwari",
      doi: "10.1029/2023JA031943",
      url: "https://doi.org/10.1029/2023JA031943"
    },
    {
      meta: "IEEE Transactions on Nuclear Science · 68, 2268 · 2021",
      title: "High time-resolution readout integrated circuit using DLL for portable cosmic ray muon detection",
      authors: "S. Chen, T. C. Wei, N. Chen, X. He",
      doi: "",
      url: ""
    },
    {
      meta: "Proceedings of the 37th ICRC · 2021",
      title: "Development and production of modular cosmic ray telescopes",
      authors: "X. He, C. Butler, S. Syed, E. Potdevin, P. Tarrant, N. Chen, T. C. Wei",
      doi: "PoS 395, 1257",
      url: "https://pos.sissa.it/395/1257/pdf"
    }
  ];

  const NEWS = [
    { date: "Jun 2026", title: "Physics Today features the network", body: "\u201cMuon detectors for the people\u201d by Jenessa Duncombe puts gLOWCOST's low-cost, classroom-scale instruments in front of the physics community." },
    { date: "Apr 2026", title: "Two detectors installed in Bolivia", body: "Stations at UPEA in El Alto and at Chacaltaya, managed by UMSA, bring the network to eleven countries and add a high-altitude site to the array." },
    { date: "Sep 2025", title: "Northernmost station comes online in Lund, Sweden", body: "A detector at the Bilingual Montessori School of Lund extends the network's latitude baseline for stratospheric-warming studies." },
    { date: "Apr 2024", title: "Nigeria becomes the first African country on the network", body: "Installed with the National Space Research and Development Agency in Abuja, the station drew national coverage for its role in climate and space-weather research." },
    { date: "Mar 2023", title: "Sri Lanka joins the network", body: "Uva Wellassa University and the University of Colombo host the first international gLOWCOST detectors, opening the collaboration beyond the United States." }
  ];

  const MEDIA = [
    { outlet: "Physics Today", title: "Muon detectors for the people — Jenessa Duncombe · DOI 10.1063/pt.dbe12c79a3", date: "24 Jun 2026", url: "https://physicstoday.aip.org/news/muon-detectors-for-the-people" },
    { outlet: "Innovation News Network", title: "Cosmic-ray detector installed in Bolivia strengthens global space weather network", date: "31 Jul 2026", url: "https://www.innovationnewsnetwork.com/cosmic-ray-detector-installed-in-bolivia-strengthens-global-space-weather-network/71677/" },
    { outlet: "Innovation News Network", title: "Global cosmic ray muon detector network transforms space weather monitoring", date: "26 Feb 2026", url: "https://www.innovationnewsnetwork.com/global-muon-detector-network-advances-space-weather-monitoring/67037/" },
    { outlet: "Innovation News Network", title: "gLOWCOST — a global network of muon detectors for monitoring space and terrestrial weather", date: "Feb 2026", url: "https://www.innovationnewsnetwork.com/partner/glowcost-global-network-muon-detectors-for-monitoring-space-terrestrial-weather/" },
    { outlet: "GSU Research Magazine", title: "Cosmic rays, space weather and larger questions about the universe", date: "Georgia State", url: "https://news.gsu.edu/research-magazine/cosmic-rays-space-weather-and-larger-questions-about-the-universe" },
    { outlet: "Green TV Africa", title: "NASRDA: Nigeria becomes first African country to acquire a cosmic-ray detector", date: "2024", url: "https://greentvafrica.com/nasrda-nigeria-becomes-first-african-country-to-acquire-cosmic-rays-detector/" },
    { outlet: "TheCable", title: "Nigeria acquires cosmic-ray muon detector to aid climate prediction", date: "2024", url: "https://www.thecable.ng/nigeria-acquires-cosmic-ray-muon-detector-to-aid-climate-prediction/" },
    { outlet: "P.M. News Nigeria", title: "Nigeria first in Africa to acquire a cosmic-ray detector, says NASRDA", date: "May 2024", url: "https://pmnewsnigeria.com/2024/05/03/nigeria-becomes-first-country-to-acquire-cosmic-rays-detector-in-africa-nasrda/" },
    { outlet: "Prompt News Online", title: "Nigeria and a U.S. university partner to deepen climate-change research", date: "2024", url: "https://promptnewsonline.com/nasrda-us-varsity-partner-to-deepen-climate-change-research/" },
    { outlet: "The Island (Sri Lanka)", title: "Sri Lanka joins Georgia State University's global cosmic-ray muon detector network", date: "2023", url: "https://island.lk/sl-joins-american-georgia-state-universitys-global-cosmic-ray-muon-detector-network/" }
  ];

  const PEOPLE = [
    { name: "Xiaochun He", role: "Regents Professor, Physics", badge: "Principal contact", badgeColor: "#002d85", email: "xhe@gsu.edu", mailto: "mailto:xhe@gsu.edu" },
    { name: "Ashwin Ashok", role: "Associate Professor, Computer Science", badge: "Co-lead", badgeColor: "#55606f", email: "ashok@gsu.edu", mailto: "mailto:ashok@gsu.edu" },
    { name: "A. G. Unil Perera", role: "Regents Professor, Physics", badge: "Co-lead", badgeColor: "#55606f", email: "uperera@gsu.edu", mailto: "mailto:uperera@gsu.edu" },
    { name: "Viacheslav Sadykov", role: "Assistant Professor, Solar Physics", badge: "Space weather lead", badgeColor: "#55606f", email: "vsadykov@gsu.edu", mailto: "mailto:vsadykov@gsu.edu" },
    { name: "Justin Robinson", role: "Lecturer, Physics", badge: "STEM outreach lead", badgeColor: "#55606f", email: "jrobinson138@gsu.edu", mailto: "mailto:jrobinson138@gsu.edu" }
  ];

  /* ── Institution profiles ───────────────────────────────────────────────
     Shown in the pop-up when a partner is clicked on the Team page.
     Key MUST match the site's `name` in SITES above. Any field may be left
     out — the card simply omits that row. Fields:
       people    [{ name, role }]  key participants at that institution
       interest  one or two sentences: what they work on within gLOWCOST
       notes     anything else useful — instrument count, altitude, host dept.
       codeLabel  overrides the station code shown in the pop-up (the plot files
                  still use `code` from SITES)
       instruments overrides the "Instruments" line, e.g. "Detector hub"
       url       institution or group homepage
       photo     { src, caption } — a group photo or the detector in place.
                 Drop the file in assets/sites/ and point src at it, e.g.
                 { src: "assets/sites/lund.jpg", caption: "Students with the detector" }
                 Omit it and the card shows a labelled placeholder instead.
     `people` and `interest` are the two worth filling in first; a few are
     still placeholders below. */
  const PROFILES = {
    "Georgia State University": {
      people: [
        { name: "Xiaochun He", role: "Regents Professor, Physics — project lead" },
        { name: "Ashwin Ashok", role: "Associate Professor, Computer Science — co-lead" },
        { name: "Viacheslav Sadykov", role: "Assistant Professor — space weather" },
        { name: "Megan Connors", role: "Professor, Physics — STEM outreach" },
        { name: "A. G. Unil Perera", role: "Regents Professor, Physics — co-lead; STEM international" },
        { name: "Murad Sarsour", role: "Professor, Physics — nuclear physics" },
        { name: "Justin Robinson", role: "Lecturer, Physics — STEM outreach lead" },
        { name: "Chi-Kuang Yeh", role: "Assistant Professor, Mathematics & Statistics — statistical analysis" },
        { name: "Talwinder Singh", role: "Assistant Professor, Physics — solar physics" },
        { name: "Maria Misiura", role: "Research Scientist — education assessment" }
      ],
      interest: "Headquarters of the network. Detector design and production, the data pipeline and daily plots, space-weather and atmospheric analysis, and the STEM outreach programme.",
      codeLabel: "GSU",
      instruments: "Detector hub",
      notes: "COSMIC centre, Department of Physics & Astronomy. Hub station rm415.",
      photo: { src: "assets/detector-validation.jpeg", caption: "Detectors on the bench at Georgia State before shipping" },
      url: "https://cosmic.gsu.edu/"
    },
    "Frederick Douglass High School": {
      photo: { src: "assets/sites/frederick-douglass.png", caption: "Students with the detector after installation at Frederick Douglass High School" },
      interest: "Classroom station used for student-led measurement projects and public demonstrations of muon counting.",
      notes: "Atlanta Public Schools — one of the network's two U.S. school sites."
    },
    "Sky View Middle School": {
      photo: { src: "assets/sites/sky-view.png", caption: "Sky View Middle School, and the detector in its STEM classroom" },
      people: [
        { name: "Brittany Juszkiewicz", role: "STEM teacher — site lead" }
      ],
      interest: "Middle-school station; students track the daily count and compare it against space-weather indices.",
      notes: "Northeastern U.S. mid-latitude site."
    },
    "Bilingual Montessori School of Lund": {
      photo: { src: "assets/sites/lund.png", caption: "Handing over the detector at the Bilingual Montessori School of Lund, Skåne" },
      interest: "Highest-latitude station in the network, and therefore the lowest geomagnetic cutoff rigidity — the most sensitive site to solar energetic particle events and to stratospheric warming.",
      notes: "School site, Lund, Sweden."
    },
    "Institute of Physics": {
      photo: { src: "assets/sites/belgrade.png", caption: "The team with both detectors at the Institute of Physics, Belgrade" },
      interest: "Cosmic-ray physics group with long-standing muon and neutron monitor expertise; joint analysis of time-lag between muon and neutron flux at different cutoff rigidities.",
      notes: "Two detectors. Co-authors on the 2025 Advances in Space Research paper.",
      url: "https://www.ipb.ac.rs/"
    },
    "Istanbul University": {
      photo: { src: "assets/sites/istanbul.png", caption: "The team with the detector in the lab at Istanbul University" },
      interest: "Mid-latitude urban station; detector operation and comparison with the Erzurum high-altitude site.",
      notes: "Türkiye — one of two national sites."
    },
    "Eastern Anatolia Observatory (DAG)": {
      photo: { src: "assets/sites/erzurum.png", caption: "The observatory site above Erzurum, eastern Anatolia" },
      interest: "High-altitude observatory station — altitude dependence of the muon flux and atmospheric corrections.",
      notes: "Erzurum, Türkiye. Co-located with an optical observatory."
    },
    "University of Magdalena": {
      photo: { src: "assets/sites/santa-marta.png", caption: "Students around the detector at the University of Magdalena, Santa Marta" },
      interest: "Equatorial-latitude station at high geomagnetic cutoff rigidity, giving the network its low-rigidity-insensitive baseline.",
      notes: "Santa Marta, Colombia."
    },
    "Universidad Pública de El Alto (UPEA)": {
      photo: { src: "assets/sites/upea.png", caption: "The UPEA campus, El Alto, Bolivia" },
      interest: "High-altitude Andean station; muon production as a function of atmospheric depth.",
      notes: "El Alto, Bolivia — installed April 2026."
    },
    "Chacaltaya": {
      photo: { src: "assets/sites/chacaltaya.png", caption: "The gate to the Chacaltaya cosmic physics station, Instituto de Investigaciones Físicas, UMSA" },
      interest: "The network's highest station, on a mountain with a long history of cosmic-ray research — altitude and atmospheric-depth studies.",
      notes: "5,240 m. Managed by Universidad Mayor de San Andrés (UMSA), installed April 2026."
    },
    "Abuja": {
      photo: { src: "assets/sites/abuja.png", caption: "The team with the detector at NASRDA, Abuja" },
      interest: "First African station on the network. Space-weather and climate research with the national space agency.",
      notes: "National Space Research and Development Agency (NASRDA), Abuja, Nigeria.",
      url: "https://nasrda.gov.ng/"
    },
    "Uva Wellassa University": {
      interest: "First international gLOWCOST site. Detector operation and student training in cosmic-ray measurement.",
      notes: "Badulla, Sri Lanka — installed March 2023."
    },
    "University of Colombo": {
      photo: { src: "assets/sites/colombo.png", caption: "The team with the detector at the University of Colombo" },
      interest: "Low-latitude station near sea level, paired with Uva Wellassa for a same-country altitude comparison.",
      notes: "Colombo, Sri Lanka."
    },
    "Nara Women's University": {
      photo: { src: "assets/nara.jpg", caption: "The team with the detector at Nara Women's University" },
      interest: "Detector operation and student research; one of two Japanese sites in the network.",
      notes: "Nara, Japan — installed April 2025."
    },
    "Shinshu University": {
      photo: { src: "assets/sites/shinshu.png", caption: "The team with the detector at Shinshu University, Nagano" },
      interest: "Mountain-region station in Nagano; altitude and seasonal atmospheric effects.",
      notes: "Nagano, Japan — installed June 2025."
    },
    "KL University": {
      photo: { src: "assets/sites/kl-university.png", caption: "Signing the collaboration agreement at KL University, Vijayawada" },
      interest: "Low-latitude station at high cutoff rigidity; detector operation and student projects.",
      notes: "Vijayawada, India."
    },
    "Tripura University": {
      interest: "Northeast Indian station, extending the network's coverage east of the subcontinent toward the Bay of Bengal.",
      notes: "Suryamaninagar, Tripura (West) 799022, India. Detector relocated here from Hyderabad."
    },
    "Indian Institute of Technology Indore": {
      people: [
        { name: "Saurabh Das", role: "Associate Professor and Head, Department of Astronomy, Astrophysics and Space Engineering; Core Faculty, Mehta Family School of Sustainability" }
      ],
      interest: "Central-India station hosted by the Department of Astronomy, Astrophysics and Space Engineering — space-weather and atmospheric studies.",
      notes: "POD 1D 503, Department of Astronomy, Astrophysics and Space Engineering, IIT Indore, Khandwa Road, Simrol, Indore 453552, Madhya Pradesh, India. MoU established.",
      url: "https://www.iiti.ac.in/"
    },
    "Mississippi State University": {
      people: [
        { name: "Wenliang (Bill) Li", role: "Assistant Professor — STEM outreach and cosmic applications" },
        { name: "Lamiaa El Fassi", role: "Associate Professor — network expansion to Morocco" }
      ],
      interest: "Deep-South U.S. station between Atlanta and the western sites, filling a gap in the network's North American coverage.",
      notes: "Starkville, Mississippi — installed 18 September 2026."
    },
    "Mt. Wilson (CHARA)": {
      photo: { src: "assets/sites/mt-wilson.png", caption: "Mount Wilson Observatory, San Gabriel Mountains, California" },
      interest: "Mountain-top station co-located with the CHARA Array; altitude dependence and long-baseline stability.",
      notes: "Operated with the CHARA Array, Mt. Wilson, California.",
      url: "https://www.chara.gsu.edu/"
    },
    "Apache Point Observatory": {
      photo: { src: "assets/sites/apache-point.png", caption: "Apache Point Observatory, Sacramento Mountains, New Mexico" },
      interest: "High-altitude observatory station in New Mexico; reference site for the daily plot format.",
      notes: "2,788 m, Sunspot, New Mexico."
    },
    "Singapore": {
      photo: { src: "assets/sites/singapore.png", caption: "The station's setting: Singapore, on the equator in the Strait of Malacca" },
      interest: "Equatorial station at the highest geomagnetic cutoff rigidity in the network — the least sensitive to solar modulation, and so a control against atmospheric effects.",
      notes: "Singapore — installed August 2023."
    }
  };

  window.GLOWCOST = { REGIONS, SITES, STATS, PUBLICATIONS, NEWS, MEDIA, PEOPLE, PROFILES };
})();
