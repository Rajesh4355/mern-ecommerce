const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), override: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const mongoose = require('mongoose');

let seeded = false;

async function runSeeders() {
  if (seeded) return;
  seeded = true;
  const { seedBrand } = require('../seed/Brand');
  const { seedCategory } = require('../seed/Category');
  const { seedProduct } = require('../seed/Product');
  const { seedUser } = require('../seed/User');
  const { seedAddress } = require('../seed/Address');
  const { seedWishlist } = require('../seed/Wishlist');
  const { seedCart } = require('../seed/Cart');
  const { seedReview } = require('../seed/Review');
  const { seedOrder } = require('../seed/Order');

  await seedBrand();
  await seedCategory();
  await seedProduct();
  await seedUser();
  await seedAddress();
  await seedWishlist();
  await seedCart();
  await seedReview();
  await seedOrder();
}

exports.connectToDB = async () => {
  mongoose.set('bufferCommands', false);
  const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();

  if (
    !mongoUri ||
    mongoUri.includes('your-database-name') ||
    mongoUri.includes('<db_password>') ||
    mongoUri.includes('YOUR_PASSWORD')
  ) {
    console.log('[AI Studio] MONGO_URI not configured with a password — running with in-memory seeded store');
    await runSeeders();
    console.log('[AI Studio] In-memory store seeded with sample ecommerce data');
    return;
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log('connected to DB');
    const Product = require('../models/Product');
    const existingCount = await Product.find({}).countDocuments().exec();
    if (existingCount === 0) {
      console.log('Database is empty — seeding initial ecommerce data...');
      await runSeeders();
    }
  } catch (error) {
    console.log('[AI Studio] External MongoDB unavailable — running with in-memory seeded store');
    await runSeeders();
    console.log('[AI Studio] In-memory store seeded with sample ecommerce data');
  }
};