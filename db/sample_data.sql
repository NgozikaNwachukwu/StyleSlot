-- SOFE 3700U Project Phase II - StyleSlot
-- Part B: Sample Data

USE styleslot;

INSERT INTO USER_ACCOUNT VALUES
(1, 'amara.okafor@styleslot.ca', 'pw_hash_01', 'Amara', 'Okafor', '905-555-0101', 'admin', '2026-08-02 10:00:00'),
(2, 'tola.adeyemi@styleslot.ca', 'pw_hash_02', 'Tola', 'Adeyemi', '905-555-0112', 'stylist', '2026-08-03 10:00:00'),
(3, 'keisha.brown@styleslot.ca', 'pw_hash_03', 'Keisha', 'Brown', '905-555-0123', 'stylist', '2026-08-04 10:00:00'),
(4, 'zainab.musa@styleslot.ca', 'pw_hash_04', 'Zainab', 'Musa', '905-555-0134', 'stylist', '2026-08-05 10:00:00'),
(5, 'danielle.clarke@styleslot.ca', 'pw_hash_05', 'Danielle', 'Clarke', '905-555-0145', 'stylist', '2026-08-06 10:00:00'),
(6, 'precious.eze@styleslot.ca', 'pw_hash_06', 'Precious', 'Eze', '905-555-0156', 'stylist', '2026-08-07 10:00:00'),
(7, 'nadia.grant@styleslot.ca', 'pw_hash_07', 'Nadia', 'Grant', '416-555-0167', 'stylist', '2026-08-08 10:00:00'),
(8, 'simone.reid@styleslot.ca', 'pw_hash_08', 'Simone', 'Reid', '289-555-0178', 'stylist', '2026-08-09 10:00:00'),
(9, 'ifeoma.nnaji@gmail.com', 'pw_hash_09', 'Ifeoma', 'Nnaji', '905-555-0201', 'client', '2026-08-10 10:00:00'),
(10, 'jordan.mensah@gmail.com', 'pw_hash_10', 'Jordan', 'Mensah', '905-555-0212', 'client', '2026-08-11 10:00:00'),
(11, 'aaliyah.thomas@outlook.com', 'pw_hash_11', 'Aaliyah', 'Thomas', '289-555-0223', 'client', '2026-08-12 10:00:00'),
(12, 'chloe.martin@gmail.com', 'pw_hash_12', 'Chloe', 'Martin', '905-555-0234', 'client', '2026-08-13 10:00:00'),
(13, 'fatima.bello@yahoo.ca', 'pw_hash_13', 'Fatima', 'Bello', '416-555-0245', 'client', '2026-08-14 10:00:00'),
(14, 'renee.campbell@gmail.com', 'pw_hash_14', 'Renee', 'Campbell', '905-555-0256', 'client', '2026-08-15 10:00:00'),
(15, 'kemi.oladipo@gmail.com', 'pw_hash_15', 'Kemi', 'Oladipo', '289-555-0267', 'client', '2026-08-16 10:00:00'),
(16, 'tasha.williams@outlook.com', 'pw_hash_16', 'Tasha', 'Williams', '905-555-0278', 'client', '2026-08-17 10:00:00');


INSERT INTO SALON VALUES
(1, 'Crown & Coil Studio', '88 Simcoe St N', 'Oshawa', 'ON', 'L1G 4S2', '905-555-1001', FALSE),
(2, 'Loc''d In Hair Lounge', '215 Brock St S', 'Whitby', 'ON', 'L1N 4K1', '905-555-1002', FALSE),
(3, 'Velvet Edge Salon', '45 Harwood Ave S', 'Ajax', 'ON', 'L1S 2B9', '905-555-1003', FALSE),
(4, 'Braids by the Lake', '12 Lakeview Crt', 'Pickering', 'ON', 'L1W 3T5', '905-555-1004', TRUE),
(5, 'Twist & Shine Studio', '980 Queen St W', 'Toronto', 'ON', 'M6J 1H1', '416-555-1005', FALSE),
(6, 'Northside Beauty Bar', '1450 Simcoe St N', 'Oshawa', 'ON', 'L1G 4X8', '905-555-1006', FALSE);


