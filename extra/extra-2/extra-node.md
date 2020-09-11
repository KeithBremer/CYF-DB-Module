# More Uses of Node.js for SQL

## Understanding Connections to PostgreSQL

So far in the CYF course we have used the `db.query` method for executing SQL. By using `db.query` the server opens a new connection, executes the query then closes the connection. This is fine for a single SQL command but is inefficient or simply won't work for more complex situations that involve multiple SQL commands.

Just to recap, we used the following preamble to configure our server to use express, bodyparser and postgres:

```js
const express = require("express");
const bodyParser = require("body-parser");

const app = express();

const Pool = require("pg").Pool;

const db = new Pool({
  user: "keith",
  host: "localhost",
  database: "cyf_hotel",
  password: "?????",
  port: 5432,
});

app.use(bodyParser.json());
```

All of this is still required.

We also defined an endpoint to handle POST requests to insert a new customer, first checking that the customer's email is not already in the database:

```js
//
// Route to add a new customer
//
app.post("/customers", function (req, res) {
  const custName = req.body.name;
  const custEmail = req.body.email;
  const custPhone = req.body.phone;
  if (
    custPhone.replace(/[\+\-\(\)0-9 ]/g, "0") !=
    "0".padEnd(custPhone.length, "0")
  ) {
    return res
      .status(400)
      .send("Phone number can contain only 0-9, +, -, (, ) or space.");
  }
  //
  // Check the customer's email isn't already in the table
  //
  db.query(
    "SELECT 1 FROM customers WHERE email=$1",
    [custEmail],
    (err, result) => {
      if (result.rowCount > 0) {
        //
        // The email already exists in the table so return an error
        //
        return res
          .status(400)
          .send("A customer with that email address already exists!");
      } else {
        //
        // The email is not in the table so insert the new customer
        //
        db.query(
          "INSERT INTO customers (name, email, phone) " +
            "VALUES ($1, $2, $3) " +
            "RETURNING id",
          [custName, custEmail, custPhone],
          (err, result) => {
            if (err == undefined) {
              let newId = result.rows[0].id;
              res.send(`New customer added with id = ${newId}.`);
            } else {
              res.status(500).json({ error: err });
            }
          }
        );
      }
    }
  );
});
```

Because this uses `db.query` twice, once to check the email is not present and again to insert the new customer, it requires two separate connections to the database, one for each `db.query`. Since connections are expensive to acquire it makes sense to try to reduce them if possible, which we can do in this case.

## Using a Single Connection for Multiple SQL Commands

Instead of using `db.query` for each SQL command we first of all establish a connection:

```js
  db.connect((err, conn, release) => { ... });
```

The `db.connect` method uses a callback function with three arguments, `(err, conn, release)`.

The `err` argument is as before, it is either undefined if no error occurred or an appropiate message if the connection failed.

The `conn` argument takes the connection information and makes it available for the duration of the callback function with methods such as `conn.query`, which is very similar to the `db.query` method we've used before but doesn't establish its own connection, it uses the one we've created using `db.connect`.

The `release` argument takes as its value a function that will release the connection when no longer needed.

As before, all the work is done within the callback function using multiple invocations of the `conn.query` method to execute SQL but this time using just the one connection. For example:

```js
...
app.post("/customers", function(req, res) {
  const custName = req.body.name;
  const custEmail = req.body.email;
  const custPhone = req.body.phone;
  // ... Omitted the code to check the phone number to simplify the example
  db.connect((err, conn, release) => {
    conn.query("SELECT 1 FROM customers WHERE email=$1", [custEmail],
            (err, result) => {
      if (result.rowCount > 0) {
        release();
        return res
          .status(400)
          .send("A customer with that email address already exists!");
      } else {
        conn.query("INSERT INTO customers (name, email, phone) " +
                "VALUES ($1, $2, $3) " +
                "RETURNING id", [custName, custEmail, custPhone],
          (err, result) => {
            if (err == undefined) {
              let newId = result.rows[0].id;
              release();
              res.send(`New customer added with id = ${newId}.`);
            } else {
              release();
              res.status(500).json({error: err});
            }
        });
      }
    });
  });
});
```

