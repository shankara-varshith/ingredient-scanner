import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIngredient extends Document {
  name: string;
  description: string;
  benefits: { category: string; description: string }[];
  sources: string[];
  risksAndDeficiency: { deficiency: string; excess: string };
  rda: { adult: string; specialConditions: string };
  importantNotes: string[];
  citations: string[];
}

const IngredientSchema: Schema<IIngredient> = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  benefits: [
    {
      category: { type: String, required: true },
      description: { type: String, required: true },
    },
  ],
  sources: [{ type: String, required: true }],
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