INSERT INTO STYLIST VALUES
(2, 1, 'Locs specialist: starter locs, retwists and loc styling.', 9, '@tolalocs', TRUE),
(3, 1, 'Knotless and feed-in braids, neat parts, light on edges.', 6, '@keishabraids', TRUE),
(4, 2, 'Loctician and natural twist styles for all textures.', 11, '@zainab.locd', FALSE),
(5, 3, 'Colour, silk presses and healthy-hair treatments.', 14, '@danielle.colours', TRUE),
(6, 4, 'Home studio braider in Pickering. Braids and cornrows.', 4, '@braidsbythelake', TRUE),
(7, 5, 'Wig installs, lace frontals and silk presses.', 7, '@nadiawigs', TRUE),
(8, NULL, 'Mobile stylist: I come to you across Durham Region.', 5, '@simone.mobile', TRUE);


INSERT INTO CLIENT VALUES
(9, '4C', 'Oshawa', 'Tender-headed, prefers no tight edges'),
(10, '4B', 'Whitby', NULL),
(11, '4A', 'Ajax', 'Allergic to some hair dyes, patch test first'),
(12, '3C', 'Oshawa', NULL),
(13, '4C', 'Toronto', NULL),
(14, '4B', 'Pickering', 'Prefers weekend appointments'),
(15, '4C', 'Oshawa', NULL),
(16, '3B', 'Whitby', NULL);


INSERT INTO SERVICE VALUES
(1, 'Starter Locs', 'Locs', 'Begin new locs with comb coils or two-strand twists.', FALSE, 'Come with clean, detangled, product-free hair.'),
(2, 'Loc Retwist', 'Locs', 'Retwist new growth and style existing locs.', FALSE, 'Wash hair 1-2 days before. Do not oil roots the day of.'),
(3, 'Knotless Braids', 'Braids', 'Box braids started with your own hair, no knot at the root.', TRUE, 'Bring pre-stretched braiding hair. Hair must be washed, blow-dried and detangled.'),
(4, 'Cornrows', 'Braids', 'Straight-back or feed-in cornrows.', FALSE, 'Come with washed and blow-dried hair.'),
(5, 'Two-Strand Twists', 'Twists', 'Twists on natural hair, no extensions.', FALSE, 'Come with washed, stretched hair.'),
(6, 'Passion Twists', 'Twists', 'Bohemian twists using water-wave hair.', TRUE, 'Bring water-wave or passion-twist hair. Hair must be washed and stretched.'),
(7, 'Full Colour', 'Colour', 'Single-process permanent colour.', FALSE, 'Patch test needed 48 hours before. Do not wash hair the day of.'),
(8, 'Frontal Wig Install', 'Wig Install', 'Lace frontal or closure wig install and styling.', TRUE, 'Bring your wig. Cornrow base will be done in the appointment.'),
(9, 'Silk Press', 'Treatment', 'Wash, deep condition and silk press.', FALSE, 'Come with product-free hair.');


INSERT INTO SERVICE_VARIANT VALUES
(1, 2, 1, 'Comb coils, short hair', 160.00, 180, 40.00, TRUE),
(2, 2, 2, 'Retwist and style', 95.00, 120, 0.00, TRUE),
(3, 4, 2, 'Retwist only', 80.00, 90, 0.00, TRUE),
(4, 4, 1, 'Two-strand starter locs', 180.00, 240, 50.00, TRUE),
(5, 3, 3, 'Medium, mid-back', 260.00, 360, 60.00, TRUE),
(6, 3, 3, 'Small, waist length', 350.00, 480, 80.00, TRUE),
(7, 6, 3, 'Medium, mid-back', 220.00, 330, 50.00, TRUE),
(8, 6, 4, 'Straight-back, 8 rows', 70.00, 90, 0.00, TRUE),
(9, 3, 4, 'Feed-in, 6 rows', 110.00, 150, 20.00, TRUE),
(10, 4, 5, 'Natural hair, medium', 120.00, 180, 30.00, TRUE),
(11, 8, 6, 'Medium, shoulder length', 200.00, 300, 50.00, TRUE),
(12, 5, 7, 'Single process', 150.00, 150, 30.00, TRUE),
(13, 5, 9, 'Silk press and trim', 95.00, 120, 0.00, TRUE),
(14, 7, 8, 'Lace frontal, install and style', 180.00, 180, 50.00, TRUE),
(15, 8, 8, 'Glueless install', 140.00, 120, 25.00, TRUE),
(16, 7, 9, 'Silk press', 85.00, 105, 0.00, TRUE),
(17, 8, 5, 'Mini twists', 160.00, 240, 40.00, TRUE);