Notice that in this example we're using `conn.query` instead of `db.query` but the rest of the code is very similar to the previous example.

You may have noticed the addition of a few calls of the `release()` function - these are important. You must call `release()` to release a connection you have established using `db.connect` otherwise you could exhaust the pool of available connections. The above code calls `release()` at every point where the endpoint could exit.

So now you have learned how to use a single connection and how to release it when finished.

### Exercise:
We can use the server.js that you wrote for the CYF DB Module or you can start with a new node environment completely - it's your choice.

1.  Ensure your server.js file has the appropriate preamble to initialise Express, Body Parser and PostgreSQL. You can use the cyf_hotel database created as part of the previous course.
2.  Rewrite the `POST` endpoint for `/customers` that inserts new customer data so that it uses a single connection for both checking the email and inserting the new customer.
3.  Create a new `PUT` endpoint for updating a customer's email address but include a check that the new email address doesn't exist in the customers table already.

## Using async/await for Complex Database Activity
We've only had fairly simple endpoints so far in our use of the database. A `GET` endpoint to return all or selected customers, a `POST` endpoint to insert a new customer, and so forth. In each of these there are only a few SQL commands, each of which involves a callback function. When the endpoint gets more complex with the number of SQL commands increasing then the corresponding callback functions can become very ugly and difficult to manage.

One elegant and easy way to overcome this is to use the Javascript async/await capability. You may have used async/await in previous sessions but we can provide the basics again here. Remember that async/await uses promises but makes the code structure much simpler (more like a conventional programming language) by hiding the asynchronous parts. We also use the `try/catch` construct to handle errors, simplifying error handling too.

First of all the `await` mechanism can only be used inside a function declared as `async`, so:
```js
async function doSomething() {
  // await code can go in here...
}
```
Another way to do this, especially useful in a Node/Express endpoint, is to use an "Immediately Invoked Function Expression" or IIFE (you can look this up on the web...). In a node/express endpoint this would look like:
```js
app.post("/customer", (req, res) => {
  ... // initialise endpoint stuff here...
  (async function() {           // here's the IIFE syntax for the function
    ...               // database stuff here using await ...
  })();                         // notice the () after the closing parenthesis )
});
```
Things to notice about the above:
1.  The endpoint is just a normal endpoint - the endpoint address is not relevant
2.  Enclose the entire async function expression in parentheses
3.  Put an empty pair of parentheses after the enclosing ()'s
```js
  (async function() { ... })();
```
Note: Very carefully go through the above line of code checking the parentheses - which ones match?

Now, let's do some real work in that endpoint. We'll do the same things that happened in our callback version but use `await` instead:
```js
app.post("/customers", function(req, res) {
  const custName = req.body.name;
  const custEmail = req.body.email;
  const custPhone = req.body.phone;
  ...
  
  (async () => {
    try {
      let result;

      const conn = await db.connect();
      result = await conn.query("SELECT 1 FROM customers WHERE email=$1", [custEmail]);
      if (result.rowCount > 0) {
        conn.release();
        return res
          .status(400)
          .send("A customer with that email address already exists!");
      } else {
        result = await conn.query("INSERT INTO customers (name, email, phone) " +
                          "VALUES ($1, $2, $3) " +
                          "RETURNING id", [custName, custEmail, custPhone]);
        let newId = result.rows[0].id;
        await conn.release();
        res.send(`New customer added with id = ${newId}.`);
      }
    } catch(err) {
      await conn.release();
      res.status(500).json({error: err});
    }
  })();
});
```
If you compare the above with the callback version of the same thing you'll notice:
* A simpler code structure to the whole endpoint, which can become very significant in complex cases
* The use of `try {...} catch ...` to handle errors, saving a lot of effort.

