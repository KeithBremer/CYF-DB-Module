# More SQL
## Objectives
By the end of this lesson you should be able to:
*   Use sub-queries to access multiple tables in a query
*   Understand the purpose and use of transactions
*   Undestand the purpose and use of locking to ensure consistent data
*   Use constraints to ensure data validity and consistency
*   Define indexes to improve query performance
*   Define and use views to encapsulate queries
*   Give other users access to your tables and views

---
## Subqueries
It is sometimes necessary to base the results of one query on what you get from another, for example, to find all customers from the same country as Mary Saveley:
```sql
    SELECT country FROM customers
      WHERE name = 'Mary Saveley';
    ...
    SELECT * FROM customers
      WHERE country = <result from 1st query>;
```
This is very clumsy, you have to retype the result of the first query in the second. It would be much better to have just one query that works for whatever name we provide!

We can rewrite that as:
```sql
    SELECT * FROM customers
      WHERE country = (
            SELECT country FROM customers
              WHERE name = 'Mary Saveley');
```
* Subqueries are always enclosed in parentheses (...).
* The subquery provides the value for country required by the WHERE condition.
* Notice that the subquery is written last but is executed first, as in the original two query solution.

You can use a subquery on the right hand side (RHS) of a predicate, of the form:
```sql
    ... WHERE expr <op> (SELECT ...) ...
```
`<op>` is a comparison operator such as `=`, `>`, `<=`, etc.

This kind of subquery must return just a single result and in most cases just a single row.  The exception is with the `IN` operator where multiple rows form the list of values for the test.

For example:
```sql
    SELECT * FROM reservations
      WHERE (checkout_date - checkin_date) > (
          SELECT avg(checkout_date - checkin_date)
            FROM reservations);
```
What question does this query answer? Remember that the inner query is executed first to provide a result to feed into the outer query.

An example using the `IN` operator:
```sql
    SELECT * FROM reservations
      WHERE cust_id IN (SELECT id FROM customers WHERE country = 'Norway');
```

Subqueries can also be used to check for the existence (or non-existence) of rows in other tables by using the EXISTS or NOT EXISTS keywords, for example:
```sql
    SELECT * FROM customers c
      WHERE EXISTS (SELECT 1 FROM reservations r
                          WHERE r.cust_id = c.id);
```
This example lists all customers who have at least one reservation.

It is also an example of a correlated subquery.

Correlated subqueries use values from the outer query - in this case the subquery can't execute first, they must both execute together. Note the use of `r.cust_id = c.id`; `r.cust_id` is from the subquery but `c.id` comes from the outer query.

For example:
```sql
    SELECT c.name, c.country,
           r.checkout_date - r.checkin_date as nights
      FROM customers c
      JOIN reservations r ON (r.cust_id = c.id)
      WHERE r.checkout_date - r.checkin_date =
            (SELECT max(y.checkout_date - y.checkin_date)
              FROM customers x
              JOIN reservations y ON (y.cust_id = x.id)
              WHERE x.country = c.country);
```
Notice that the inner query is using the value of `c.country` from the outer query. Can you work out what question this query answers?

You can use subqueries in many places where you would use a column name or a table name. For example:
```sql
    SELECT name, email,
           (SELECT count(*) FROM reservations r
             WHERE r.cust_id = c.id) bookings_made
      FROM customers c
      WHERE country = 'USA';
```
Returns name, email and the number of reservations for all USA customers.

This is another example of a "correlated subquery" when the subquery uses a value from the outer query (`c.id` in this case).

You can use a subquery in place of a table (in postgreSQL you must always use a subquery alias for these). For example:
```sql
    SELECT MAX(sumn) AS max_cust_nights
      FROM (SELECT SUM(checkout_date - checkin_date) AS sumn
              FROM reservations
              GROUP BY cust_id
           ) AS sub1;
```
You can use this construct in a wide variety of contexts. One classic use is in SQL dialects that don't support nested aggregate functions you can use a subquery to find things like `MAX(SUM(expr))`.

---

## Exercise
Use subqueries to resolve the following:
1.  List all rooms for which there are no reservations for the next month.
2.  How many customers have not made any reservations within the last 30 days?
3.  List all customers along with the total of all the invoices they have paid. Don't include unpaid invoices. Some customers have no invoices - leave the total blank.
4.  What is the maximum number of reservations in any month (based on checkin date)?
Hint - use the date_trunc function...
5.  Bonus Question : List all the reservations for the month which has the largest number of reservations. (hint: nesting)

---
## Transactions
By default, PostgreSQL runs each INSERT, UPDATE or DELETE in its own transaction - it either succeeds or fails. But the ACID rules require us to be able to make several changes that either all succeed or all fail. To do this we use a transaction.

