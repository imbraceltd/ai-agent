import mongoose, { Model, Schema, Document } from "mongoose";

/**
 * Returns a Mongoose model for the given collection name, with no schema enforcement.
 * @param collectionName The name of the MongoDB collection
 */
export function getGenericModel(collectionName: string): Model<Document> {
  // Use a schema-less model (strict: false)
  const schema = new Schema<Record<string, any>>(
    {},
    { strict: false, collection: collectionName }
  );
  return (
    (mongoose.models[collectionName] as Model<Document>) ||
    mongoose.model<Document>(collectionName, schema)
  );
}