The above example involves just two SQL commands and doesn't require a transaction as it just performs a simple INSERT. In more complex cases where several tables need changes then transactions can be used and are often essential to avoid inconsistencies.

## Transactions in Node
In order to use a transaction in Node we must use  `BEGIN TRANSACTION`, the insert/update/delete commands and the `COMMIT` or `ROLLBACK` to terminate it, at least four SQL commands in all. We must also use a single connection for all these so must use the above scheme of working.

Consider the situation when a customer checks in to our hotel and is assigned a room and has their room billing initialised by creating an invoice. The customer can optionally request a change to their checkout date at the same time. This requires an update to the reservation and the insert of an invoice record. We can do this as follows:
```js
app.put("/reservations/checkin/:id", function(req, res) {
  const resId = req.params.id;
  const resRoomNo = req.body.room;
  const resCheckout = req.body.checkout;  // customer can amend checkout date on arrival

  (async () => {
    try {
      const conn = await db.connect();
      await conn.query("BEGIN TRANSACTION");
      if (resCheckout === undefined) {
        await conn.query("UPDATE reservations" + 
                          " SET room_no = $2" +
                          " WHERE id = $1", [resId, resRoomNo]);
      } else {
        await conn.query("UPDATE reservations" + 
                          " SET room_no = $2, checkout_date = $3" +
                          " WHERE id = $1", [resId, resRoomNo, resCheckout]);       
      }
      await conn.query("INSERT INTO invoices (res_id, total)" +
                        " VALUES ($1, 0.0)", [resId]);
      await conn.query("COMMIT");
      conn.release();
      res.status(200).send("Checkin completed successfully");
    } catch(err) {
      if (conn != null) {
        conn.query("ROLLBACK");
        conn.release();
      }
      res.status(500).json({error: err});
    }
  })();
});
```
That is how to do a very basic transaction in Node.js but it misses an important consideration. If our application is intended to be used by multiple users, some of whom may be online over the web, then we cannot safely leave it as it is. In particular there is the potential for users to make conflicting updates and destroy each other's work.

The problem arises in the time spent by the user checking and making the changes on their screen. They've just queried to see the customer's details and reservation, they assign a room number and ask if the customer wishes to change the checkout date. They type in the relevant details to confirm the checkin. In the time between their initial query and getting to this point another user could make a change to the same data. Whoever hits the 'Submit' button first will lose their changes as the second user overwrites them when they press 'Submit'.

![Change Conflict Diagram](change_conflict.png)

There are two ways to deal with this. We could lock the relevant row(s) when a user queries the initial data (e.g. customer and reservation details) but this could cause concurrency problems and is also not possible in a web-based application. In order to hold a lock we must retain the same connection session on the database but node releases the connection as it returns to the user.

The second way is to use what is called "optimistic locking". We only lock the records to be updated after the user has submitted their changes. This approach requires some extra processing, in particular we need to be sure the data to be changed hasn't been modified by another user since the original query. There are two main ways to do this:
1.  Send the results of the original query along with the changes from the browser to the server<br>
    Note that this requires the browser to store those original values so they can be returned to the server
2.  Create a new column in the table to be updated (e.g. row_version) that is incremented each time a change is made

The first approach has the advantage that it doesn't need any special design changes to the tables but requires us to compare the results of the original query (sent from the browser) with the results of a new query executed before we perform the update.

The second method also requires the browser to send extra data but this time only the previous value of the row version which we can then compare to the current value of the row version obtained from a new query. This also requires general query endpoints from the results of which the user might want to update the data must now also send the row version to the browser so that it can be returned for the update.

The method you use will depend on a number of factors but most likely will be dictated by the coding standards of the organisation you work for.

