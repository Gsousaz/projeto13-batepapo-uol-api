import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import joi from "joi";

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

//-----------------------INICIO DA ROTA POST "/PARTICIPANTS"-----------------------//
app.post("/participants", async (req, res) => {
  const name = req.body;

  const schemaParticipant = joi.object({
    name: joi.string().required(),
  }); // => Define o esquema de validação do campo name.

  const validation = schemaParticipant.validate(req.body, {
    abortEarly: false,
  }); // => Realiza a validação dos campos definidos.

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors); // => Retorna para o usuário os que porventura venham a ocorrer.
  }

  if (!name) return res.status(422).send("Preencha todos os campos"); //Verifica se todos os campos foram preenchidos antes de fazer a requisição

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: name });
    if (participant) return res.status(409).send("Usuário já cadastrado"); // => impede o cadastro de um nome que já esteja sendo utilizado.

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: Date.now }); 
    
      await db.collection("messages").insertOne({
      from: name.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);  // => Caso o usuário consiga se conectar na sala, é enviada uma mensagem informando a todos os participantes \o/
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find({}).toArray();
    res.status(200).send(participants);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}`));
