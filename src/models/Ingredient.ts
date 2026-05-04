import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIngredient extends Document {
  name: string;
  category: string;
  severity: "critical" | "warn" | "ok" | "benefit";
  tag: string;
  description: string;

  dosage?: {
    unit: string;
    typical_in_product: number;
    rda?: number;
    safe_upper_limit?: number;
    tolerable_upper_limit?: number;
    toxicity_threshold?: number | null;
    pct_of_safe_limit?: number;
    authority?: string;
    special_conditions?: Record<string, number>;
  };

  risks?: {
    label: string;
    actual: number;
    safe: number;
    max: number;
    unit: string;
    pct: number;
    severity_level: "high" | "medium" | "low";
    exceeds_safe: boolean;
    context: string;
    citation?: string;
  }[];

  benefits?: {
    label: string;
    category: string;
    actual: number;
    safe: number;
    max: number;
    unit: string;
    pct: number;
    context: string;
    citation?: string;
  }[];

  sources?: string[];
  risksAndDeficiency?: { deficiency?: string; excess?: string };
  importantNotes?: string[];
  citations?: string[];
}

const IngredientSchema: Schema<IIngredient> = new Schema({
  name: { type: String, required: true, unique: true },
  category: { type: String, default: "compound" },
  severity: { type: String, enum: ["critical", "warn", "ok", "benefit"], default: "ok" },
  tag: { type: String },
  description: { type: String, required: true },
  
  dosage: {
    unit: { type: String },
    typical_in_product: { type: Number },
    rda: { type: Number },
    safe_upper_limit: { type: Number },
    tolerable_upper_limit: { type: Number },
    toxicity_threshold: { type: Number },
    pct_of_safe_limit: { type: Number },
    authority: { type: String },
    special_conditions: { type: Map, of: Number },
  },

  risks: [
    {
      label: { type: String },
      actual: { type: Number },
      safe: { type: Number },
      max: { type: Number },
      unit: { type: String },
      pct: { type: Number },
      severity_level: { type: String, enum: ["high", "medium", "low"] },
      exceeds_safe: { type: Boolean },
      context: { type: String },
      citation: { type: String },
    },
  ],

  benefits: [
    {
      label: { type: String },
      category: { type: String },
      actual: { type: Number },
      safe: { type: Number },
      max: { type: Number },
      unit: { type: String },
      pct: { type: Number },
      context: { type: String },
      citation: { type: String },
    },
  ],

  sources: [{ type: String }],
  risksAndDeficiency: {
    deficiency: { type: String },
    excess: { type: String },
  },
  importantNotes: [{ type: String }],
  citations: [{ type: String }],
}, {
  timestamps: true,
});

const Ingredient: Model<IIngredient> = mongoose.models.Ingredient || mongoose.model<IIngredient>('Ingredient', IngredientSchema, 'ingredients_new');

export default Ingredient;
