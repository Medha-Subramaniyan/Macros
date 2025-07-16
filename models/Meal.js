// models/Meal.js
const { Schema } = require('mongoose');
const ufnConn = require('../db');

const MealSchema = new Schema({
  user:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mealTime: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
  date:     { type: Date, required: true },
  foods:    [{ type: Schema.Types.ObjectId, ref: 'Food' }]
});

module.exports = ufnConn.model('Meal', MealSchema); 