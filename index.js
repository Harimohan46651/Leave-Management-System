require('dotenv').config();
const express = require("express");
const { connectDB } = require('./src/db');
const authRoutes = require('./src/routes/auth');
const app = express();
const PORT =process.env.PORT || 3000;
app.use(express.json());

// Initialize database connection
connectDB().catch(console.error);

// Routes
console.log('Auth routes loaded:', typeof authRoutes);
console.log('Mounting auth routes at /auth');
app.use('/auth', authRoutes);


app.get("/", (req, res) => {
  res.send("Hello");
});


app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});
