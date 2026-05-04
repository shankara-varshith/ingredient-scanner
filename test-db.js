const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const IngredientSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  riskLevel: { type: String, default: "Unknown" },
  riskCategory: { type: String, default: "Unknown" },
});
const Ingredient = mongoose.models.Ingredient || mongoose.model('Ingredient', IngredientSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const ingredients = ["Wheat flour", "Palm oil", "Salt", "Turmeric", "Cumin", "Ginger", "Black pepper"];
  
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  };

  const regexQueries = ingredients.map((name) => ({
    name: { $regex: new RegExp(`\\b${escapeRegExp(name)}\\b`, "i") }
  }));

  console.log(JSON.stringify(regexQueries, null, 2));

  const results = await Ingredient.find({
    $or: regexQueries
  });

  console.log("Results found:", results.length);
  results.forEach(r => console.log(r.name, r.riskLevel));

  await mongoose.disconnect();
}
run();
