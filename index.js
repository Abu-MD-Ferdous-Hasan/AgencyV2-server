const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// server code starts from here
app.get("/", (req, res) => {
  res.send("Hello World from AgencyV2!");
});

app.listen(port, () => {
  console.log(`AgencyV2 server running on port ${port}`);
});
