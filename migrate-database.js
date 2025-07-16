// migrate-database.js - Database migration for meal tracking system
require('dotenv').config();
const ufnConn = require('./db');

// Import models
const User = require('./models/User');
const Food = require('./models/Food');
const Meal = require('./models/Meal');
const Post = require('./models/Post');

async function migrateDatabase() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Connect to database
    await ufnConn.asPromise();
    console.log('✅ Connected to database');
    
    // 1. Ensure all foods have mealTime field
    console.log('🔧 Checking food mealTime fields...');
    const foodsWithoutMealTime = await Food.find({ mealTime: { $exists: false } });
    if (foodsWithoutMealTime.length > 0) {
      console.log(`⚠️  Found ${foodsWithoutMealTime.length} foods without mealTime, setting default...`);
      await Food.updateMany(
        { mealTime: { $exists: false } },
        { mealTime: 'breakfast' }
      );
      console.log('✅ Updated foods with default mealTime');
    } else {
      console.log('✅ All foods have mealTime field');
    }
    
    // 2. Ensure all foods have date field
    console.log('🔧 Checking food date fields...');
    const foodsWithoutDate = await Food.find({ date: { $exists: false } });
    if (foodsWithoutDate.length > 0) {
      console.log(`⚠️  Found ${foodsWithoutDate.length} foods without date, setting to createdAt...`);
      await Food.updateMany(
        { date: { $exists: false } },
        [{ $set: { date: '$createdAt' } }]
      );
      console.log('✅ Updated foods with date field');
    } else {
      console.log('✅ All foods have date field');
    }
    
    // 3. Create meals for foods that don't have meal references
    console.log('🔧 Checking for orphaned foods...');
    const orphanedFoods = await Food.find({ meal: { $exists: false } });
    if (orphanedFoods.length > 0) {
      console.log(`⚠️  Found ${orphanedFoods.length} foods without meal references`);
      
      // Group foods by user, date, and mealTime
      const foodGroups = {};
      orphanedFoods.forEach(food => {
        const key = `${food.user}_${food.date.toDateString()}_${food.mealTime}`;
        if (!foodGroups[key]) {
          foodGroups[key] = [];
        }
        foodGroups[key].push(food);
      });
      
      // Create meals for each group
      for (const [key, foods] of Object.entries(foodGroups)) {
        if (foods.length > 0) {
          const firstFood = foods[0];
          
          // Create meal
          const meal = await Meal.create({
            user: firstFood.user,
            mealTime: firstFood.mealTime,
            date: firstFood.date,
            foods: foods.map(f => f._id)
          });
          
          // Update foods with meal reference
          await Food.updateMany(
            { _id: { $in: foods.map(f => f._id) } },
            { meal: meal._id }
          );
          
          console.log(`✅ Created meal for ${foods.length} foods (${firstFood.mealTime})`);
        }
      }
    } else {
      console.log('✅ All foods have meal references');
    }
    
    // 4. Update user meals arrays
    console.log('🔧 Updating user meals arrays...');
    const users = await User.find();
    for (const user of users) {
      const userMeals = await Meal.find({ user: user._id });
      const mealIds = userMeals.map(m => m._id);
      
      await User.findByIdAndUpdate(user._id, { meals: mealIds });
    }
    console.log(`✅ Updated meals arrays for ${users.length} users`);
    
    // 5. Validate data integrity
    console.log('🔍 Validating data integrity...');
    
    // Check for orphaned meals
    const orphanedMeals = await Meal.find({
      $or: [
        { user: { $exists: false } },
        { foods: { $size: 0 } }
      ]
    });
    
    if (orphanedMeals.length > 0) {
      console.log(`⚠️  Found ${orphanedMeals.length} orphaned meals, cleaning up...`);
      await Meal.deleteMany({ _id: { $in: orphanedMeals.map(m => m._id) } });
      console.log('✅ Cleaned up orphaned meals');
    }
    
    // Check for orphaned posts
    const orphanedPosts = await Post.find({
      $or: [
        { user: { $exists: false } },
        { meal: { $exists: false } }
      ]
    });
    
    if (orphanedPosts.length > 0) {
      console.log(`⚠️  Found ${orphanedPosts.length} orphaned posts, cleaning up...`);
      await Post.deleteMany({ _id: { $in: orphanedPosts.map(p => p._id) } });
      console.log('✅ Cleaned up orphaned posts');
    }
    
    // 6. Create indexes for better performance
    console.log('🔧 Creating database indexes...');
    
    // Food indexes
    await Food.collection.createIndex({ user: 1, date: -1 });
    await Food.collection.createIndex({ user: 1, mealTime: 1 });
    await Food.collection.createIndex({ meal: 1 });
    
    // Meal indexes
    await Meal.collection.createIndex({ user: 1, date: -1 });
    await Meal.collection.createIndex({ user: 1, mealTime: 1 });
    
    // Post indexes
    await Post.collection.createIndex({ user: 1, date: -1 });
    await Post.collection.createIndex({ meal: 1 });
    
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    
    console.log('✅ Created database indexes');
    
    // 7. Generate migration report
    console.log('\n📊 Migration Report:');
    
    const totalUsers = await User.countDocuments();
    const totalFoods = await Food.countDocuments();
    const totalMeals = await Meal.countDocuments();
    const totalPosts = await Post.countDocuments();
    
    console.log(`   • Users: ${totalUsers}`);
    console.log(`   • Foods: ${totalFoods}`);
    console.log(`   • Meals: ${totalMeals}`);
    console.log(`   • Posts: ${totalPosts}`);
    
    // Check meal distribution
    const mealDistribution = await Meal.aggregate([
      { $group: { _id: '$mealTime', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('   • Meal distribution:');
    mealDistribution.forEach(item => {
      console.log(`     - ${item._id}: ${item.count} meals`);
    });
    
    console.log('\n✅ Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await ufnConn.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
migrateDatabase(); 