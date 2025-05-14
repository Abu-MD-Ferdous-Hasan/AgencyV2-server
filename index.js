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

// boiler plate middleware
app.use(cors());
app.use(express.json());
// verifyToken middleware
const verifyToken = (req, res, next) => {
  console.log("verifyToken middleware");
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
      try {
        const projects = await projectsCollection.find({}).toArray();
        // Reordering the fields
        const orderedProjects = projects.map((project) => ({
          _id: project._id,
          projectTitle: project.projectTitle,
          projectCategory: project.projectCategory,
          projectImage: project.projectImage,
          projectDescription: project.projectDescription,
          projectTechnologies: project.projectTechnologies,
          features: project.features,
          links: project.links,
          challenges: project.challenges,
          createdAt: project.createdAt,
        }));
        res.json({
          success: true,
          data: orderedProjects,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error fetching projects",
          error: error.message,
        });
      }
    });

    app.get("/projects/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const project = await projectsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!project) {
          return res.status(404).json({
            success: false,
            message: "Project not found",
          });
        }
        // Reordering the fields
        const orderedProject = {
          _id: project._id,
          projectTitle: project.projectTitle,
          projectCategory: project.projectCategory,
          projectImage: project.projectImage,
          projectDescription: project.projectDescription,
          projectTechnologies: project.projectTechnologies,
          features: project.features,
          links: project.links,
          challenges: project.challenges,
          createdAt: project.createdAt,
        };
        res.json({
          success: true,
          data: orderedProject,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error fetching project",
          error: error.message,
        });
      }
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
          gender,
          profileImage,
        } = req.body;

        if (!firstName || !lastName || !email || !password) {
          return res.status(400).json({
            success: false,
            message: "Please provide all required fields",
          });
        }

        const normalizedEmail = email?.toLowerCase() || email;

        const existingUser = await usersCollection.findOne({
          email: normalizedEmail,
        });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "User already exists with this email",
          });
        }

        const newUser = {
          firstName,
          lastName,
          email: normalizedEmail,
          password,
          services,
          createdAt: new Date(),
          gender,
          profileImage,
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

        if (!email || !password) {
          return res.status(400).json({
            success: false,
            message: "Please provide email and password",
          });
        }

        const normalizedEmail = email?.toLowerCase() || email;

        const user = await usersCollection.findOne({ email: normalizedEmail });

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
          profileImage: user.profileImage,
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

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const options = { projection: { password: 0 } };
      try {
        const users = await usersCollection.find({}, options).toArray();
        res.json({
          success: true,
          data: users,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error fetching users",
          error: error.message,
        });
      }
    });

    // PUT endpoints for updating items
    app.put("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedProduct = req.body;

        let options = { upsert: true };

        const filter = { _id: new ObjectId(id) };

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
          message:
            id === "new"
              ? "Product created successfully"
              : "Product updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error processing product",
          error: error.message,
        });
      }
    });

    app.put("/team-members/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedMember = req.body;

        let options = { upsert: true };

        const filter = { _id: new ObjectId(id) };

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
          message:
            id === "new"
              ? "Team member created successfully"
              : "Team member updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error processing team member",
          error: error.message,
        });
      }
    });

    app.put("/projects/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedProject = req.body;
        let options = { upsert: true };

        const filter = { _id: new ObjectId(id) };

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
          message:
            id === "new"
              ? "Project created successfully"
              : "Project updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error processing project",
          error: error.message,
        });
      }
    });

    app.put("/testimonials/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedTestimonial = req.body;
        let options = { upsert: true };

        const filter = { _id: new ObjectId(id) };

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
          message:
            id === "new"
              ? "Testimonial created successfully"
              : "Testimonial updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error processing testimonial",
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

    // POST endpoints for creating new items
    app.post("/products/new", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const newProduct = req.body;
        const result = await productsCollection.insertOne(newProduct);
        res.status(201).json({
          success: true,
          message: "Product created successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error creating product",
          error: error.message,
        });
      }
    });

    app.post(
      "/team-members/new",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const newMember = req.body;
          const result = await teamMembersCollection.insertOne(newMember);
          res.status(201).json({
            success: true,
            message: "Team member created successfully",
            result,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: "Error creating team member",
            error: error.message,
          });
        }
      }
    );

    app.post("/projects/new", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const newProject = req.body;
        const result = await projectsCollection.insertOne(newProject);
        res.status(201).json({
          success: true,
          message: "Project created successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error creating project",
          error: error.message,
        });
      }
    });

    app.post(
      "/testimonials/new",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const newTestimonial = req.body;
          const result = await testimonialsCollection.insertOne(newTestimonial);
          res.status(201).json({
            success: true,
            message: "Testimonial created successfully",
            result,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: "Error creating testimonial",
            error: error.message,
          });
        }
      }
    );

    // User management endpoints
    app.put("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedUser = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: false };
        const updateDoc = {
          $set: updatedUser,
        };

        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.json({
          success: true,
          message: "User updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error updating user",
          error: error.message,
        });
      }
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.json({
          success: true,
          message: "User deleted successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error deleting user",
          error: error.message,
        });
      }
    });

    // Update user profile endpoint
    app.put("/users-profile", verifyToken, async (req, res) => {
      console.log("first");
      try {
        const { firstName, lastName, gender, profileImage } = req.body;
        const email = req.decoded.email;

        const filter = { email: email };
        const updateDoc = {
          $set: {
            firstName,
            lastName,
            gender,
            profileImage,
          },
        };

        const result = await usersCollection.updateOne(filter, updateDoc);
        console.log(result);
        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        // Get the updated user data
        const updatedUser = await usersCollection.findOne(filter, {
          projection: { password: 0 },
        });

        res.json({
          success: true,
          message: "Profile updated successfully",
          data: updatedUser,
        });
      } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({
          success: false,
          message: "Error updating profile",
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