For example, in banking, a money transfer between accounts must debit the ‘from’ account and credit the ‘to’ account as a single operation - but this needs two update commands. A transaction allows us to issue multiple commands to the database and if they all succeed then make those permanent but if any part fails we can undo all the commands.  So...

Start a transaction using the command:
```sql
    BEGIN TRANSACTION;
```
… then issue any number of SELECT, INSERT, UPDATE and/or DELETE commands

End the transaction with either:
```sql
    COMMIT;        -- make changes permanent
```
or:
```sql
    ROLLBACK;    -- undo changes since last BEGIN
```
In your code you can detect the status of each command and then roll back the changes if any part fails.  If all succeed then you just commit the changes and they become permanent in the database.

---
### Exercise - Using Transactions
1.  In the psql command line tool, issue the commands:
```sql
    BEGIN TRANSACTION;
    UPDATE reservations SET room_no = 310 WHERE id = 10;
```
Now open a new terminal session (leaving the first still open) and in psql do:
```sql
SELECT * FROM reservations WHERE id = 10;
```
What do you notice about room_no? Leave this session open as well.

2.  Go back to the first terminal session (which should still be open in psql). Issue the following command:
```sql
COMMIT;
```
then return to the second terminal session and requery reservation 10. What has changed?

3.  Repeat step 1 of this exercise (use the same two terminal sessions if you wish).  DO NOT issue a `COMMIT` command.

4.  In the second terminal session issue the command:
```sql
UPDATE reservations SET room_no = 304 WHERE id = 10;
```
What happens?

5.  Leaving the second terminal open, go back to the first session and issue the command:
```sql
ROLLBACK;
```
Now check what has happened in the second session. Why do you think that happened? Requery reservation id 10 and check the room number.

---

Transactions prevent other users (database sessions) from making changes to the same rows that have been changed in another transaction.  This is done using 'locks'.  Locks do not exist physically but are a software mechanism that can be used by code (e.g. the RDBMS) to ensure that multiple processes can work consistently and safely with the same data.

PostgreSQL uses row locking by default for INSERT, UPDATE and DELETE, preventing other processes from changing rows that you have changed. If another change to a locked row is attempted while your transaction is active then that command waits until the lock is released, with either a `COMMIT` or a `ROLLBACK`.

Changes do not prevent other users (sessions) from querying the changed rows but changes won't be visible until they are committed.

---
### ACID Rules
ACID is a mnemonic for:

* Atomic - all related changes succeed or all fail
* Consistent - committed changes leave the database
consistent (all rules obeyed)
* Isolation - other users always see a consistent image, can’t see
incomplete changes
* Durable - committed changes are permanent (even after
power failure)

---
## Locking
Databases use locking mechanisms to control concurrent activity to ensure it remains consistent and safe.

Locking systems are beyond the scope of this course but for the moment you can imagine that when a computer process locks a resource then that resource has limited accessibility for other processes.

Locking prevents another user from breaking the changes you have made during a transaction. It is largely automatic, governed by the RDBMS.

For example:
Time | User A Activity | User B Activity | Comments
-----|-----------------|-----------------|---------
10:31 | Start a transaction | |
10:32 | Change record 31 | | User A gets a lock on record 31
10:33 | | Starts a transaction |
10:34 | | Tries to change record 31 | Is blocked by user A's lock
10:35 | Commit changes | | User A's lock is released
10:36 | | User B's changes applied to record 31 | (there might be a problem here)

### When Does Locking Occur?
Whenever you issue an INSERT, UPDATE or DELETE command the RDBMS locks the record(s) you are processing, automatically.

You can also lock rows explicitly during a query by using the `FOR UPDATE` clause:
```sql
SELECT ... FROM customers
  WHERE id = 31
  FOR UPDATE;
```
The `FOR UPDATE` clause tells the RDBMS to lock the selected rows pending an UPDATE or DELETE operation on those rows.

You can lock rows and tables in various modes. In general you rarely lock tables explicitly but the RDBMS may lock them for various operations (for example, ALTER TABLE, DROP TABLE, etc.). You can refer to the documentation to see how PostgreSQL manages locks on tables and rows: https://www.postgresql.org/docs/current/explicit-locking.html

It is important to ensure that locks are held for the shortest possible time to permit the maximum multi-user concurrency on your database. This requires that locks are NOT held on tables or rows while waiting for the user to enter data at the computer. Consider the following timeline:

