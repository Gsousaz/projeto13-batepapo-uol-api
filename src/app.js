import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

const app = express(); // App do servidor
const PORT = 5000; // Porta em que o servidor está rodando

import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient
  .connect()
  .then(() => (db = mongoClient.db()) && console.log("O mongo está rodando"))
  .catch((err) => console.log(err.message));

app.use(cors());
app.use(express.json());

app.post("/participants", async (req, res) => {
  const name = req.body;

  if (!name) return res.status(422).send("Preencha todos os campos");

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: name });
    if (participant) return res.status(409).send("Usuário já cadastrado");

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: Date.now });
    res.sendStatus(201);
  } catch (err) {
    res.sendStatus(500).send(err.message);
  }
});

app.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}`));
