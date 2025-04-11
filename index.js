const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const { ObjectId } = require("mongodb");

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

    //verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      console.log("checking admin token");
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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
    app.get("/projects/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const project = await projectsCollection.find(query).toArray();
      console.log(project);
      res.send(project[0]);
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

    app.get("/verify-token", verifyToken, async (req, res) => {
      try {
        const user = await User.findById(req.user.id).select("-password");

        res.json({
          valid: true,
          user: {
            id: user._id,
            role: user.role,
          },
        });
      } catch (error) {
        res
          .status(401)
          .json({ valid: false, message: "Token validation failed" });
      }
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/all-users", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.decoded.email;
      const query = { email: email };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // PUT endpoints for updating items
    app.put("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedProduct = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: updatedProduct,
        };

        const result = await productsCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.json({
          success: true,
          message: "Product updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error updating product",
          error: error.message,
        });
      }
    });

    app.put("/team-members/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedMember = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: updatedMember,
        };

        const result = await teamMembersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.json({
          success: true,
          message: "Team member updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error updating team member",
          error: error.message,
        });
      }
    });

    app.put("/projects/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedProject = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: updatedProject,
        };

        const result = await projectsCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.json({
          success: true,
          message: "Project updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error updating project",
          error: error.message,
        });
      }
    });

    app.put("/testimonials/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedTestimonial = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: updatedTestimonial,
        };

        const result = await testimonialsCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.json({
          success: true,
          message: "Testimonial updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error updating testimonial",
          error: error.message,
        });
      }
    });

    // DELETE endpoints for removing items
    app.delete("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await productsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.json({
          success: true,
          message: "Product deleted successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error deleting product",
          error: error.message,
        });
      }
    });

    app.delete(
      "/team-members/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const result = await teamMembersCollection.deleteOne({
            _id: new ObjectId(id),
          });
          res.json({
            success: true,
            message: "Team member deleted successfully",
            result,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: "Error deleting team member",
            error: error.message,
          });
        }
      }
    );

    app.delete("/projects/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await projectsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.json({
          success: true,
          message: "Project deleted successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error deleting project",
          error: error.message,
        });
      }
    });

    app.delete(
      "/testimonials/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const result = await testimonialsCollection.deleteOne({
            _id: new ObjectId(id),
          });
          res.json({
            success: true,
            message: "Testimonial deleted successfully",
            result,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: "Error deleting testimonial",
            error: error.message,
          });
        }
      }
    );

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