The sequence of events in a transaction:
1.  Query the data to be changed (don't lock)
2.  Display the data to the user (so the user can change the data as required)
3.  User makes changes on the screen here - time passes...
4.  User eventually clicks Submit (or some similar button)
5.  Query the data again - this time locking the rows (`SELECT ... FOR UPDATE`)
6.  Compare the new query results with the original query results from 1. (before user changes)
7.  If they are the same then make changes on the DB then `COMMIT`
8.  If they are different then warn the user to restart the process

Note that step 3. is, in computer terms, a VERY slow process. It's important the locks are not held while the user is thinking and entering data.

### Exercise: Locking
1.  Start a transaction in your hotels database and make a change to a row (don't commit or rollback)
2.  Open a new terminal and connect to the hotels database
3.  Start a new transaction in the new session
4.  Make a different change to the same row in your database.  What happens?
5.  Go back to the first session and commit
6.  What happens in second session - check the row values

---
### Locking in Other Databases
In most DBs a lock conflict causes the second (and any subsequent) lock request to suspend until the resource (e.g. a row) is no longer locked. 

Some DBs provide a NOWAIT option on commands that take out locks such that the command ends immediately with an error if a conflict occurs. (mySQL, Oracle, PostgreSQL,...). For example:
```sql
SELECT * FROM customers
  WHERE id = 31
  FOR UPDATE NOWAIT;
```
If the above query finds it cannot lock the relevant row because it's already locked by another user then it will return an error rather than wait for the row to become available.

---

## More on CREATE TABLE, etc.

### Defining Constraints
You can define different kinds of constraints on a table. We have already seen primary keys and foreign keys, but just to recap:

Define a single column primary key:
```sql
CREATE TABLE rooms
  room_no     INTEGER PRIMARY KEY,
  ...
  );
```
You can also define an autoincementing primary key (that has its value incremented each time a new row is inserted):
```sql
CREATE TABLE reservations (
  id          SERIAL PRIMARY KEY,
  ...
  );
```
Note that the SERIAL keyword is a pseudo-type and implies INTEGER. Use the `\d <table_name>` command to see the full implementation of SERIAL.

Note aslo that `PRIMARY KEY` implies `NOT NULL`.

If the primary key comprises multiple columns then the above method won't work. Instead we use a separate constraint definition, usually placed after all the column definitions, as follows:
```sql
CREATE TABLE invoice_items (
  invoice_no      INTEGER NOT NULL,
  item_no         INTEGER NOT NULL,
  charge_type     VARCHAR(30) NOT NULL,
  amount          NUMERIC(6,2) NOT NULL,
  ...
  comment         VARCHAR(240),
  PRIMARY KEY (invoice_no, item_no),
  FOREIGN KEY (invoice_no) REFERENCES invoices(id)
);
```
Here the `PRIMARY KEY` keywords appear at the beginning of the constraint definition followed by the primary key columns in parentheses (). The primary key still implies `NOT NULL` so the columns don't need to be declared as such, but some developers prefer to make it explicit when the constraint is defined separately.

Note also that a part of a primary key can be a foreign key to another table (e.g. invoice_no). That constraint has also been defined separately, a convention that some people prefer. A separate constraint is, of course, required when the foreign key comprises multiple columns, as below:
```sql
CREATE TABLE item_breakdown (
  ...
  FOREIGN KEY (invoice_no, item_no) REFERENCES invoice_items (invoice_no, item_no),
  ...
);
```
### The UNIQUE constraint
While the primary key provides unique identification of each row in a table, it may be that other columns hold data that must be unique across the table. To do this we use the `UNIQUE` constraint.

For example, in the hotel customers table the email column may be designated as unique, as follows:
```sql
CREATE TABLE customers (
  ...
  email       VARCHAR(120) NOT NULL UNIQUE,
  ...
);
```
The UNIQUE constraint automatically creates an index (just as the PRIMARY KEY constraint does) to enforce uniqueness. Any attempt to insert or update an email address that already exists wil result in an error.

Where a combination of column values must be unique then the constraint must be defined separately, as follows:
```sql
CREATE TABLE reservations (
  ...
  room_no       INTEGER,
  checkin_date  DATE,
  ...
  UNIQUE (room_no, checkin_date),
  ...
);
```
This constraint ensures that the combined values of room_no and checkin_date are unique (otherwise we might have double-booked the room!).

### Check Constraints
The `NOT NULL` part of a column definition is also a constraint, ensuring that each row contains a value in that column.

You can also provide custom checks on column values to ensure further compliance with business requirements. For example, it could be beneficial to ensure that data entered for checkin date and checkout date in a reservation are chronologically sensible. We use a `CHECK` constraint for this purpose:
```sql
CREATE TABLE reservations (
  ...
  CHECK (checkin_date <= checkout_date),
  ...
);
```
Check constraints can only refer to columns in the row being inserted/updated and literal values. You cannot use subquries nor function values that could return different data on different occasions (e.g. current_date). Check constraints must always give a TRUE answer for the lifetime of the row.

You can use any of the SQL conditional operators `=`, `<`, `>`, `<=`, `>=`, `!=`, `IN (...)`, `BETWEEN x AND y` or `LIKE...`. Compound conditions linked with `AND` and `OR` are allowed.

---
### Exercise:
1.  Define a UNIQUE constraint on the email column in the customers table.
2.  Ensure that rooms can only take between 1 and 4 guests
3.  Define a check constraint on the rooms table to ensure that rate must be greater than zero.
4.  Ensure that a reservation checkin date must be the same as or later than the booking date and that the checkout date must be greater than the checkin date.
5.  Use your SQL skills to test these constraints by attempting to insert rows that violate the constraints

---

## Designing for Performance
Databases must handle a large number of actions every second, often accessing tables containing millions of rows, so it's important to ensure good performance. 

You can define indexes to improve access to particular column values. Such indexes can be used when you specify the column value in WHERE clauses, etc. The RDBMS uses a query optimiser to decide whether to use any available indexes or not.

![Index Queries](index-queries.png)

In the unindexed query case the RDBMS scans the entire table, examining each row in turn. To do this it must read each physical database block containing rows in this table, a relatively expensive action involving potentially hundreds or thousands of I/O operations. These 'full table scans' are generally undesirable in queries requiring only a few rows from large sets of data but for small tables they provide the fastest access route.

Using an index can often find the required data much faster in large tables. An index is a hierarchical structure rather like a tree. The trunk is the starting point for searching and the leaves are the end points. To find the leaf (or leaves) we want we just have to move along the relevant branches, ignoring leaves on other branches. This can significantly reduce the amount of I/O activity and make the search much faster. Most indexes use a technology called 'B-Tree' to structure the index.

An index is defined by specifying the columns of the table that are to be indexed. An index can be defined for one or more columns. When an SQL statement refers to an indexed column in its `WHERE` conditions it's possible that the optimiser may use the index to speed the search. The optimiser is a set of rules and algorithms defined in the RDBMS that tries to find the best pathway to get the required data.

Some indexes are created automatically as part of other features of the database. For example, in PostgreSQL, an index is created for the primary key of the table - this is the simplest way to ensure that primary key values are unique across the table.

Do be aware, however, that there are also costs in providing indexes. Each index must be adjusted for every new row added to and every row deleted from the table. It must also be updated each time the indexed columns are updated. The database designer must take this into account when defining indexes to speed queries.

To create an index on a table we use the `CREATE INDEX` command:
```sql
CREATE INDEX res_cust_id ON reservations(cust_id);
```
This index could be used to resolve queries that include:
```sql
  SELECT ... FROM reservations ... WHERE cust_id = 1234 ...
```
or
```sql
  SELECT ... FROM reservations ... WHERE cust_id BETWEEN 1234 AND 1245 ...
```
It's less likely to be used for a query that has:
```sql
  SELECT ... FROM reservations ... WHERE cust_id < 1234 ...
```
because the less than operator could generally refer to a large number of rows and lead the optimiser to prefer a full table scan.

You can define an index on multiple columns and this could be used when any leading part of the index is specified in the `WHERE` conditions. For example:
```sql
CREATE INDEX res_cust_checkin ON reservations (cust_id, checkin_date);
```
This index could be used when a query specifies `WHERE cust_id = 1234 AND checkin_date = '2020-06-12'` or when the query specifies only `WHERE cust_id = 1234`. It is not likely to be used if the where condition only specifies `WHERE checkin_date = '2020-06-12'`. Note also that this new index makes the previous one on `cust_id` alone fairly redundant.

You can define a unique index that enforces uniqueness in the indexed coumn(s). For example:
```sql
CREATE UNIQUE INDEX cust_email ON customers(email);
```
This is equivalent to defining a UNIQUE constraint in the table definition:

Notice that you cannot (in PostgreSQL) and should not normally try to specify whether an index is to be used or not. Some SQL implementations provide a 'hint' mechanism that enables developers to suggest various preferences to the optimiser to solve a specific problem. These generally cause worse problems later as the data changes over time so should always be avoided. Most such problems are the result of poor database design.

### Using EXPLAIN to Check Query Behaviour


### Exercise:
1.  Create an index on the checkin date in the reservations table.
2.  Create a unique index on the combined room_no and checkin_date columns in the reservations table. You can use any valid method to do this.

Interesting Question:

What is the guaranteed performance effect of adding an index to a table?

Discuss...

## Using Views to Encapsulate Queries and Control Access
A View is a mechanism in SQL that stores a SELECT statement in the database definitions. The select statement can be executed by treating the view as though it is a table.

To create a view you provide a name, optional replacement column names and the query that defines the view.  For example, to create a view of customers from the USA we might have:
```sql
CREATE VIEW customers_usa (id, name, email, phone, address, city, zipcode) AS
  SELECT id, name, email, phone, address, city, postcode
    FROM customers
    WHERE country = 'USA';
```
Views behave very much like tables for queries, so just use the name in the FROM clause along with other query clauses as required:
```sql
SELECT * FROM customers_usa WHERE zipcode LIKE '900%'
  ORDER BY city, address;
```

Views can be used for a variety of purposes. This could include encapsulating a complex query comprising multiple joins, subqueries, etc. so that it can be used by non-technical users for ad-hoc queries. They can also be used to give restricted access to data for certain users or roles within an organisation, limiting the columns and/or rows available (See **Users, Roles and Access Control** below).

Views are permanent definitions, created once and used as often as required. Views can be changed if necessary and dropped when no longer needed.

To change a view definition use:
```sql
CREATE OR REPLACE VIEW name (columns...) AS
  SELECT ...
```
The view definition must be completely replaced, you cannot change just one column.

### Exercise: Views
In the cyf_hotel database:
1.  Define a view, reservations_n, that provides an alternative method of accessing the reservations table. It should have columns res_id, cust_id, room_no, checkin_date, nights_stay and no_guests and should present all the rows in reservations.
2.  
## Users, Roles and Access Control
We know from setting up the database that we can create users in PostgreSQL. We used the command `createuser` in the terminal to create our own user on the database system:
```
createuser -P --createdb my_name
```
Users are part of the PostgreSQL role hierarchy. Users can be members of roles and roles can be members of roles. In general, users are at the bottom of the hierarchy but a user can inherit access permissions from any role of which they are a member, either directly or indirectly.

![Users and Roles](roles.png)

Here the users 'liam', 'charlotte', 'ellie' and 'nuala' are users and are also members of the 'manager' role.  Users 'ellie', 'moses' and 'maya' are members of the role 'sales'.  Notice that a user can be a member of more than one role.

Any privileges granted to the roles are, by default, inherited by its members. 

### Granting Access to a Table
The owner of a table can give any user or role access to their own table. The command to do this is:
```sql
GRANT <access>,... ON <table name> TO <role/user name>;
```
To give user liam access to query and update the customers table you use:
```sql
GRANT SELECT, UPDATE ON customers TO liam;
```
You can also allow the user to whom you grant access the ability to pass on their access rights to other users. To do this append the `WITH GRANT OPTION` to the command. So to give user `charlotte` the ability to query, insert, update and delete rooms plus the ability to pass those on to other users you use:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON rooms TO charlotte WITH GRANT OPTION;
```
To give all sales staff query access to the reservations table you use:
```sql
GRANT SELECT ON reservations TO sales;
```
To add a user as a member of another role, you grant the role to the user:
```sql
GRANT sales TO charlotte;
GRANT manager TO ellie;
```

### Using Views for Access Control
When a user has access to a view they do not need access to the underlying tables. Only the creator of the view needs access to the tables on which the view is based.

For example, if I need to give cleaners access to the reservations table but only to see when a room is scheduled to be checked out today with no details of customer id, no. of guests or booking date I could use:
```sql
CREATE VIEW rooms_to_clean (room_no, checkin_date, checkout_date) AS
  SELECT room_no, checkin_date, checkout_date
    FROM reservations
    WHERE checkout_date = current_date;
```
The cleaners could query this view without access to the full reservations table but still see which rooms are being checked out today so are due for a full clean.

To give the cleaners access to the view use:
```sql
GRANT SELECT ON rooms_to_clean TO cleaners;
```
Here we have a role named `cleaners` to which all our cleaning staff belong. They do not need access to reservations. Granting read access to the view gives all members of the `cleaners` role access to the view for queries.

---

## Lesson Summary
In this lesson you have learned how to:

* Use sub-queries to access multiple tables in a query
* Start and complete transaction in PostgreSQL using COMMIT and ROLLBACK
* Use locking to ensure consistent data
* Define indexes to improve query performance
* Define views as a means to encapsulate complex queries or to control access
* Control access to tables, views and other objects

---
## Homework
1.  Complete any exercises you have not yet finished from this lesson.
2.  Oh - I just can't think of anything...
---
