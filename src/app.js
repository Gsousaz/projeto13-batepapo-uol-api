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

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: name });
    if (participant) return res.status(409).send("Usuário já cadastrado"); // => impede o cadastro de um nome que já esteja sendo utilizado.

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: Number(Date.now()) }); // => Inserção do usuário no banco de dados

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
    type: joi.any().allow("message", "private_message").only().required(),
  });

  const validation = schemaMessage.validate(req.body, {
    abortEarly: false,
  });

  if (validation.error) {
    return res.sendStatus(422); // => Alteração: Tentando enviar apenas o status por conta de erro na avaliação automática.
  }

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: user });
    if (!participant) return res.status(422).send("Permissão Negada");

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

//-----------------------INICIO DA ROTA GET "/MESSAGES"-----------------------//

app.get("/messages", async (req, res) => {
  const user = req.headers.user;
  const mensagensFiltradas = {
    $or: [{ from: user }, { to: user }, { to: "Todos" }, { type: "message" }],
  };
  const limit = req.query.limit;
  let messages;

  try {
    if (limit === undefined) {
      // => Caso não seja informado um limite vamos mostrar todas as mensagens que o usuário pode ver.
      messages = await db
        .collection("messages")
        .find(mensagensFiltradas)
        .toArray();
    } else if (isNaN(limit) || limit <= 0) {
      // => Caso seja informado um limite não numérico ou menor/igual a 0, retornamos o status 422.
      res.sendStatus(422);
    } else {
      messages = await db
        .collection("messages")
        .find(mensagensFiltradas)
        .limit(parseInt(limit))
        .toArray(); // => Caso o limite informado
      // seja um número válido, mostramos a quantidade de mensagens solicitada para ele \o/
    }

    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//-----------------------INICIO DA ROTA POST "/STATUS"-----------------------//

app.post("/status", async (req, res) => {
  const user = req.headers.user;

  try {
    if (!user) {
      res.sendStatus(404);
    }

    const participant = await db
      .collection("participants")
      .findOne({ name: user });
    if (!participant) return res.sendStatus(404);

    db.collection("participants").updateOne(
      { name: user },
      { $set: { lastStatus: Number(Date.now()) } },
      { upsert: true }
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//-----------------------INICIO DA REMOÇÃO AUTOMÁTICA DE USUÁRIOS"-----------------------//

setInterval(async () => {
  const afkCount = Date.now() - 10000;
  console.log(afkCount);
  try {
    const afkUsers = await db.collection("participants").find({ lastStatus: { $lt: afkCount } }).toArray();
    if (afkUsers.length > 0) {
      afkUsers.map(async (u) => {
        await db.collection("messages").insertOne({
          from: u.name,
          to: "Todos",
          text: "sai na sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss")
        });
        console.log("deleting afkuser")
        await db.collection("participants").deleteOne(u);
      });
    }
    console.log("Success: 201");
  } catch (error) {
    console.error("Error: 400");
  }
}, 15000);

app.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}`));