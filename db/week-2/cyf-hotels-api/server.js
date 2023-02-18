const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const { Pool } = require("pg");
const bodyParser = require("body-parsetr");
app.use(bodyParser.json());

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
app.get("/customers", function (req, res) {
  db.query("SELECT id,name,city,phone FROM customers", (error, result) => {
    if (error == undefined) {
      res.json(result.rows);
    } else {
      console.log(error);
      res.status(400).json(error);
    }
  });
});
//
//
app.get("/customers/:id", function (req, res) {
  const custId = parseInt(req.params.id);
  db.query(
    "SELECT id,name,city,phone FROM customers" + "where id = $1",
    [custId],
    (error, result) => {
      if (error == undefined) {
        res.json(result.rows[0]);
      } else {
        console.log(error);
        res.status(400).json(error);
      }
    }
  );
});

//
app.get("/customers/by_city/:city", function (req, res) {
  const city = req.params.city;
  db.query(
    "'SELECT id,name,city,phone FROM customers'" + "where city like $1' || '%'",
    [city],
    (error, result) => {
      if (error == undefined) {
        res.json(result.rows);
      } else {
        console.log(error);
        res.status(400).json(error);
      }
    }
  );
});

//
//
app.post("/customers", (req, res) => {
  const newName = req.body.name;
  const newEmail = req.body.email;
  const newPhone = req.body.phone;
  const newCountry = req.body.country;

  const query =
    "INSERT INTO customers (name, email, phone, country) " +
    "VALUES ($1, $2, $3, $4) RETURNING id";
  db.query(query, [newName, newEmail, newPhone, newCountry], (err, result) => {
    const newId = result.rows[0].id;
    res.send(`Customer created. New Id = ${newId}`);
  });
});

//
app.put("/customers/:customerId", function (req, res) {
  const customerId = req.params.customerId;
  const newEmail = req.body.email;

  db.query("UPDATE customers SET email=$1 WHERE id=$2", [newEmail, customerId])
    .then(() => res.send(`Customer ${customerId} updated!`))
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err });
    });
});
//
//
app.delete("/customers/:customerId", function (req, res) {
  const customerId = req.params.customerId;

  db.query("DELETE FROM customers WHERE id=$1", [customerId])
    .then(() => res.send(`Customer ${customerId} deleted!`))
    .catch((error) => {
      console.error(error);
      res.status(500).json(error);
    });
});
// Listen connections on port defined as PORT
const port = process.env.PORT || 3000;
app.listen(port, function () {
  // Callback called when server is listening
  console.log(`Server starter and listening on port ${port}.`);
});