INSERT INTO TIME_SLOT VALUES
(2, '2026-09-18', '09:00:00', '19:00:00', 'open'),
(2, '2026-10-16', '09:00:00', '19:00:00', 'open'),
(2, '2026-11-05', '09:00:00', '19:00:00', 'open'),
(2, '2026-11-12', '10:00:00', '18:00:00', 'open'),
(2, '2026-11-15', '09:00:00', '19:00:00', 'open'),
(2, '2026-11-19', '10:00:00', '18:00:00', 'open'),
(3, '2026-09-12', '09:00:00', '19:00:00', 'open'),
(3, '2026-11-04', '09:00:00', '19:00:00', 'open'),
(3, '2026-11-13', '08:30:00', '18:30:00', 'open'),
(3, '2026-11-20', '09:00:00', '18:00:00', 'open'),
(3, '2026-11-27', '09:00:00', '17:00:00', 'blocked'),
(4, '2026-10-10', '09:00:00', '19:00:00', 'open'),
(4, '2026-10-21', '09:00:00', '19:00:00', 'open'),
(4, '2026-10-31', '09:00:00', '19:00:00', 'open'),
(4, '2026-11-07', '09:00:00', '19:00:00', 'open'),
(4, '2026-11-21', '10:00:00', '16:00:00', 'open'),
(5, '2026-09-24', '09:00:00', '19:00:00', 'open'),
(5, '2026-10-22', '09:00:00', '19:00:00', 'open'),
(5, '2026-11-18', '11:00:00', '19:00:00', 'open'),
(5, '2026-11-21', '09:00:00', '19:00:00', 'open'),
(5, '2026-12-24', '09:00:00', '19:00:00', 'blocked'),
(6, '2026-10-03', '09:00:00', '19:00:00', 'open'),
(6, '2026-11-15', '09:00:00', '17:00:00', 'open'),
(6, '2026-11-28', '09:00:00', '19:00:00', 'open'),
(7, '2026-10-03', '09:00:00', '19:00:00', 'open'),
(7, '2026-10-27', '09:00:00', '19:00:00', 'open'),
(7, '2026-11-14', '09:00:00', '19:00:00', 'open'),
(7, '2026-11-21', '10:00:00', '18:00:00', 'open'),
(8, '2026-10-17', '09:00:00', '19:00:00', 'open'),
(8, '2026-11-20', '09:00:00', '19:00:00', 'open'),
(8, '2026-11-27', '09:00:00', '15:00:00', 'open'),
(8, '2026-12-03', '09:00:00', '19:00:00', 'open');


