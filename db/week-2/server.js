const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const { Pool } = require("pg");

const db = new Pool({
  user: "mamad", // replace with you username
  host: "localhost",
  database: "cyf_hotels",
  password: "mamad1364",
  port: 5432,
});

app.get("/", function (req, res) {
  // Send response to client and print an message
  res.send("<h1>Hotel Database project Home Page</h1>");
});

// Listen connections on port defined as PORT
const port = process.env.PORT || 3000;
server.listen(PORT, function () {
  // Callback called when server is listening
  console.log(`Server starter and listening on port ${PORT}.`);
});
