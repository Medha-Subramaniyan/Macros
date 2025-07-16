// seed-meals.js
require('dotenv').config();
const ufnConn = require('./db');

// Import models
const User = require('./models/User');
const Food = require('./models/Food');
const Meal = require('./models/Meal');

async function seedMeals() {
  try {
    console.log('🍴 Starting meal seeding...');
    
    // Connect to database
    await ufnConn.asPromise();
    console.log('✅ Connected to database');
    
    // Get a user to associate meals with
    const user = await User.findOne();
    if (!user) {
      console.log('❌ No users found. Please run seed-users.js first.');
      process.exit(1);
    }
    
    console.log(`👤 Using user: ${user.firstName} ${user.lastName} (${user.email})`);
    
    // Clear existing meals for this user
    await Meal.deleteMany({ user: user._id });
    console.log('🧹 Cleared existing meals');
    
    // Sample meal data
    const mealData = [
      {
        mealTime: 'breakfast',
        date: new Date('2024-01-15T08:00:00Z'),
        foods: [
          {
            foodName: 'Oatmeal',
            calories: 154,
            protein: 5.3,
            carbs: 28,
            fats: 3.2,
            portionSize: '1 cup cooked',
            mealTime: 'breakfast'
          },
          {
            foodName: 'Banana',
            calories: 105,
            protein: 1.3,
            carbs: 27,
            fats: 0.4,
            portionSize: '1 medium',
            mealTime: 'breakfast'
          },
          {
            foodName: 'Greek Yogurt',
            calories: 130,
            protein: 22,
            carbs: 9,
            fats: 0.5,
            portionSize: '1 cup',
            mealTime: 'breakfast'
          }
        ]
      },
      {
        mealTime: 'lunch',
        date: new Date('2024-01-15T12:30:00Z'),
        foods: [
          {
            foodName: 'Grilled Chicken Breast',
            calories: 165,
            protein: 31,
            carbs: 0,
            fats: 3.6,
            portionSize: '1 breast (174g)',
            mealTime: 'lunch'
          },
          {
            foodName: 'Brown Rice',
            calories: 216,
            protein: 4.5,
            carbs: 45,
            fats: 1.8,
            portionSize: '1 cup cooked',
            mealTime: 'lunch'
          },
          {
            foodName: 'Broccoli',
            calories: 55,
            protein: 3.7,
            carbs: 11,
            fats: 0.6,
            portionSize: '1 cup chopped',
            mealTime: 'lunch'
          }
        ]
      },
      {
        mealTime: 'dinner',
        date: new Date('2024-01-15T19:00:00Z'),
        foods: [
          {
            foodName: 'Salmon',
            calories: 208,
            protein: 25,
            carbs: 0,
            fats: 12,
            portionSize: '3 oz fillet',
            mealTime: 'dinner'
          },
          {
            foodName: 'Quinoa',
            calories: 222,
            protein: 8,
            carbs: 39,
            fats: 4,
            portionSize: '1 cup cooked',
            mealTime: 'dinner'
          },
          {
            foodName: 'Asparagus',
            calories: 27,
            protein: 3,
            carbs: 5,
            fats: 0.2,
            portionSize: '1 cup',
            mealTime: 'dinner'
          }
        ]
      },
      {
        mealTime: 'snack',
        date: new Date('2024-01-15T15:30:00Z'),
        foods: [
          {
            foodName: 'Almonds',
            calories: 164,
            protein: 6,
            carbs: 6,
            fats: 14,
            portionSize: '1/4 cup',
            mealTime: 'snack'
          },
          {
            foodName: 'Apple',
            calories: 95,
            protein: 0.5,
            carbs: 25,
            fats: 0.3,
            portionSize: '1 medium',
            mealTime: 'snack'
          }
        ]
      }
    ];
    
    // Create meals with associated foods
    const createdMeals = [];
    
    for (const mealInfo of mealData) {
      // Create food documents first
      const createdFoods = await Promise.all(
        mealInfo.foods.map(food =>
          Food.create({ ...food, user: user._id })
        )
      );
      
      // Create meal document
      const meal = await Meal.create({
        user: user._id,
        mealTime: mealInfo.mealTime,
        date: mealInfo.date,
        foods: createdFoods.map(f => f._id)
      });
      
      // Update foods with meal reference
      await Promise.all(
        createdFoods.map(f => Food.findByIdAndUpdate(f._id, { meal: meal._id }))
      );
      
      createdMeals.push(meal);
      console.log(`✅ Created ${mealInfo.mealTime} meal with ${createdFoods.length} foods`);
    }
    
    // Update user with meals reference
    await User.findByIdAndUpdate(user._id, { 
      $push: { meals: { $each: createdMeals.map(m => m._id) } }
    });
    
    console.log(`\n🎉 Successfully created ${createdMeals.length} meals!`);
    console.log(`📊 Total meals for user: ${createdMeals.length}`);
    
    // Display summary
    for (const meal of createdMeals) {
      const populatedMeal = await Meal.findById(meal._id).populate('foods');
      const totalCalories = populatedMeal.foods.reduce((sum, food) => sum + (food.calories || 0), 0);
      console.log(`   - ${meal.mealTime}: ${populatedMeal.foods.length} foods, ${totalCalories} calories`);
    }
    
  } catch (error) {
    console.error('❌ Error seeding meals:', error);
  } finally {
    await ufnConn.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seeding
seedMeals(); 