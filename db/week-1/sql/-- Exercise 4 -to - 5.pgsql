-- Exercise 4
--4.1
SELECT * FROM reservations WHERE checkout_date - checkin_date >0;

--4.2

SELECT rate*5 AS "5 Nights No Discount", rate*0.15*5 AS "Discount",  rate*5 - rate*0.15*5 AS "Discounted Rate for 5 Nights" 
FROM rooms 
WHERE room_type ILIKE 'premier' OR room_type ILIKE 'premier plus';

--4.3
select * from reservations 
where checkin_date between '2023-01-01' and '2023-02-01';


-- Exercise 5

--5.1 
SELECT DISTINCT room_type FROM rooms;

--5.2
SELECT name,address,phone FROM customers ORDER BY name;

--5.3
SELECT name, address,city,country FROM customers ORDER BY country, city DESC;

--5.4
--SELECT room_no,room_type,rate*5 AS "Cost of 5 Nights" FROM rooms ORDER BY rate*5 DESC LIMIT 15; -- this query will work as same the following one.
SELECT room_no,room_type,rate*5 AS "Cost of 5 Nights" FROM rooms ORDER BY "Cost of 5 Nights" DESC LIMIT 15;