Below is an example, with comments in the code, based on method 1. for the reservation checkin process given above. This now requires a more complex JSON body - it must include both the assigned room no and the adjusted checkout date but also the data from the original query, for example:
```js
{
  "original": {
                "id": 43,
                "cust_id": 104,
                "checkin_date": "2020-05-13",
                "checkout_date": "2020-06-19",
                "room_no": null,
                "no_guests": 2,
                "booking_date": "2020-06-05"
              },
  "changes":  {
              "room": 309
              }
}
```

Note that the JSON body now includes the results of the original query against the reservations table. We must check that the corresponding row (id = 43) still contains the same data (otherwise we can assume another user has changed it in the intervening period).

```js
app.put("/reservations/checkin/:id", function(req, res) {
  const resId = req.params.id;
  const resRoomNo = req.body.changes.room;    // NOTE: this now refers to req.body.changes.room
  const resCheckout = req.body.changes.checkout;
  
  //
  // Function to compare two objects for equality of properties
  // Note: this does not perform a true equality test but compares
  //   attributes in 'a' that also occur in 'b'. Any attributes in
  //   'b' that don't appear in 'a' are not checked.
  //
  function objEqual (a, b) {
    for (var item in a) {
      if (a[item] != b[item]) {
          return false
      }
    };
  return true
  }

  //
  // Here is the main part of the endpoint code - checking the original data is unchanged then 
  // applying the changes.
  //

  (async () => {
    try {
      let result;

      const conn = await db.connect();
      await conn.query("BEGIN TRANSACTION");
      //
      // Here we re-query the row to get the data to match against re.body.original. Notice that we
      // use the FOR UPDATE option on the query to lock the row to prevent any further changes until
      // we commit or rollback our transaction.
      // If they are the same then proceed normally, otherwise return an error to the user
      //
      result = await conn.query(
          "SELECT cust_id, checkin_date, checkout_date, room_no, no_guests, booking_date" +
            " FROM reservations" +
            " WHERE id = $1" +
            " FOR UPDATE",    // Note - using the FOR UPDATE option
          [resId]
        ):
      //
      // Now use the objEqual function to compare the row with the original
      //
      if (objEqual(result.rows[0], req.body.original)) {
        //
        // Latest row = original, so now we are OK to continue...
        //
        if (resCheckout === undefined) {
          await conn.query("UPDATE reservations" + 
                            " SET room_no = $2" +
                            " WHERE id = $1", [resId, resRoomNo]);
        } else {
          await conn.query("UPDATE reservations" + 
                            " SET room_no = $2, checkout_date = $3" +
                            " WHERE id = $1", [resId, resRoomNo, resCheckout]);       
        }
        await conn.query("INSERT INTO invoices (res_id, total)" +
                          " VALUES ($1, 0.0)", [resId]);
        await conn.query("COMMIT");
        conn.release();
        res.status(200).send("Checkin completed successfully");
        //
        // By this point we've completed the changes successfully
        //
      } else {
        //
        // Here if the row doesn't match the original
        //
        conn.query("ROLLBACK");
        conn.release();  
        res.status(400).json({error: "Data modified by another user - please retry."});
      }
    } catch(err) {
      //
      // General error handling in the case of database errors
      //
      if (conn != null) {
        conn.query("ROLLBACK");
        conn.release();
      }
      res.status(500).json({error: err});
    }
  })();
});
```

That is doing a lot more work than the previous version of our checkin routine so it's rather more code. It is, however, a much more robust piece of code and is able to cope with multi-user activity that could break the previous version.

Just to recap, the sequence of events is as follows:
1.  The user queries to get the data they need to complete the checkin process (e.g. customer and reservation details)
2.  The code in the browser saves the results of the query locally
3.  The user spends time completing the checkin details
4.  The user clicks the button to send the changes to the server, the browser also sends the original query results
5.  The server issues a query against the reservations table to ensure no other user has changed that reservation while our user was working
6.  If the results of the query at (6.) returns the same data as the original (sent by the browser) then we can continue with the update
7.  If the results are different then we abort the transaction and send a message to the user saying another user has changed the data


