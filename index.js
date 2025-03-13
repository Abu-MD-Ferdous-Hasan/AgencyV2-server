const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_username}:${process.env.DB_password}@cluster0.p9sfd7v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);

// middleware
app.use(cors());
app.use(express.json());
// verifyToken middleware
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// server code starts from here
async function run() {
  try {
    const database = client.db("AgencyV2");
    const digitalServicesCollection = database.collection("digitalServices");
    const productsCollection = database.collection("products");
    const teamMembersCollection = database.collection("teamMembers");
    const projectsCollection = database.collection("projects");
    const testimonialsCollection = database.collection("testimonials");
    const usersCollection = database.collection("users");

    app.get("/digital-services", async (req, res) => {
      const query = {};
      const services = digitalServicesCollection.find(query);

      res.send(await services.toArray());
    });

    app.get("/products", async (req, res) => {
      const query = {};
      const products = productsCollection.find(query);
      res.send(await products.toArray());
    });

    app.get("/team-members", async (req, res) => {
      const query = {};
      const teamMembers = teamMembersCollection.find(query);
      res.send(await teamMembers.toArray());
    });
    app.get("/projects", async (req, res) => {
      const query = {};
      const projects = projectsCollection.find(query);
      res.send(await projects.toArray());
    });

    app.get("/testimonials", async (req, res) => {
      const { fields } = req.query;
      const query = {};
      const testimonials = await testimonialsCollection.find(query).toArray();

      if (fields) {
        const fieldArray = fields.split(",");
        const filteredData = testimonials.map((item) => {
          const filtered = {};
          fieldArray.forEach((field) => {
            if (item[field]) {
              filtered[field] = item[field];
            }
          });
          return filtered;
        });
        res.send(filteredData);
      } else {
        res.send(testimonials);
      }
    });

    app.post("/register", async (req, res) => {
      try {
        const {
          firstName,
          lastName,
          email,
          password,
          services = [],
        } = req.body;

        // Check if required fields are present
        if (!firstName || !lastName || !email || !password) {
          return res.status(400).json({
            success: false,
            message: "Please provide all required fields",
          });
        }

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "User already exists with this email",
          });
        }

        const newUser = {
          firstName,
          lastName,
          email,
          password,
          services,
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);
        const token = jwt.sign(
          { email: newUser.email, userId: result.insertedId },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "1d" }
        );

        res.status(201).json({
          success: true,
          message: "User registered successfully",
          userId: result.insertedId,
          accessToken: token,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error registering user",
          error: error.message,
        });
      }
    });

    app.post("/signin", async (req, res) => {
      try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
          return res.status(400).json({
            success: false,
            message: "Please provide email and password",
          });
        }

        // Find user by email
        const user = await usersCollection.findOne({ email });

        // Check if user exists and password matches
        if (!user || user.password !== password) {
          return res.status(401).json({
            success: false,
            message: "Invalid email or password",
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          { email: user.email, userId: user._id },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "1d" }
        );

        res.json({
          success: true,
          message: "Login successful",
          accessToken: token,
          userId: user._id,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error during login",
          error: error.message,
        });
      }
    });

    //end of function
  } finally {
  }
}
run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Hello World from AgencyV2!");
});

app.listen(port, () => {
  console.log(`AgencyV2 server running on port ${port}`);
});
