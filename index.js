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

// server code starts from here
async function run() {
  try {
    const database = client.db("AgencyV2");
    const digitalServicesCollection = database.collection("digitalServices");
    const productsCollection = database.collection("products");
    const teamMembersCollection = database.collection("teamMembers");
    const projectsCollection = database.collection("projects");

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
