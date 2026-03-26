(function () {
  const defaults = {
    feed: 360,
    moisture: 25,
    solids: 50,
    feso4: 25,
    reagentPrice: 0.26,
    electricityPrice: 0.0644,
    heatPrice: 0.03,
    metalPrice: 18.5,
  };

  const K = {
    opHours: 6960,
    lateritePrice: 75,
    labourCost: 85000,
    annualCapitalCharge: 0.10,
    indirectFraction: 0.06,
    miscFraction: 0.30,
    labourOverhead: 1.9,
    jobsPerKt: 23,
    na2so4Bfl: 60,
    feso4Bfl: 3,
    efFeSO4: 0.17036,
    efElec: 0.0575,
    efHeat: 0.07579,
    efNutrient: 0.00105,
    qBioPerL: 0.0843333333,
    eAllocDefault: 2.0659,
    qOvenDefault: 383.95,
    splits: {
      bcl: 340 / 360,
      bfl: 20 / 360,
      attr: 72 / 360,
      fine: 69 / 360,
      heav: 0.6 / 360,
    },
    capexUnits: [
      { base: 0.48, ref: 480, n: 0.60, key: 'wetFeed' },
      { base: 0.62, ref: 72, n: 0.65, key: 'attr' },
      { base: 0.55, ref: 20, n: 0.63, key: 'bfl' },
      { base: 1.10, ref: 0.0224, n: 0.58, key: 'bioleachKtpH' },
    ],
  };

  const fieldMap = {
    feed: 'laterite-feed',
    moisture: 'laterite-moisture',
    solids: 'laterite-solids',
    feso4: 'laterite-feso4',
    reagentPrice: 'laterite-reagent-price',
    electricityPrice: 'laterite-electricity-price',
    heatPrice: 'laterite-heat-price',
    metalPrice: 'laterite-metal-price',
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function readNumber(id) {
    const value = parseFloat(getEl(id).value);
    return Number.isFinite(value) ? value : 0;
  }

  function fmt(value, digits) {
    return Number(value).toLocaleString('en-GB', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function setText(id, value) {
    const el = getEl(id);
    if (el) {
      el.textContent = value;
    }
  }

  const calculateLateriteModel = () => {
    const feed = Math.max(0.001, readNumber(fieldMap.feed));
    const moisture = Math.min(95, Math.max(0, readNumber(fieldMap.moisture)));
    const solids = Math.max(1, readNumber(fieldMap.solids));
    const feso4 = Math.max(0, readNumber(fieldMap.feso4));
    const reagentPrice = Math.max(0, readNumber(fieldMap.reagentPrice));
    const electricityPrice = Math.max(0, readNumber(fieldMap.electricityPrice));
    const heatPrice = Math.max(0, readNumber(fieldMap.heatPrice));
    const metalPrice = Math.max(0, readNumber(fieldMap.metalPrice));

    const moistureFraction = moisture / 100;
    const wetFeed = feed / Math.max(0.05, 1 - moistureFraction);
    const bcl = feed * K.splits.bcl;
    const bfl = feed * K.splits.bfl;
    const attr = feed * K.splits.attr;
    const fine = feed * K.splits.fine;
    const heav = feed * K.splits.heav;
    const mnox = Math.max(0, attr - fine - heav);

    const bioleachVolume = mnox / (solids / 1000);
    const feso4Use = bioleachVolume * feso4 / 1000;
    const qOven = K.qOvenDefault * (feed / 360) * (0.55 + 0.45 * (moisture / 25));
    const eAlloc = K.eAllocDefault * (feed / 360) * (mnox / 2.4);
    const qBioMn = bioleachVolume * K.qBioPerL;
    const bioleachVolumeBfl = bfl / (solids / 1000);
    const qBioBfl = bioleachVolumeBfl * K.qBioPerL;
    const bflNa2so4 = bioleachVolumeBfl * K.na2so4Bfl / 1000;
    const bflFeSo4 = bioleachVolumeBfl * K.feso4Bfl / 1000;

    const gwpFe = feso4Use * K.efFeSO4;
    const gwpElectricity = eAlloc * K.efElec;
    const gwpHeat = qBioMn * K.efHeat;
    const gwpNutrient = bioleachVolume * K.efNutrient;
    const totalGwpPerHour = gwpFe + gwpElectricity + gwpHeat + gwpNutrient;
    const totalGwpPerKgNcl = totalGwpPerHour / feed;

    const sizing = {
      wetFeed,
      attr,
      bfl,
      bioleachKtpH: (mnox + bfl) / 1000,
    };
    const deliveredCost = K.capexUnits.reduce((sum, unit) => {
      const ratio = Math.max(0.05, sizing[unit.key] / unit.ref);
      return sum + unit.base * Math.pow(ratio, unit.n);
    }, 0);
    const totalCapitalInvestment = deliveredCost * 3;

    const reagentTpa = (feso4Use + bflNa2so4 + bflFeSo4) * K.opHours / 1000;
    const totalElectricityMjPerHour = qOven * 0.022 + eAlloc + bioleachVolumeBfl * 0.012;
    const annualElectricityCost = totalElectricityMjPerHour * K.opHours * electricityPrice / 1000000;
    const annualHeatCost = (qBioMn + qBioBfl) * K.opHours * heatPrice / 1000000;
    const annualReagentCost = reagentTpa * reagentPrice / 1000;
    const annualCapitalCharge = totalCapitalInvestment * K.annualCapitalCharge;
    const indirectOpex = annualCapitalCharge * K.indirectFraction;
    const critProductTpa = (mnox + bfl) * K.opHours / 1000;
    const labourOpex = (critProductTpa / 1000) * K.jobsPerKt * K.labourCost * K.labourOverhead / 1000000;
    const feedstockOpex = (feed * K.opHours / 1000) * K.lateritePrice / 1000000;
    const variableOpex = annualReagentCost + annualElectricityCost + annualHeatCost;
    const miscOpex = (indirectOpex + labourOpex + variableOpex) * K.miscFraction;
    const totalOpex = indirectOpex + labourOpex + feedstockOpex + variableOpex + miscOpex;
    const productValue = critProductTpa * metalPrice / 1000;
    const netMargin = productValue - (annualCapitalCharge + totalOpex);

    setText('laterite-wet-feed', `${fmt(wetFeed, 1)} kg/h`);
    setText('laterite-mnox', `${fmt(mnox, 2)} kg/h`);
    setText('laterite-gwp', `${fmt(totalGwpPerKgNcl, 4)} kg CO2e/kg NCL`);
    setText('laterite-net-margin', `${fmt(netMargin, 2)} M$/y`);
    setText('laterite-bcl', `${fmt(bcl, 1)} kg/h`);
    setText('laterite-bfl', `${fmt(bfl, 1)} kg/h`);
    setText('laterite-bioleach-volume', `${fmt(bioleachVolume, 1)} L/h`);
    setText('laterite-feso4-use', `${fmt(feso4Use, 3)} kg/h`);
    setText('laterite-tci', `${fmt(totalCapitalInvestment, 2)} M$`);
    setText('laterite-total-opex', `${fmt(totalOpex, 2)} M$/y`);
    setText('laterite-product-value', `${fmt(productValue, 2)} M$/y`);
    setText('laterite-net-margin-table', `${fmt(netMargin, 2)} M$/y`);

    setText('laterite-gwp-fe', `${fmt(gwpFe, 4)} kg CO2e/h`);
    setText('laterite-gwp-electricity', `${fmt(gwpElectricity, 4)} kg CO2e/h`);
    setText('laterite-gwp-heat', `${fmt(gwpHeat, 4)} kg CO2e/h`);
    setText('laterite-gwp-nutrient', `${fmt(gwpNutrient, 4)} kg CO2e/h`);
    setText('laterite-reagent-opex', `${fmt(annualReagentCost, 3)} M$/y`);
    setText('laterite-electricity-opex', `${fmt(annualElectricityCost, 3)} M$/y`);
    setText('laterite-heat-opex', `${fmt(annualHeatCost, 3)} M$/y`);
    setText('laterite-feedstock-opex', `${fmt(feedstockOpex, 3)} M$/y`);
  };

  function resetDefaults() {
    Object.entries(fieldMap).forEach(([key, id]) => {
      getEl(id).value = defaults[key];
    });
    calculateLateriteModel();
  }

  Object.values(fieldMap).forEach((id) => {
    const el = getEl(id);
    if (el) {
      el.addEventListener('input', calculateLateriteModel);
    }
  });

  const resetButton = getEl('laterite-reset');
  if (resetButton) {
    resetButton.addEventListener('click', resetDefaults);
  }

  calculateLateriteModel();

  window.calculateLateriteModel = calculateLateriteModel;
})();
