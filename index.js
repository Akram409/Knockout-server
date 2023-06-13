const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log(authorization)
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
        console.log(decoded)
    }
    req.decoded = decoded;
    next();
  });
};

// MongoDB

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6nxonq0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const classCollection = client.db("knockoutDB").collection("Class");
    const userCollection = client.db("knockoutDB").collection("user");
    const selectedCollection = client
      .db("knockoutDB")
      .collection("SelectedClass");
    const paymentCollection = client.db("knockoutDB").collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.position !== "Admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // All User
    app.get("/user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user is already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email",verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.position === "Admin" };
      res.send(result);
    });

    app.get("/users/instructors/:email",verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructors: user?.position === "Instructor" };
      res.send(result);
    });
    app.get("/users/student/:email",verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.position === "Student" };
      res.send(result);
    });

    app.patch("/manageClass/approve/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/manageClass/deny/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/userRole/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          position: "Admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/userRole/instructor/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          position: "Instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post("/addClass", async (req, res) => {
      const newItem = req.body;
      console.log(newItem);
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    });

    app.put("/updateClass/:id", async (req, res) => {
      const id = req.params.id;
      const user = req.body;
      console.log(id)
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateClass = {
        $set: {
          name: user.name,
          image: user.image,
          totalSeats: user.totalSeats,
          price: user.price,
        },
      };
      const result = await classCollection.updateOne(
        filter,
        updateClass,
        options
      );
      console.log(updateClass);
      res.send(result);
    });

    app.get("/manageClass", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });
    app.patch("/manageClass/feedback/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { feedback } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { feedback } };

        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to update class data" });
      }
    });

    app.get("/allClass", async (req, res) => {
      const filter = { status: "approved" };
      const result = await classCollection.find(filter).toArray();
      res.send(result);
    });

    app.patch("/allClass/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id : new ObjectId(id) };
      const existingDocument = await classCollection.findOne(filter);

      if (!existingDocument) {
        return res.status(404).json({ message: "Class not found" });
      }

      const { enrolled ,totalSeats} = existingDocument;

      if (enrolled >= totalSeats) {
        return res.status(403).json({ message: "Class is full" });
      }
      
      const updateDoc = {
        $set: {
          enrolled: enrolled + 1,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.get("/class", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ enrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // Instructor
    app.get("/instructor", async (req, res) => {
      const filter = { position: "Instructor" };
      const result = await userCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/myClass/instructor/:email", async (req, res) => {
      const Email = req.params.email;
      const filter = { instructorEmail: Email };
      const result = await classCollection.find(filter).toArray();
      res.send(result);
    });

    app.post("/selectedClass", async (req, res) => {
      const newItem = req.body;
      newItem._id = new ObjectId();
      newItem.PayStatus = "pending"
      const result = await selectedCollection.insertOne(newItem);
      res.send(result);
    });
    app.patch("/selectedClass/approve/student/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { ClassId : id };
      const updateDoc = {
        $set: {
          PayStatus: "approved",
        },
      };
      const result = await selectedCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/student/selectedClass/:email", async (req, res) => {
      const email = req.params.email;
      const filter = {
        $and: [
          { student_email: email },
          { PayStatus: "pending" }
        ]
      };
      const result = await selectedCollection.find(filter).toArray();
      res.send(result);
    });
    app.delete("/student/selectedClass/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/student/enrollClass/:email", async (req, res) => {
      const email = req.params.email;
      const filter = {
        $and: [
          { student_email: email },
          { PayStatus: "approved" }
        ]
      };
      const result = await selectedCollection.find(filter).toArray();
      res.send(result);
    });

    // Payment
    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      console.log({payment})
      const insertResult = await paymentCollection.insertOne(payment);
      res.send({ insertResult });
    });

    app.get("/payment/:id", async (req, res) => {
      const email = req.params.id;
      console.log(email)
      const filter = { email: email };
      const result = await paymentCollection.find(filter).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is Running!!");
});

app.listen(port, (req, res) => {
  console.log(`Server is Running on Port : ${port}`);
});