INSERT INTO APPOINTMENT VALUES
(1, 9, 5, '2026-09-12 09:00:00', '2026-09-12 15:00:00', 260.00, 'completed', TRUE, 'First time trying knotless.', '2026-08-31 19:00:00'),
(2, 10, 2, '2026-09-18 14:00:00', '2026-09-18 16:00:00', 95.00, 'completed', FALSE, NULL, '2026-09-06 19:00:00'),
(3, 11, 12, '2026-09-24 10:00:00', '2026-09-24 12:30:00', 150.00, 'completed', FALSE, 'Patch test done Sept 22.', '2026-09-12 19:00:00'),
(4, 12, 14, '2026-10-03 11:00:00', '2026-10-03 14:00:00', 180.00, 'completed', TRUE, NULL, '2026-09-21 19:00:00'),
(5, 13, 7, '2026-10-03 09:00:00', '2026-10-03 14:30:00', 220.00, 'completed', TRUE, NULL, '2026-09-21 19:00:00'),
(6, 14, 10, '2026-10-10 10:00:00', '2026-10-10 13:00:00', 120.00, 'no_show', FALSE, NULL, '2026-09-28 19:00:00'),
(7, 15, 1, '2026-10-16 10:00:00', '2026-10-16 13:00:00', 160.00, 'completed', FALSE, 'Want them on the thinner side.', '2026-10-04 19:00:00'),
(8, 9, 11, '2026-10-17 09:00:00', '2026-10-17 14:00:00', 200.00, 'completed', TRUE, NULL, '2026-10-05 19:00:00'),
(9, 16, 13, '2026-10-22 13:00:00', '2026-10-22 15:00:00', 95.00, 'completed', FALSE, NULL, '2026-10-10 19:00:00'),
(10, 10, 3, '2026-10-21 12:00:00', '2026-10-21 13:30:00', 80.00, 'completed', FALSE, NULL, '2026-10-09 19:00:00'),
(11, 11, 10, '2026-10-31 10:00:00', '2026-10-31 13:00:00', 120.00, 'cancelled', FALSE, 'Cancelled 3 days before.', '2026-10-19 19:00:00'),
(12, 12, 16, '2026-10-27 15:00:00', '2026-10-27 16:45:00', 85.00, 'completed', FALSE, NULL, '2026-10-15 19:00:00'),
(13, 13, 9, '2026-11-04 10:00:00', '2026-11-04 12:30:00', 110.00, 'no_show', FALSE, NULL, '2026-10-23 19:00:00'),
(14, 15, 2, '2026-11-05 13:00:00', '2026-11-05 15:00:00', 95.00, 'completed', FALSE, NULL, '2026-10-24 19:00:00'),
(15, 14, 4, '2026-11-07 09:00:00', '2026-11-07 13:00:00', 180.00, 'completed', FALSE, NULL, '2026-10-26 19:00:00'),
(16, 16, 6, '2026-11-13 09:00:00', '2026-11-13 17:00:00', 350.00, 'confirmed', TRUE, 'Waist length, colour 1B/30.', '2026-11-01 19:00:00'),
(17, 9, 2, '2026-11-15 10:00:00', '2026-11-15 12:00:00', 95.00, 'confirmed', FALSE, NULL, '2026-11-03 19:00:00'),
(18, 16, 14, '2026-11-14 11:00:00', '2026-11-14 14:00:00', 180.00, 'confirmed', TRUE, NULL, '2026-11-02 19:00:00'),
(19, 9, 17, '2026-11-20 10:00:00', '2026-11-20 14:00:00', 160.00, 'requested', FALSE, NULL, '2026-11-07 15:00:00'),
(20, 11, 12, '2026-11-21 10:00:00', '2026-11-21 12:30:00', 150.00, 'confirmed', FALSE, 'Patch test booked Nov 19.', '2026-11-07 19:00:00'),
(21, 12, 7, '2026-11-28 09:00:00', '2026-11-28 14:30:00', 220.00, 'confirmed', TRUE, NULL, '2026-11-07 18:00:00'),
(22, 15, 8, '2026-11-28 15:00:00', '2026-11-28 16:30:00', 70.00, 'cancelled', FALSE, 'Changed plans.', '2026-11-07 17:00:00'),
(23, 14, 8, '2026-11-28 15:00:00', '2026-11-28 16:30:00', 70.00, 'confirmed', FALSE, 'Took the slot after #22 cancelled.', '2026-11-07 16:00:00'),
(24, 12, 15, '2026-12-03 12:00:00', '2026-12-03 14:00:00', 140.00, 'requested', TRUE, NULL, '2026-11-07 15:00:00');


INSERT INTO APPOINTMENT_MATERIAL VALUES
(1, 'Edge control', 1, 'stylist'),
(1, 'Pre-stretched braiding hair, 1B', 6, 'client'),
(4, '22-inch lace frontal wig', 1, 'client'),
(4, 'Lace glue', 1, 'stylist'),
(5, 'Pre-stretched braiding hair, 1B', 5, 'client'),
(8, 'Water-wave passion twist hair', 8, 'client'),
(16, 'Mousse', 1, 'stylist'),
(16, 'Pre-stretched braiding hair, 1B/30', 8, 'client'),
(18, '24-inch HD lace frontal wig', 1, 'client'),
(21, 'Pre-stretched braiding hair, 1B', 6, 'client'),
(24, 'Glueless closure wig', 1, 'client');


