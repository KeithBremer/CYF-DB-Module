--Exercise 1
--1.1 List the name, phone , eamil of all customers
SELECT name,email FROM customers;

--1.2 List all the details of rooms
SELECT * FROM rooms;

--1.3 List the customersid, checkin date and number of guests from reservations
SELECT cust_id,checkin_date,no_guests FROM reservations;

-- Exercise 2
--2.1 \d customers this is how to display a table definition in the terminal
--2.2 \? select will show all options available under the SELECT command.
--2.3 \d is one of the informational commands and it shows the list of SEQUENCES
cyf_hotels=> \ds
                    List of relations
 Schema |        Name         |   Type   |     Owner      
--------+---------------------+----------+----------------
 public | bookings_id_seq     | sequence | codeyourfuture
 public | customers_id_seq    | sequence | codeyourfuture
 public | hotels_id_seq       | sequence | codeyourfuture
 public | invoices_id_seq     | sequence | codeyourfuture
 public | reservations_id_seq | sequence | codeyourfuture
(5 rows)

-- Exercise 3
--3.1 customers from Norway
SELECT * FROM customers WHERE country="Norway";

--3.2 rooms that can accommodate more then 2 no_guests
SELECT * FROM rooms WHERE no_guests > 2;

--3.3 invocies dated back a month ago.
SELECT * FROM invoices WHERE invoice_date <='2023-01-02';

--3.4 the effect of 15% discount of last MONTH
SELECT * FROM invoices WHERE invoice_date >= '2023-01-01'; --to see the table data with same period

SELECT sum(total) As "Total Without Discount", 
sum(total)*0.15 AS "Total Discount", 
sum(total)-sum(total)*0.15 AS "Discounted Total" 
from invoices 
where invoice_date >= '2023-01-01';

--3.5 List of customers names starts with "W"

SELECT * FROM customers WHERE name ILIKE 'm%';



