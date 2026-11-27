const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Convert Open-Meteo weather codes into descriptions
function getDescription(code) {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55].includes(code)) return 'Drizzle';
    if ([56, 57].includes(code)) return 'Freezing drizzle';
    if ([61, 63, 65].includes(code)) return 'Rain';
    if ([66, 67].includes(code)) return 'Freezing rain';
    if ([71, 73, 75, 77].includes(code)) return 'Snow';
    if ([80, 81, 82].includes(code)) return 'Rain showers';
    if ([85, 86].includes(code)) return 'Snow showers';
    if ([95, 96, 99].includes(code)) return 'Thunderstorm';

    return 'Unknown weather condition';
}

// POST /api/weather
// Fetch current weather and save it to MySQL
router.post('/', requireAuth, async (req, res) => {

    const { city } = req.body || {};

    if (
        typeof city !== 'string' ||
        city.trim().toLowerCase() !== 'oshawa'
    ) {
        return res.status(400).json({
            success: false,
            message: 'Please enter Oshawa as the city'
        });
    }

    let current;

    try {
        const url =
            'https://api.open-meteo.com/v1/forecast' +
            '?latitude=43.8971' +
            '&longitude=-78.8658' +
            '&current=temperature_2m,weather_code' +
            '&temperature_unit=celsius' +
            '&timezone=UTC';

        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error('Weather API request failed');
        }

        const weather = await response.json();

        current = weather.current;

        if (
            !current ||
            !Number.isFinite(current.temperature_2m) ||
            !Number.isInteger(current.weather_code)
        ) {
            throw new Error('Invalid weather data');
        }

    } catch (error) {

        console.error('Open-Meteo error:', error.message);

        return res.status(502).json({
            success: false,
            message: 'Unable to retrieve current weather'
        });
    }

    try {
        const temperature = current.temperature_2m;
        const description = getDescription(current.weather_code);

        const fetchedAt = new Date()
            .toISOString()
            .slice(0, 19) + 'Z';

        const databaseTime = fetchedAt
            .replace('T', ' ')
            .replace('Z', '');

        // Database Query 1: INSERT weather results
        await db.query(
            `INSERT INTO WEATHER
                (City, Temperature, Description, Fetched_at)
             VALUES (?, ?, ?, ?)`,
            [
                'Oshawa',
                temperature,
                description,
                databaseTime
            ]
        );

        return res.status(201).json({
            success: true,
            data: {
                city: 'Oshawa',
                temperature,
                description,
                fetched_at: fetchedAt
            }
        });

    } catch (error) {

        console.error('Weather database error:', error.code);

        return res.status(500).json({
            success: false,
            message: 'Failed to save weather information'
        });
    }
});

// GET /api/weather
// Retrieve previously saved weather results
router.get('/', requireAuth, async (req, res) => {

    try {

        // Database Query 2: SELECT saved weather results
        const [rows] = await db.query(
            `SELECT
                Weather_id AS weather_id,
                City AS city,
                Temperature AS temperature,
                Description AS description,
                DATE_FORMAT(
                    Fetched_at,
                    '%Y-%m-%dT%H:%i:%sZ'
                ) AS fetched_at
             FROM WEATHER
             ORDER BY Fetched_at DESC, Weather_id DESC`
        );

        const results = rows.map(row => ({
            ...row,
            temperature: Number(row.temperature)
        }));

        return res.json({
            success: true,
            data: results
        });

    } catch (error) {

        console.error('Weather retrieval error:', error.code);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve saved weather'
        });
    }
});

module.exports = router;