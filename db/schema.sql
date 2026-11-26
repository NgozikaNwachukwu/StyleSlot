-- SOFE 3700U Project Phase II - StyleSlot
-- Part A: Relational Schema (MySQL)

DROP DATABASE IF EXISTS styleslot;
CREATE DATABASE styleslot;
USE styleslot;

CREATE TABLE USER_ACCOUNT (
    User_id INT NOT NULL AUTO_INCREMENT,
    Email VARCHAR(120) NOT NULL,
    Password_hash VARCHAR(100) NOT NULL,
    First_name VARCHAR(50) NOT NULL,
    Last_name VARCHAR(50) NOT NULL,
    Phone VARCHAR(20),
    Role VARCHAR(10) NOT NULL,
    Created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (User_id),
    UNIQUE (Email),
    CHECK (Role IN ('admin', 'stylist', 'client'))
);

CREATE TABLE SALON (
    Salon_id INT NOT NULL AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Street VARCHAR(120) NOT NULL,
    City VARCHAR(60) NOT NULL,
    Province CHAR(2) NOT NULL DEFAULT 'ON',
    Postal_code CHAR(7) NOT NULL,
    Phone VARCHAR(20),
    Is_home_based BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (Salon_id)
);

-- Salon_id is NULL for mobile stylists who don't work out of a salon

