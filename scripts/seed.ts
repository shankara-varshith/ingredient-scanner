import mongoose from 'mongoose';
import Ingredient from '../src/models/Ingredient';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ingredient-scanner';

const seleniumData = {
  name: 'Selenium',
  description: 'An essential trace mineral that is important for many bodily processes, including cognitive function, a healthy immune system, and fertility.',
  benefits: [
    { category: 'Thyroid Health', description: 'Essential for the proper functioning of the thyroid gland and helps protect it against oxidative damage.' },
    { category: 'Antioxidant', description: 'Acts as a powerful antioxidant, reducing oxidative stress and lowering the risk of certain diseases.' },
    { category: 'Immune System', description: 'Crucial for the health and functioning of the immune system.' }
  ],
  sources: ['Brazil nuts', 'Seafood', 'Organ meats', 'Poultry', 'Eggs', 'Dairy products'],
  risksAndDeficiency: {
    deficiency: 'Can cause Keshan disease (a type of heart disease) and Kashin-Beck disease (a type of arthritis), and is associated with male infertility and immune weakness.',
    excess: 'Selenosis can occur from excessive intake, leading to hair and nail loss, nausea, diarrhea, skin rashes, and nervous system abnormalities.'
  },
  rda: {
    adult: '55 mcg/day',
    specialConditions: '60 mcg/day during pregnancy, 70 mcg/day during lactation.'
  },
  importantNotes: [
    'The amount of selenium in plant-based foods depends on the selenium content of the soil where they were grown.',
    'Just one or two Brazil nuts a day can provide the recommended dietary allowance.'
  ],
  citations: [
    'https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/'
  ]
};

async function seed() {
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // Clear existing
    await Ingredient.deleteMany({ name: 'Selenium' });
    console.log('Cleared existing Selenium data.');

    // Insert new
    await Ingredient.create(seleniumData);
    console.log('Successfully seeded Selenium data.');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seed();