INSERT INTO PAYMENT VALUES
(1, 1, 'pi_test_001', 'deposit', 60.00, 'CAD', 'succeeded', '2026-08-31 19:00:00'),
(2, 1, 'pi_test_002', 'balance', 200.00, 'CAD', 'succeeded', '2026-09-12 15:00:00'),
(3, 2, 'pi_test_003', 'balance', 95.00, 'CAD', 'succeeded', '2026-09-18 16:00:00'),
(4, 3, 'pi_test_004', 'deposit', 30.00, 'CAD', 'succeeded', '2026-09-12 19:00:00'),
(5, 3, 'pi_test_005', 'balance', 120.00, 'CAD', 'succeeded', '2026-09-24 12:30:00'),
(6, 4, 'pi_test_006', 'deposit', 50.00, 'CAD', 'succeeded', '2026-09-21 19:00:00'),
(7, 4, 'pi_test_007', 'balance', 130.00, 'CAD', 'succeeded', '2026-10-03 14:00:00'),
(8, 5, 'pi_test_008', 'deposit', 50.00, 'CAD', 'succeeded', '2026-09-21 19:00:00'),
(9, 5, 'pi_test_009', 'balance', 170.00, 'CAD', 'succeeded', '2026-10-03 14:30:00'),
(10, 6, 'pi_test_010', 'deposit', 30.00, 'CAD', 'succeeded', '2026-09-28 19:00:00'),
(11, 7, 'pi_test_011', 'deposit', 40.00, 'CAD', 'succeeded', '2026-10-04 19:00:00'),
(12, 7, 'pi_test_012', 'balance', 120.00, 'CAD', 'succeeded', '2026-10-16 13:00:00'),
(13, 8, 'pi_test_013', 'deposit', 50.00, 'CAD', 'succeeded', '2026-10-05 19:00:00'),
(14, 8, 'pi_test_014', 'balance', 150.00, 'CAD', 'succeeded', '2026-10-17 14:00:00'),
(15, 9, 'pi_test_015', 'balance', 95.00, 'CAD', 'succeeded', '2026-10-22 15:00:00'),
(16, 10, 'pi_test_016', 'balance', 80.00, 'CAD', 'succeeded', '2026-10-21 13:30:00'),
(17, 11, 'pi_test_017', 'deposit', 30.00, 'CAD', 'succeeded', '2026-10-19 19:00:00'),
(18, 11, 'pi_test_018', 'refund', 30.00, 'CAD', 'succeeded', '2026-10-28 09:00:00'),
(19, 12, 'pi_test_019', 'balance', 85.00, 'CAD', 'succeeded', '2026-10-27 16:45:00'),
(20, 13, 'pi_test_020', 'deposit', 20.00, 'CAD', 'succeeded', '2026-10-23 19:00:00'),
(21, 14, 'pi_test_021', 'balance', 95.00, 'CAD', 'succeeded', '2026-11-05 15:00:00'),
(22, 15, 'pi_test_022', 'deposit', 50.00, 'CAD', 'succeeded', '2026-10-26 19:00:00'),
(23, 15, 'pi_test_023', 'balance', 130.00, 'CAD', 'succeeded', '2026-11-07 13:00:00'),
(24, 16, 'pi_test_024', 'deposit', 80.00, 'CAD', 'succeeded', '2026-11-01 19:00:00'),
(25, 18, 'pi_test_025', 'deposit', 50.00, 'CAD', 'succeeded', '2026-11-02 19:00:00'),
(26, 19, 'pi_test_026', 'deposit', 40.00, 'CAD', 'succeeded', '2026-11-07 15:00:00'),
(27, 20, 'pi_test_027', 'deposit', 30.00, 'CAD', 'succeeded', '2026-11-07 19:00:00'),
(28, 21, 'pi_test_028', 'deposit', 50.00, 'CAD', 'succeeded', '2026-11-07 18:00:00'),
(29, 24, 'pi_test_029', 'deposit', 25.00, 'CAD', 'succeeded', '2026-11-07 15:00:00'),
(30, 19, 'pi_test_030', 'deposit', 40.00, 'CAD', 'failed', '2026-11-07 15:00:00');


INSERT INTO REVIEW VALUES
(1, 5, 'Neat parts and no tension. Took 6 hours but worth it.', '2026-09-14 18:30:00'),
(2, 4, 'Great retwist, ran a bit late.', '2026-09-20 18:30:00'),
(3, 5, 'Colour came out exactly like the photo.', '2026-09-26 18:30:00'),
(4, 5, 'Install looks so natural, lace melted perfectly.', '2026-10-05 18:30:00'),
(5, 4, 'Lovely braids, home studio was comfy.', '2026-10-05 18:30:00'),
(7, 5, 'My starter locs are perfect.', '2026-10-18 18:30:00'),
(8, 3, 'Twists started frizzing after a week.', '2026-10-19 18:30:00'),
(9, 4, 'Silky and bouncy, lasted two weeks.', '2026-10-24 18:30:00'),
(10, 4, NULL, '2026-10-23 18:30:00'),
(12, 5, 'Best silk press in Toronto.', '2026-10-29 18:30:00'),
(15, 4, 'Very patient with my thick hair.', '2026-11-08 08:30:00');