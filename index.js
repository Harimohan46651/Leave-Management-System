const express = require("express");
const { connectDB } = require('./src/db');
const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize database connection
connectDB().catch(console.error);

app.get("/", (req, res) => {
  res.send("Hello");
});


app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});
