import express from "express";
import cors from "cors";

const app = express(); // App do servidor
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}`));
