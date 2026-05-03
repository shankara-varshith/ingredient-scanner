import mongoose from "mongoose";
import dotenv from "dotenv";
import Ingredient from "../src/models/Ingredient";

// Load environment variables
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

const maggiIngredients = [
  {
    name: "Refined wheat flour",
    description: "Highly processed wheat flour lacking fiber and essential nutrients.",
    riskLevel: "Moderate concern",
    riskCategory: "High GI",
    metric: {
      name: "Blood sugar spike",
      actual: 70,
      safeLimit: 55,
      maxScale: 100,
      unit: "Glycaemic Index",
      description: "Refined wheat flour has a GI of ~70 (high). The GI scale: ≤55 = low (safe zone), 56-69 = medium, ≥70 = high. High GI foods cause rapid blood sugar spikes. Diabetics and pre-diabetics should treat this as a caution."
    },
    benefits: [],
    sources: ["Processed grains"],
  },
  {
    name: "Sugar",
    description: "Added sugars can lead to weight gain and metabolic issues.",
    riskLevel: "Moderate concern",
    riskCategory: "Low concern",
    metric: {
      name: "Added Sugar Limit",
      actual: 8,
      safeLimit: 5,
      maxScale: 20,
      unit: "g per serving",
      description: "Excess added sugar contributes to empty calories. Safe limit per meal should be minimized."
    },
    benefits: [],
    sources: ["Sugarcane", "Beets"],
  },
  {
    name: "Wheat gluten",
    description: "A protein found in wheat that gives elasticity to dough.",
    riskLevel: "Moderate concern",
    riskCategory: "Celiac risk",
    benefits: [],
    sources: ["Wheat"],
  },
  {
    name: "Hydrolysed groundnut protein",
    description: "Processed peanut protein used as a flavor enhancer.",
    riskLevel: "Moderate concern",
    riskCategory: "Allergen present",
    benefits: [],
    sources: ["Peanuts"],
  },
  {
    name: "Salt (Sodium)",
    description: "Essential mineral, but excess leads to high blood pressure.",
    riskLevel: "Critical risk",
    riskCategory: "High sodium",
    metric: {
      name: "Sodium content",
      actual: 1100,
      safeLimit: 500,
      maxScale: 1500,
      unit: "mg per serving",
      description: "A single serving contains over half of the recommended daily limit for sodium (2300mg/day)."
    },
    benefits: [],
    sources: ["Sea salt", "Mined salt"],
  },
  {
    name: "Flavour enhancer 635 (Disodium ribonucleotides)",
    description: "Food additive used to create an umami taste.",
    riskLevel: "Critical risk",
    riskCategory: "Allergy trigger",
    benefits: [],
    sources: ["Synthetic"],
  },
  {
    name: "Caramel colour 150d",
    description: "Food coloring often containing 4-MEI, a possible carcinogen.",
    riskLevel: "Critical risk",
    riskCategory: "Carcinogen concern",
    benefits: [],
    sources: ["Synthetic"],
  },
  {
    name: "Mixed spices (turmeric, cumin, coriander, chilli)",
    description: "Natural spices providing flavor and antioxidants.",
    riskLevel: "Safe / beneficial",
    riskCategory: "Mostly safe",
    benefits: [
      { category: "Immunity", description: "Turmeric and cumin contain strong antioxidants." },
      { category: "Digestion", description: "Coriander and cumin aid in digestion." }
    ],
    sources: ["Plants"],
  },
  {
    name: "Acidifying agent 330 (Citric acid)",
    description: "Common preservative and tartness agent.",
    riskLevel: "Safe / beneficial",
    riskCategory: "Trace amount",
    benefits: [],
    sources: ["Citrus fruits", "Synthetic"],
  }
];

async function seedDB() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected successfully.");

    // Clear existing data for a fresh start with the new schema
    console.log("Clearing existing ingredients...");
    await Ingredient.deleteMany({});

    console.log("Seeding new mock data for Maggi Masala Noodles...");
    await Ingredient.insertMany(maggiIngredients);

    console.log("Seeding complete!");
  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

seedDB();