CREATE TABLE STYLIST (
    Stylist_id INT NOT NULL,
    Salon_id INT,
    Bio VARCHAR(500),
    Years_experience INT NOT NULL DEFAULT 0,
    Instagram_handle VARCHAR(40),
    Accepts_new_clients BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (Stylist_id),
    FOREIGN KEY (Stylist_id) REFERENCES USER_ACCOUNT (User_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (Salon_id) REFERENCES SALON (Salon_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CHECK (Years_experience >= 0)
);

CREATE TABLE CLIENT (
    Client_id INT NOT NULL,
    Hair_type VARCHAR(4),
    Preferred_city VARCHAR(60),
    Notes VARCHAR(300),
    PRIMARY KEY (Client_id),
    FOREIGN KEY (Client_id) REFERENCES USER_ACCOUNT (User_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE SERVICE (
    Service_id INT NOT NULL AUTO_INCREMENT,
    Name VARCHAR(60) NOT NULL,
    Category VARCHAR(20) NOT NULL,
    Description VARCHAR(300),
    Requires_client_materials BOOLEAN NOT NULL DEFAULT FALSE,
    Prep_instructions VARCHAR(300),
    PRIMARY KEY (Service_id),
    UNIQUE (Name),
    CHECK (Category IN ('Locs', 'Braids', 'Twists', 'Colour', 'Wig Install', 'Treatment', 'Cut'))
);

-- Each stylist sets their own price, length and deposit for a service.
-- Services that take 3 hours or more must have a deposit.

CREATE TABLE SERVICE_VARIANT (
    Variant_id INT NOT NULL AUTO_INCREMENT,
    Stylist_id INT NOT NULL,
    Service_id INT NOT NULL,
    Variant_name VARCHAR(80) NOT NULL,
    Price DECIMAL(7,2) NOT NULL,
    Duration_min INT NOT NULL,
    Deposit_amount DECIMAL(7,2) NOT NULL DEFAULT 0,
    Is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (Variant_id),
    UNIQUE (Stylist_id, Service_id, Variant_name),
    FOREIGN KEY (Stylist_id) REFERENCES STYLIST (Stylist_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (Service_id) REFERENCES SERVICE (Service_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (Price > 0),
    CHECK (Duration_min BETWEEN 15 AND 720),
    CHECK (Deposit_amount >= 0 AND Deposit_amount <= Price),
    CHECK (Duration_min < 180 OR Deposit_amount > 0)
);

CREATE TABLE TIME_SLOT (
    Stylist_id INT NOT NULL,
    Slot_date DATE NOT NULL,
    Start_time TIME NOT NULL,
    End_time TIME NOT NULL,
    Status VARCHAR(8) NOT NULL DEFAULT 'open',
    PRIMARY KEY (Stylist_id, Slot_date, Start_time),
    FOREIGN KEY (Stylist_id) REFERENCES STYLIST (Stylist_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (End_time > Start_time),
    CHECK (Status IN ('open', 'blocked'))
);

-- The stylist is found through the variant, so it isn't stored here.
-- Quoted_price is the price at the time of booking.

CREATE TABLE APPOINTMENT (
    Appointment_id INT NOT NULL AUTO_INCREMENT,
    Client_id INT NOT NULL,
    Variant_id INT NOT NULL,
    Start_datetime DATETIME NOT NULL,
    End_datetime DATETIME NOT NULL,
    Quoted_price DECIMAL(7,2) NOT NULL,
    Status VARCHAR(10) NOT NULL DEFAULT 'requested',
    Client_brings_materials BOOLEAN NOT NULL DEFAULT FALSE,
    Client_notes VARCHAR(300),
    Created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Appointment_id),
    FOREIGN KEY (Client_id) REFERENCES CLIENT (Client_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (Variant_id) REFERENCES SERVICE_VARIANT (Variant_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (End_datetime > Start_datetime),
    CHECK (Quoted_price > 0),
    CHECK (Status IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show'))
);

CREATE TABLE APPOINTMENT_MATERIAL (
    Appointment_id INT NOT NULL,
    Item_name VARCHAR(80) NOT NULL,
    Quantity INT NOT NULL DEFAULT 1,
    Supplied_by VARCHAR(7) NOT NULL,
    PRIMARY KEY (Appointment_id, Item_name),
    FOREIGN KEY (Appointment_id) REFERENCES APPOINTMENT (Appointment_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (Quantity > 0),
    CHECK (Supplied_by IN ('client', 'stylist'))
);

CREATE TABLE PAYMENT (
    Payment_id INT NOT NULL AUTO_INCREMENT,
    Appointment_id INT NOT NULL,
    Stripe_payment_id VARCHAR(40) NOT NULL,
    Payment_type VARCHAR(7) NOT NULL,
    Amount DECIMAL(7,2) NOT NULL,
    Currency CHAR(3) NOT NULL DEFAULT 'CAD',
    Status VARCHAR(9) NOT NULL,
    Paid_at DATETIME NOT NULL,
    PRIMARY KEY (Payment_id),
    UNIQUE (Stripe_payment_id),
    FOREIGN KEY (Appointment_id) REFERENCES APPOINTMENT (Appointment_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (Payment_type IN ('deposit', 'balance', 'refund')),
    CHECK (Amount > 0),
    CHECK (Status IN ('pending', 'succeeded', 'failed'))
);

CREATE TABLE REVIEW (
    Appointment_id INT NOT NULL,
    Rating INT NOT NULL,
    Comment VARCHAR(500),
    Created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Appointment_id),
    FOREIGN KEY (Appointment_id) REFERENCES APPOINTMENT (Appointment_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (Rating BETWEEN 1 AND 5)
);

-- Stops a stylist from being double-booked

DELIMITER $$

CREATE TRIGGER NO_DOUBLE_BOOKING
BEFORE INSERT ON APPOINTMENT
FOR EACH ROW
BEGIN
    IF NEW.Status <> 'cancelled' AND EXISTS (
        SELECT *
        FROM APPOINTMENT A, SERVICE_VARIANT V, SERVICE_VARIANT NV
        WHERE A.Variant_id = V.Variant_id
          AND NV.Variant_id = NEW.Variant_id
          AND V.Stylist_id = NV.Stylist_id
          AND A.Status <> 'cancelled'
          AND A.Start_datetime < NEW.End_datetime
          AND A.End_datetime > NEW.Start_datetime
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This stylist is already booked at that time';
    END IF;
END$$

DELIMITER ;