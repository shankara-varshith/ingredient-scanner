const names = [
  "Stabilizer (170(i))",
  "Thickeners (508 & 412)",
  "Acidity regulators (500(i) & 501(i))",
  "Humectant (451(i))",
  "Hydrolysed groundnut (peanut) protein",
  "Mixed spices {(23.6%) of which (Onion powder, Coriander, Chilli powder (12.7%), Turmeric (11.7%), Garlic powder (10.5%), Cumin, Aniseed, Ginger, Fenugreek, Black pepper (1.5%), Clove (0.5%), Nutmeg and Green cardamom (0.5%))}",
  "Noodle powder (Wheat flour, Palm oil, Salt, Wheat gluten, Stabilizer (170(i)), Thickeners (508 & 412), Acidity regulators (500(i) & 501(i)) and Humectant (451(i)))",
  "Sugar",
  "Edible starch",
  "Acidity regulators (330 & 500(ii))",
  "Thickener (508)",
  "Colour (150d)",
  "Flavour enhancer (635)"
];

for (const name of names) {
  try {
    new RegExp(`^${name}$`, "i");
  } catch (e) {
    console.log("Error with name:", name);
    console.error(e);
  }
}
