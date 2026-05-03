import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIngredient extends Document {
  name: string;
  description: string;
  
  // New UI-focused risk categorization
  riskLevel: "Critical risk" | "Moderate concern" | "Safe / beneficial" | "Unknown";
  riskCategory: string; // e.g., "High GI", "Allergen present", "Mostly safe"
  
  // Quantitative metric for progress bar
  metric?: {
    name: string;      // e.g., "Glycaemic Index", "Sodium Level"
    actual: number;    // e.g., 70
    safeLimit: number; // e.g., 55
    maxScale: number;  // For calculating the progress bar width (e.g. 100)
    unit: string;      // e.g., "GI", "mg"
    description: string;
  };

  benefits: { category: string; description: string }[];
  sources: string[];
  risksAndDeficiency?: { deficiency?: string; excess?: string };
  rda?: { adult?: string; specialConditions?: string };
  importantNotes?: string[];
  citations?: string[];
}

const IngredientSchema: Schema<IIngredient> = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  
  riskLevel: { type: String, enum: ["Critical risk", "Moderate concern", "Safe / beneficial", "Unknown"], default: "Unknown" },
  riskCategory: { type: String, default: "Unknown" },
  
  metric: {
    name: { type: String },
    actual: { type: Number },
    safeLimit: { type: Number },
    maxScale: { type: Number },
    unit: { type: String },
    description: { type: String },
  },

  benefits: [
    {
      category: { type: String },
      description: { type: String },
    },
  ],
  sources: [{ type: String }],
  risksAndDeficiency: {
    deficiency: { type: String },
    excess: { type: String },
  },
  rda: {
    adult: { type: String },
    specialConditions: { type: String },
  },
  importantNotes: [{ type: String }],
  citations: [{ type: String }],
}, {
  timestamps: true,
});

const Ingredient: Model<IIngredient> = mongoose.models.Ingredient || mongoose.model<IIngredient>('Ingredient', IngredientSchema);

export default Ingredient;
