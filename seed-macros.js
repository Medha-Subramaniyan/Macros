// seed-macros.js - Comprehensive seeding for Macros project
require('dotenv').config();
const ufnConn = require('./db');

// Import models
const User = require('./models/User');
const Food = require('./models/Food');
const Meal = require('./models/Meal');
const Post = require('./models/Post');
const Network = require('./models/Network');

async function seedMacros() {
  try {
    console.log('🌱 Starting Macros project seeding...');
    
    // Connect to database
    await ufnConn.asPromise();
    console.log('✅ Connected to database');
    
    // 1. Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Food.deleteMany({});
    await Meal.deleteMany({});
    await Post.deleteMany({});
    await Network.deleteMany({});
    
    // 2. Create users
    console.log('👥 Creating users...');
    const users = await User.create([
      {
        firstName: 'Medha',
        lastName: 'Subramaniyan',
        email: 'medha@macros.com',
        password: 'password123',
        bio: 'Database Manager for Macros project'
      },
      {
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'alice@macros.com',
        password: 'password123',
        bio: 'Frontend Developer'
      },
      {
        firstName: 'Bob',
        lastName: 'Brown',
        email: 'bob@macros.com',
        password: 'password123',
        bio: 'Backend Developer'
      }
    ]);
    
    console.log(`✅ Created ${users.length} users`);
    
    // 3. Create sample foods
    console.log('🍎 Creating sample foods...');
    const sampleFoods = [
      // Breakfast foods
      { foodName: 'Oatmeal', calories: 154, protein: 5.3, carbs: 28, fats: 3.2, portionSize: '1 cup cooked', mealTime: 'breakfast' },
      { foodName: 'Greek Yogurt', calories: 130, protein: 22, carbs: 9, fats: 0.5, portionSize: '1 cup', mealTime: 'breakfast' },
      { foodName: 'Banana', calories: 105, protein: 1.3, carbs: 27, fats: 0.4, portionSize: '1 medium', mealTime: 'breakfast' },
      { foodName: 'Eggs', calories: 140, protein: 12, carbs: 0, fats: 10, portionSize: '2 large', mealTime: 'breakfast' },
      
      // Lunch foods
      { foodName: 'Grilled Chicken Breast', calories: 165, protein: 31, carbs: 0, fats: 3.6, portionSize: '1 breast (174g)', mealTime: 'lunch' },
      { foodName: 'Brown Rice', calories: 216, protein: 4.5, carbs: 45, fats: 1.8, portionSize: '1 cup cooked', mealTime: 'lunch' },
      { foodName: 'Broccoli', calories: 55, protein: 3.7, carbs: 11, fats: 0.6, portionSize: '1 cup chopped', mealTime: 'lunch' },
      { foodName: 'Salad Greens', calories: 20, protein: 2, carbs: 4, fats: 0, portionSize: '2 cups', mealTime: 'lunch' },
      
      // Dinner foods
      { foodName: 'Salmon', calories: 208, protein: 25, carbs: 0, fats: 12, portionSize: '3 oz fillet', mealTime: 'dinner' },
      { foodName: 'Quinoa', calories: 222, protein: 8, carbs: 39, fats: 4, portionSize: '1 cup cooked', mealTime: 'dinner' },
      { foodName: 'Asparagus', calories: 27, protein: 3, carbs: 5, fats: 0.2, portionSize: '1 cup', mealTime: 'dinner' },
      { foodName: 'Sweet Potato', calories: 103, protein: 2, carbs: 24, fats: 0, portionSize: '1 medium', mealTime: 'dinner' },
      
      // Snack foods
      { foodName: 'Almonds', calories: 164, protein: 6, carbs: 6, fats: 14, portionSize: '1/4 cup', mealTime: 'snack' },
      { foodName: 'Apple', calories: 95, protein: 0.5, carbs: 25, fats: 0.3, portionSize: '1 medium', mealTime: 'snack' },
      { foodName: 'Protein Shake', calories: 120, protein: 25, carbs: 3, fats: 1, portionSize: '1 scoop', mealTime: 'snack' }
    ];
    
    // 4. Create meals for each user
    console.log('🍴 Creating meals...');
    const mealTimes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const createdMeals = [];
    
    for (const user of users) {
      for (let i = 0; i < 2; i++) { // Create 2 days of meals per user
        const date = new Date();
        date.setDate(date.getDate() - i); // Today and yesterday
        
        for (const mealTime of mealTimes) {
          // Select 2-4 random foods for this meal
          const mealFoods = sampleFoods
            .filter(food => food.mealTime === mealTime)
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.floor(Math.random() * 3) + 2); // 2-4 foods
          
          if (mealFoods.length > 0) {
            // Create food documents
            const createdFoods = await Promise.all(
              mealFoods.map(food =>
                Food.create({ ...food, user: user._id, date: date })
              )
            );
            
            // Create meal
            const meal = await Meal.create({
              user: user._id,
              mealTime: mealTime,
              date: date,
              foods: createdFoods.map(f => f._id)
            });
            
            // Update foods with meal reference
            await Promise.all(
              createdFoods.map(f => Food.findByIdAndUpdate(f._id, { meal: meal._id }))
            );
            
            createdMeals.push(meal);
          }
        }
      }
    }
    
    console.log(`✅ Created ${createdMeals.length} meals`);
    
    // 5. Create some posts
    console.log('📝 Creating posts...');
    const posts = [];
    for (const meal of createdMeals.slice(0, 5)) { // Create posts for first 5 meals
      const post = await Post.create({
        user: meal.user,
        description: `My ${meal.mealTime} for ${meal.date.toDateString()}`,
        meal: meal._id,
        date: meal.date
      });
      posts.push(post);
    }
    
    console.log(`✅ Created ${posts.length} posts`);
    
    // 6. Create some network connections
    console.log('👥 Creating network connections...');
    const networks = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        if (Math.random() > 0.5) { // 50% chance of following
          const network = await Network.create({
            followerId: users[i]._id,
            followingId: users[j]._id
          });
          networks.push(network);
        }
      }
    }
    
    console.log(`✅ Created ${networks.length} network connections`);
    
    // 7. Update users with meals references
    console.log('🔗 Updating user references...');
    for (const user of users) {
      const userMeals = createdMeals.filter(meal => meal.user.toString() === user._id.toString());
      await User.findByIdAndUpdate(user._id, { 
        meals: userMeals.map(m => m._id)
      });
    }
    
    // Summary
    console.log('\n🎉 Macros seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   • Users: ${users.length}`);
    console.log(`   • Foods: ${sampleFoods.length} sample foods available`);
    console.log(`   • Meals: ${createdMeals.length}`);
    console.log(`   • Posts: ${posts.length}`);
    console.log(`   • Network connections: ${networks.length}`);
    
    // Test data for API endpoints
    console.log('\n🧪 Test Data:');
    console.log(`   • Login with: ${users[0].email} / password123`);
    console.log(`   • User ID: ${users[0]._id}`);
    console.log(`   • Test endpoints:`);
    console.log(`     - GET /api/food/${users[0]._id} - Get user's foods`);
    console.log(`     - GET /api/meals/${users[0]._id} - Get user's meals`);
    console.log(`     - GET /api/posts/${users[0]._id} - Get user's posts`);
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await ufnConn.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seeding
seedMacros(); 