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
  const name = req.body.name;

  const schemaParticipant = joi.object({
    name: joi.string().required(),
  }); // => Define o esquema de validação do campo name.

  const validation = schemaParticipant.validate(req.body, {
    abortEarly: false,
  }); // => Realiza a validação dos campos definidos.

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors); // => Retorna para o usuário os erros que porventura venham a ocorrer.
  }

  if (!name) return res.status(422).send("Preencha todos os campos"); //Verifica se todos os campos foram preenchidos antes de fazer a requisição

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: name });
    if (participant) return res.status(409).send("Usuário já cadastrado"); // => impede o cadastro de um nome que já esteja sendo utilizado.

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: Date.now }); // => Inserção do usuário no banco de dados

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201); // => Caso o usuário consiga se conectar na sala, é enviada uma mensagem informando a todos os participantes \o/
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//-----------------------INICIO DA ROTA GET "/PARTICIPANTS"-----------------------//

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find({}).toArray();
    res.status(200).send(participants);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//-----------------------INICIO DA ROTA POST "/MESSAGES"-----------------------//

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const user = req.headers.user;

  const schemaMessage = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.any().allow("message", "private_message").only(),
  });

  const validation = schemaMessage.validate(req.body, {
    abortEarly: false,
  });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors); // => Retorna para o usuário os erros que porventura venham a ocorrer.
  }

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: req.headers.user });
    if (!participant) return res.status(401).send("Permissão Negada");

    await db.collection("messages").insertOne({
      from: participant.name,
      to: to,
      text: text,
      type: type,
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201); // => Envia a mensagem no formato especificado para ser salva no bando de dados \o/
  } catch (err) {
    res.status(422).send(err.message);
  }
});


app.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}`));
   