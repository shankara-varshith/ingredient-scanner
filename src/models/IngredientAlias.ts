import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIngredientAlias extends Document {
  alias: string;
  matched_name: string;
}

const IngredientAliasSchema: Schema<IIngredientAlias> = new Schema({
  alias: { type: String, required: true, unique: true },
  matched_name: { type: String, required: true },
});

const IngredientAlias: Model<IIngredientAlias> = mongoose.models.IngredientAlias || mongoose.model<IIngredientAlias>('IngredientAlias', IngredientAliasSchema, 'ingredient_aliases');

export default IngredientAlias;
