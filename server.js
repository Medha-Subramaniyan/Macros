// server.js
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

// Import Cloudinary configuration
const { cloudinary, upload } = require('./config/cloudinary');

// Import models from models directory
const User = require('./models/User');
const Food = require('./models/Food');
const Meal = require('./models/Meal');
const Post = require('./models/Post');
const Network = require('./models/Network');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Connect to MongoDB
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌ Missing MONGODB_URI in .env');
  process.exit(1);
}

// Connect to MongoDB using the same connection as models
const ufnConn = require('./db');
ufnConn.on('connected', () => {
  console.log('✅ Database connected successfully');
});

// ─── API Endpoints 

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.json({ error: 'Invalid credentials' });

    return res.json({
      id:        user._id,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      profilePic: user.profilePic,
      bio:       user.bio,
      error:     ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Create a new Food record
app.post('/api/food', async (req, res) => {
  try {
    const { userId, foodName, calories, protein, carbs, fats, portionSize, mealTime, date } = req.body;
    const record = await Food.create({
      user:        userId,
      foodName:    foodName,
      calories:    calories,
      protein:     protein,
      carbs:       carbs,
      fats:        fats,
      portionSize: portionSize,
      mealTime:    mealTime || 'breakfast',
      date:        date || new Date()
    });
    res.json({ id: record._id, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save food' });
  }
});

// List all Foods for a user
app.get('/api/food/:userId', async (req, res) => {
  try {
    const foods = await Food.find({ user: req.params.userId })
                            .sort({ createdAt: -1 });
    res.json({ foods, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch food' });
  }
});

// Get foods by mealTime for a user
app.get('/api/food/:userId/meal/:mealTime', async (req, res) => {
  try {
    const { userId, mealTime } = req.params;
    const { date } = req.query;
    
    // Build query
    const query = { user: userId, mealTime: mealTime };
    
    // If date is provided, filter by date
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }
    
    const foods = await Food.find(query).sort({ createdAt: -1 });
    res.json({ foods, mealTime, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch meals' });
  }
});

// Get daily meal summary for a user
app.get('/api/food/:userId/daily-summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    
    // Use today if no date provided
    const queryDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(queryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const foods = await Food.find({
      user: userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: -1 });
    
    // Group by mealTime
    const mealSummary = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };
    
    // Calculate totals
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    
    foods.forEach(food => {
      mealSummary[food.mealTime].push(food);
      totalCalories += food.calories || 0;
      totalProtein += food.protein || 0;
      totalCarbs += food.carbs || 0;
      totalFats += food.fats || 0;
    });
    
    res.json({
      date: queryDate.toISOString().split('T')[0],
      meals: mealSummary,
      totals: {
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fats: totalFats
      },
      error: ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch daily summary' });
  }
});

// Follow a user
app.post('/api/follow', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    
    // Check if already following
    const existing = await Network.findOne({ followerId, followingId });
    if (existing) {
      return res.json({ error: 'Already following this user' });
    }
    
    // Check if trying to follow self
    if (followerId === followingId) {
      return res.json({ error: 'Cannot follow yourself' });
    }
    
    await Network.create({ followerId, followingId });
    res.json({ error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not follow user' });
  }
});

// Unfollow a user
app.delete('/api/follow', async (req, res) => {
  try {
    const { followerId, followingId } = req.body;
    await Network.findOneAndDelete({ followerId, followingId });
    res.json({ error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not unfollow user' });
  }
});

// Get followers for a user
app.get('/api/followers/:userId', async (req, res) => {
  try {
    const followers = await Network.find({ followingId: req.params.userId })
                                   .populate('followerId', 'firstName lastName email profilePic')
                                   .sort({ createdAt: -1 });
    res.json({ followers, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch followers' });
  }
});

// Get users being followed by a user
app.get('/api/following/:userId', async (req, res) => {
  try {
    const following = await Network.find({ followerId: req.params.userId })
                                   .populate('followingId', 'firstName lastName email profilePic')
                                   .sort({ createdAt: -1 });
    res.json({ following, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch following' });
  }
});

// ─── Image Upload Endpoints

// Upload profile picture
app.post('/api/upload-profile-pic/:userId', upload.single('profilePic'), async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Update user's profile picture URL in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: req.file.path },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicUrl: req.file.path,
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        profilePic: updatedUser.profilePic
      },
      error: ''
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Delete profile picture
app.delete('/api/delete-profile-pic/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete from Cloudinary if exists
    if (user.profilePic) {
      const publicId = user.profilePic.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`profile_pictures/${publicId}`);
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: null },
      { new: true }
    );

    res.json({
      message: 'Profile picture deleted successfully',
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        profilePic: updatedUser.profilePic
      },
      error: ''
    });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete profile picture' });
  }
});

// Get user profile (including profile picture)
app.get('/api/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePic: user.profilePic,
        bio: user.bio,
        createdAt: user.createdAt
      },
      error: ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch user profile' });
  }
});

// Update user profile
app.put('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, bio } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, bio },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        profilePic: updatedUser.profilePic,
        bio: updatedUser.bio
      },
      error: ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update profile' });
  }
});

// ─── Meal Endpoints

// Create a new Meal
app.post('/api/meal', async (req, res) => {
  try {
    const { userId, mealTime, date, foods } = req.body; // foods: array of food objects

    // Create Food documents first
    const createdFoods = await Promise.all(
      foods.map(food =>
        Food.create({ ...food, user: userId })
      )
    );

    // Create Meal document
    const meal = await Meal.create({
      user: userId,
      mealTime,
      date: date ? new Date(date) : new Date(),
      foods: createdFoods.map(f => f._id)
    });

    // Optionally, update User and Food with meal reference
    await User.findByIdAndUpdate(userId, { $push: { meals: meal._id } });
    await Promise.all(
      createdFoods.map(f => Food.findByIdAndUpdate(f._id, { meal: meal._id }))
    );

    res.json({ meal, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create meal' });
  }
});

// Get all meals for a user (optionally filter by date)
app.get('/api/meals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;

    const query = { user: userId };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const meals = await Meal.find(query)
      .populate('foods')
      .sort({ date: -1, mealTime: 1 });

    res.json({ meals, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch meals' });
  }
});

// Get a specific meal by ID
app.get('/api/meal/:mealId', async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.mealId)
      .populate('foods')
      .populate('user', 'firstName lastName email');

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }

    res.json({ meal, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch meal' });
  }
});

// ─── Post Endpoints

// Create a new post
app.post('/api/post', async (req, res) => {
  try {
    const { userId, image_url, description, mealId } = req.body;
    
    // Verify the meal exists
    const meal = await Meal.findById(mealId);
    if (!meal) {
      return res.status(404).json({ error: 'Meal not found' });
    }
    
    // Verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const post = await Post.create({
      user: userId,
      image_url: image_url || null,
      description: description || null,
      meal: mealId,
      date: new Date()
    });
    
    // Populate the post with meal and user data
    const populatedPost = await Post.findById(post._id)
      .populate('meal')
      .populate('user', 'firstName lastName profilePic');
    
    res.json({ post: populatedPost, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create post' });
  }
});

// Get all posts for a user
app.get('/api/posts/:userId', async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .populate('meal')
      .populate('user', 'firstName lastName profilePic')
      .sort({ date: -1 });
    
    res.json({ posts, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch posts' });
  }
});

// Get a specific post by ID
app.get('/api/post/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('meal')
      .populate('user', 'firstName lastName profilePic');
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({ post, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch post' });
  }
});

// Update a post
app.put('/api/post/:postId', async (req, res) => {
  try {
    const { image_url, description } = req.body;
    
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.postId,
      { 
        image_url: image_url || null,
        description: description || null
      },
      { new: true }
    ).populate('meal')
     .populate('user', 'firstName lastName profilePic');
    
    if (!updatedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({ post: updatedPost, error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update post' });
  }
});

// Delete a post
app.delete('/api/post/:postId', async (req, res) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.postId);
    
    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({ message: 'Post deleted successfully', error: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete post' });
  }
});

// ─── Test endpoint for Cloudinary
app.get('/api/test-cloudinary', (req, res) => {
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
  });
});

// ─── Test endpoint for database
app.get('/api/test-users', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const users = await User.find({}).select('firstName lastName email profilePic bio');
    res.json({
      userCount,
      users: users.map(u => ({
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        profilePic: u.profilePic,
        bio: u.bio
      })),
      error: ''
    });
  } catch (err) {
    console.error('Test users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server
const PORT = process.env.PORT || 3000;

// Wait for database connection before starting server
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log(`✅ Database connected to ${uri}`);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });
